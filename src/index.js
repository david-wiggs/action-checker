require('dotenv').config();
const express = require('express');
const { Webhooks } = require('@octokit/webhooks');
const { App } = require('@octokit/app');
const WorkflowAnalyzer = require('./workflow-analyzer');

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

// Middleware
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
  try {
    await webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: req.headers['x-github-event'],
      signature: req.headers['x-hub-signature-256'],
      payload: req.body,
    });
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send('Bad Request');
  }
});

// Keep the /webhook endpoint for backward compatibility
app.post('/webhook', async (req, res) => {
  try {
    await webhooks.verifyAndReceive({
      id: req.headers['x-github-delivery'],
      name: req.headers['x-github-event'],
      signature: req.headers['x-hub-signature-256'],
      payload: req.body,
    });
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send('Bad Request');
  }
});

// Handle deployment protection rule events
webhooks.on('deployment_protection_rule.requested', async ({ payload }) => {
  console.log('Deployment protection rule requested:', {
    repository: payload.repository.full_name,
    environment: payload.environment,
    deployment_callback_url: payload.deployment_callback_url,
  });

  try {
    // Get installation for the repository
    const installation = await githubApp.getInstallationOctokit(payload.installation.id);
    
    // Get the workflow run details
    const workflowRun = await getWorkflowRun(installation, payload);
    
    if (!workflowRun) {
      console.error('Could not find workflow run');
      await rejectDeployment(installation, payload, 'Could not analyze workflow');
      return;
    }

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
    await rejectDeployment(installation, payload, 'Internal error occurred during analysis');
  }
});

async function getWorkflowRun(installation, payload) {
  try {
    // The deployment callback URL contains information about the workflow run
    // We need to extract the run ID from the deployment context
    const { data: deployment } = await installation.rest.repos.getDeployment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      deployment_id: payload.deployment.id,
    });

    // Get workflow runs for the deployment ref
    const { data: workflowRuns } = await installation.rest.actions.listWorkflowRunsForRepo({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      head_sha: deployment.sha,
      per_page: 1,
    });

    return workflowRuns.workflow_runs[0];
  } catch (error) {
    console.error('Error getting workflow run:', error);
    return null;
  }
}

async function getWorkflowContent(installation, payload, workflowRun) {
  try {
    const workflowPath = workflowRun.path;
    
    const { data: fileContent } = await installation.rest.repos.getContent({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      path: workflowPath,
      ref: workflowRun.head_sha,
    });

    // Decode base64 content
    return Buffer.from(fileContent.content, 'base64').toString('utf8');
  } catch (error) {
    console.error('Error getting workflow content:', error);
    return null;
  }
}

async function approveDeployment(installation, payload, analysisResult) {
  try {
    const message = analysisResult.hasLocalActions 
      ? `Deployment approved despite local actions: ${analysisResult.localActions.join(', ')}`
      : 'Deployment approved: No local actions detected';

    await installation.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      run_id: payload.deployment.id,
      environment_name: payload.environment,
      state: 'approved',
      comment: message,
    });

    console.log('Deployment approved:', message);
  } catch (error) {
    console.error('Error approving deployment:', error);
  }
}

async function rejectDeployment(installation, payload, reason) {
  try {
    await installation.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      run_id: payload.deployment.id,
      environment_name: payload.environment,
      state: 'rejected',
      comment: reason,
    });

    console.log('Deployment rejected:', reason);
  } catch (error) {
    console.error('Error rejecting deployment:', error);
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
