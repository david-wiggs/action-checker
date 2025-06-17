require('dotenv').config();
const express = require('express');
const { Webhooks } = require('@octokit/webhooks');
const { App } = require('@octokit/app');
const WorkflowAnalyzer = require('./workflow-analyzer');

// Validate required environment variables
const requiredEnvVars = ['GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

console.log('✅ Environment variables validated');
console.log(`📱 GitHub App ID: ${process.env.GITHUB_APP_ID}`);
console.log(`🔐 Webhook Secret: ${process.env.GITHUB_WEBHOOK_SECRET ? 'Set' : 'Missing'}`);
console.log(`🔑 Private Key: ${process.env.GITHUB_PRIVATE_KEY ? 'Set (' + process.env.GITHUB_PRIVATE_KEY.length + ' chars)' : 'Missing'}`);

const app = express();
const port = process.env.PORT || 3000;

// Initialize GitHub App
const githubApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
});

// Initialize webhooks
const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET,
});

// Middleware for webhook verification - use raw body
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use('/', express.raw({ type: 'application/json', limit: '10mb' }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint that shows app info for GET requests
app.get('/', (req, res) => {
  res.json({ 
    name: 'Local Action Checker',
    description: 'GitHub App environment protection rule for local actions',
    status: 'running',
    endpoints: {
      health: '/health',
      webhook: '/ (POST)'
    },
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint at root path
app.post('/', async (req, res) => {
  console.log('Webhook received at root path');
  console.log('Headers:', {
    'x-github-delivery': req.headers['x-github-delivery'],
    'x-github-event': req.headers['x-github-event'],
    'x-hub-signature-256': req.headers['x-hub-signature-256'],
    'content-type': req.headers['content-type']
  });

  try {
    const payload = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    
    await webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: req.headers['x-github-event'],
      signature: req.headers['x-hub-signature-256'],
      payload: payload,
    });
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error at root:', error);
    console.error('Request body type:', typeof req.body);
    console.error('Request body length:', req.body ? req.body.length : 'undefined');
    res.status(400).send('Bad Request');
  }
});

// Keep the /webhook endpoint for backward compatibility
app.post('/webhook', async (req, res) => {
  console.log('Webhook received at /webhook path');
  console.log('Headers:', {
    'x-github-delivery': req.headers['x-github-delivery'],
    'x-github-event': req.headers['x-github-event'],
    'x-hub-signature-256': req.headers['x-hub-signature-256'],
    'content-type': req.headers['content-type']
  });

  try {
    const payload = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    
    await webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: req.headers['x-github-event'],
      signature: req.headers['x-hub-signature-256'],
      payload: payload,
    });
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error at /webhook:', error);
    console.error('Request body type:', typeof req.body);
    console.error('Request body length:', req.body ? req.body.length : 'undefined');
    res.status(400).send('Bad Request');
  }
});

// Handle deployment protection rule events
webhooks.on('deployment_protection_rule.requested', async ({ payload }) => {
  console.log('🚀 Deployment protection rule requested');
  console.log('Repository:', payload.repository?.full_name);
  console.log('Environment:', payload.environment);
  console.log('Installation ID:', payload.installation?.id);
  console.log('Deployment ID:', payload.deployment?.id);
  console.log('Deployment callback URL:', payload.deployment_callback_url);
  
  // Log the full payload structure for debugging (be careful with sensitive data)
  console.log('Payload keys:', Object.keys(payload));
  console.log('Repository keys:', Object.keys(payload.repository || {}));
  console.log('Deployment keys:', Object.keys(payload.deployment || {}));
  console.log('Installation keys:', Object.keys(payload.installation || {}));

  try {
    // Get installation for the repository
    console.log('Getting installation for ID:', payload.installation?.id);
    
    if (!payload.installation?.id) {
      console.error('No installation ID found in payload');
      await rejectDeployment(null, payload, 'No installation ID found');
      return;
    }

    const installation = await githubApp.getInstallationOctokit(payload.installation.id);
    
    console.log('Installation object keys:', Object.keys(installation));
    console.log('Installation has request?', !!installation.request);
    console.log('Installation has auth?', !!installation.auth);
    
    // Get the workflow run details
    const workflowRun = await getWorkflowRun(installation, payload);
    
    if (!workflowRun) {
      console.error('Could not find workflow run');
      await rejectDeployment(installation, payload, 'Could not analyze workflow');
      return;
    }

    // Store the workflow run ID for approval/rejection
    payload._workflowRunId = workflowRun.id;

    // Get the workflow file content
    const workflowContent = await getWorkflowContent(installation, payload, workflowRun);
    
    if (!workflowContent) {
      console.error('Could not fetch workflow content');
      await rejectDeployment(installation, payload, 'Could not fetch workflow file');
      return;
    }

    // Analyze the workflow for local actions
    const analyzer = new WorkflowAnalyzer();
    const analysisResult = analyzer.analyzeWorkflow(workflowContent);
    
    console.log('Workflow analysis result:', analysisResult);

    // Decide whether to approve or reject
    const shouldAllow = process.env.ALLOW_LOCAL_ACTIONS === 'true';
    
    if (analysisResult.hasLocalActions && !shouldAllow) {
      await rejectDeployment(
        installation, 
        payload, 
        `Deployment rejected: Workflow uses local actions: ${analysisResult.localActions.join(', ')}`
      );
    } else {
      await approveDeployment(installation, payload, analysisResult);
    }

  } catch (error) {
    console.error('Error processing deployment protection rule:', error);
    console.error('Error stack:', error.stack);
    
    // Try to get installation again if it wasn't set
    let installationForReject = installation;
    if (!installationForReject && payload.installation?.id) {
      try {
        installationForReject = await githubApp.getInstallationOctokit(payload.installation.id);
      } catch (installError) {
        console.error('Could not get installation for rejection:', installError);
      }
    }
    
    await rejectDeployment(installationForReject, payload, 'Internal error occurred during analysis');
  }
});

async function getWorkflowRun(installation, payload) {
  try {
    console.log('Getting workflow run with payload:', {
      owner: payload.repository?.owner?.login,
      repo: payload.repository?.name,
      deployment_id: payload.deployment?.id
    });

    if (!installation || !installation.request) {
      throw new Error('Invalid installation object - missing request method');
    }

    if (!payload.deployment?.id) {
      throw new Error('No deployment ID found in payload');
    }

    // The deployment callback URL contains information about the workflow run
    // We need to extract the run ID from the deployment context
    const deployment = await installation.request('GET /repos/{owner}/{repo}/deployments/{deployment_id}', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      deployment_id: payload.deployment.id,
    });

    console.log('Deployment data:', {
      id: deployment.data.id,
      sha: deployment.data.sha,
      ref: deployment.data.ref,
      environment: deployment.data.environment
    });

    // Get workflow runs for the deployment ref
    const workflowRuns = await installation.request('GET /repos/{owner}/{repo}/actions/runs', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      head_sha: deployment.data.sha,
      per_page: 1,
    });

    console.log('Found workflow runs:', workflowRuns.data.workflow_runs.length);
    
    if (workflowRuns.data.workflow_runs.length === 0) {
      console.warn('No workflow runs found for deployment SHA:', deployment.data.sha);
      return null;
    }

    const workflowRun = workflowRuns.data.workflow_runs[0];
    console.log('Selected workflow run:', {
      id: workflowRun.id,
      name: workflowRun.name,
      path: workflowRun.path,
      head_sha: workflowRun.head_sha
    });

    return workflowRun;
  } catch (error) {
    console.error('Error getting workflow run:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data
    });
    return null;
  }
}

async function getWorkflowContent(installation, payload, workflowRun) {
  try {
    const workflowPath = workflowRun.path;
    
    const fileContent = await installation.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      path: workflowPath,
      ref: workflowRun.head_sha,
    });

    // Decode base64 content
    return Buffer.from(fileContent.data.content, 'base64').toString('utf8');
  } catch (error) {
    console.error('Error getting workflow content:', error);
    return null;
  }
}

async function approveDeployment(installation, payload, analysisResult) {
  try {
    if (!installation || !installation.request) {
      console.error('Cannot approve deployment: invalid installation object');
      return;
    }

    const message = analysisResult.hasLocalActions 
      ? `Deployment approved despite local actions: ${analysisResult.localActions.join(', ')}`
      : 'Deployment approved: No local actions detected';

    console.log('Approving deployment with message:', message);

    // First, we need to get the workflow run ID from the deployment callback URL
    const runId = await getWorkflowRunIdFromPayload(payload);
    
    if (!runId) {
      console.error('Cannot approve: No workflow run ID found');
      return;
    }

    await installation.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      run_id: runId,
      environment_name: payload.environment,
      state: 'approved',
      comment: message,
    });

    console.log('Deployment approved:', message);
  } catch (error) {
    console.error('Error approving deployment:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data
    });
  }
}

async function rejectDeployment(installation, payload, reason) {
  try {
    if (!installation || !installation.request) {
      console.error('Cannot reject deployment: invalid installation object');
      console.error('Rejection reason would have been:', reason);
      return;
    }

    console.log('Rejecting deployment with reason:', reason);

    // First, we need to get the workflow run ID from the deployment callback URL
    const runId = await getWorkflowRunIdFromPayload(payload);
    
    if (!runId) {
      console.error('Cannot reject: No workflow run ID found');
      return;
    }

    await installation.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      run_id: runId,
      environment_name: payload.environment,
      state: 'rejected',
      comment: reason,
    });

    console.log('Deployment rejected:', reason);
  } catch (error) {
    console.error('Error rejecting deployment:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      response: error.response?.data
    });
  }
}

async function getWorkflowRunIdFromPayload(payload) {
  try {
    // First try to use the stored workflow run ID
    if (payload._workflowRunId) {
      console.log('Using stored workflow run ID:', payload._workflowRunId);
      return payload._workflowRunId;
    }
    
    // The deployment callback URL contains the workflow run ID
    // Format: https://api.github.com/repos/owner/repo/actions/runs/{run_id}/deployment_protection_rule
    if (payload.deployment_callback_url) {
      const match = payload.deployment_callback_url.match(/\/actions\/runs\/(\d+)\/deployment_protection_rule/);
      if (match) {
        console.log('Extracted workflow run ID from callback URL:', match[1]);
        return parseInt(match[1], 10);
      }
    }
    
    // Fallback: try to get it from the workflow run we found earlier
    // This requires making an API call, which we already do in getWorkflowRun
    console.warn('Could not extract run ID from callback URL, using deployment ID as fallback');
    return payload.deployment?.id;
  } catch (error) {
    console.error('Error extracting workflow run ID:', error);
    return payload.deployment?.id;
  }
}

// Error handling
webhooks.onError((error) => {
  console.error('Webhook error:', error);
});

// Start server
app.listen(port, () => {
  console.log(`Local Action Checker GitHub App listening on port ${port}`);
  console.log(`Webhook endpoint: http://localhost:${port}/`);
  console.log(`Webhook endpoint (legacy): http://localhost:${port}/webhook`);
  console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = app;
