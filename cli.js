#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const WorkflowAnalyzer = require('./src/workflow-analyzer');

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node cli.js <workflow-file.yml>');
    console.log('Example: node cli.js examples/workflow-with-local-actions.yml');
    process.exit(1);
  }

  const workflowFile = args[0];
  
  if (!fs.existsSync(workflowFile)) {
    console.error(`Error: File '${workflowFile}' not found`);
    process.exit(1);
  }

  try {
    const workflowContent = fs.readFileSync(workflowFile, 'utf8');
    const analyzer = new WorkflowAnalyzer();
    const result = analyzer.getActionDetails(workflowContent);
    
    console.log('='.repeat(60));
    console.log(`Analysis Results for: ${workflowFile}`);
    console.log('='.repeat(60));
    
    if (result.error) {
      console.error('❌ Error analyzing workflow:', result.error);
      process.exit(1);
    }
    
    console.log(`📊 Summary:`);
    console.log(`   Total Jobs: ${result.jobs.length}`);
    console.log(`   Total Steps: ${result.totalSteps}`);
    console.log(`   Total Actions: ${result.summary.totalActions}`);
    console.log(`   Local Actions: ${result.summary.localCount}`);
    console.log(`   External Actions: ${result.summary.externalCount}`);
    console.log(`   Docker Actions: ${result.summary.dockerCount}`);
    console.log();
    
    if (result.hasLocalActions) {
      console.log('🚨 LOCAL ACTIONS DETECTED:');
      result.localActions.forEach(action => {
        console.log(`   - ${action}`);
      });
      console.log();
      
      console.log('📍 Local Action Details:');
      result.actionBreakdown.local.forEach(action => {
        console.log(`   Job: ${action.jobName}`);
        console.log(`   Step: ${action.stepName}`);
        console.log(`   Action: ${action.path}`);
        console.log('   ---');
      });
    } else {
      console.log('✅ No local actions detected');
    }
    
    console.log();
    console.log('🔍 All Actions Used:');
    
    if (result.actionBreakdown.local.length > 0) {
      console.log('   Local Actions:');
      result.actionBreakdown.local.forEach(action => {
        console.log(`     - ${action.path} (${action.jobName})`);
      });
    }
    
    if (result.actionBreakdown.external.length > 0) {
      console.log('   External Actions:');
      result.actionBreakdown.external.forEach(action => {
        console.log(`     - ${action.path} (${action.jobName})`);
      });
    }
    
    if (result.actionBreakdown.docker.length > 0) {
      console.log('   Docker Actions:');
      result.actionBreakdown.docker.forEach(action => {
        console.log(`     - ${action.path} (${action.jobName})`);
      });
    }
    
    console.log();
    console.log('🔒 Environment Protection Decision:');
    const allowLocalActions = process.env.ALLOW_LOCAL_ACTIONS === 'true';
    
    if (result.hasLocalActions && !allowLocalActions) {
      console.log('   ❌ DEPLOYMENT WOULD BE REJECTED');
      console.log('   Reason: Local actions detected and ALLOW_LOCAL_ACTIONS is not set to true');
    } else if (result.hasLocalActions && allowLocalActions) {
      console.log('   ✅ DEPLOYMENT WOULD BE APPROVED');
      console.log('   Reason: Local actions detected but ALLOW_LOCAL_ACTIONS is set to true');
    } else {
      console.log('   ✅ DEPLOYMENT WOULD BE APPROVED');
      console.log('   Reason: No local actions detected');
    }
    
  } catch (error) {
    console.error('Error reading or analyzing workflow file:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
