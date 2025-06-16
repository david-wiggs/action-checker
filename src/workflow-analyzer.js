const yaml = require('js-yaml');

class WorkflowAnalyzer {
  /**
   * Analyzes a GitHub workflow YAML content for local action usage
   * @param {string} workflowContent - The YAML content of the workflow file
   * @returns {Object} Analysis result with hasLocalActions and localActions array
   */
  analyzeWorkflow(workflowContent) {
    try {
      const workflow = yaml.load(workflowContent);
      const result = {
        hasLocalActions: false,
        localActions: [],
        totalSteps: 0,
        jobs: []
      };

      if (!workflow || !workflow.jobs) {
        return result;
      }

      // Iterate through all jobs
      Object.entries(workflow.jobs).forEach(([jobName, job]) => {
        const jobResult = {
          name: jobName,
          hasLocalActions: false,
          localActions: [],
          steps: []
        };

        if (job.steps && Array.isArray(job.steps)) {
          job.steps.forEach((step, stepIndex) => {
            result.totalSteps++;
            
            const stepResult = {
              index: stepIndex,
              name: step.name || `Step ${stepIndex + 1}`,
              hasLocalAction: false,
              actionPath: null
            };

            // Check if step uses an action
            if (step.uses) {
              stepResult.actionPath = step.uses;
              
              // Check if it's a local action (starts with ./ or just .)
              if (this.isLocalAction(step.uses)) {
                stepResult.hasLocalAction = true;
                jobResult.hasLocalActions = true;
                jobResult.localActions.push(step.uses);
                result.hasLocalActions = true;
                result.localActions.push(step.uses);
              }
            }

            jobResult.steps.push(stepResult);
          });
        }

        result.jobs.push(jobResult);
      });

      // Remove duplicates from the main localActions array
      result.localActions = [...new Set(result.localActions)];

      return result;
    } catch (error) {
      console.error('Error parsing workflow YAML:', error);
      return {
        hasLocalActions: false,
        localActions: [],
        totalSteps: 0,
        jobs: [],
        error: error.message
      };
    }
  }

  /**
   * Determines if an action reference is a local action
   * @param {string} actionRef - The action reference from the uses field
   * @returns {boolean} True if it's a local action
   */
  isLocalAction(actionRef) {
    if (!actionRef || typeof actionRef !== 'string') {
      return false;
    }

    // Local actions start with ./ or just .
    return actionRef.startsWith('./') || actionRef === '.';
  }

  /**
   * Validates a workflow YAML for syntax errors
   * @param {string} workflowContent - The YAML content
   * @returns {Object} Validation result
   */
  validateWorkflow(workflowContent) {
    try {
      const workflow = yaml.load(workflowContent);
      return {
        isValid: true,
        workflow: workflow,
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        workflow: null,
        error: error.message
      };
    }
  }

  /**
   * Gets detailed information about all actions used in a workflow
   * @param {string} workflowContent - The YAML content
   * @returns {Object} Detailed action information
   */
  getActionDetails(workflowContent) {
    const analysis = this.analyzeWorkflow(workflowContent);
    
    if (analysis.error) {
      return analysis;
    }

    const actions = {
      local: [],
      external: [],
      marketplace: [],
      docker: []
    };

    analysis.jobs.forEach(job => {
      job.steps.forEach(step => {
        if (step.actionPath) {
          const actionInfo = {
            path: step.actionPath,
            jobName: job.name,
            stepName: step.name,
            stepIndex: step.index
          };

          if (this.isLocalAction(step.actionPath)) {
            actions.local.push(actionInfo);
          } else if (step.actionPath.startsWith('docker://')) {
            actions.docker.push(actionInfo);
          } else if (step.actionPath.includes('/')) {
            // External GitHub action (org/repo@version format)
            actions.external.push(actionInfo);
          } else {
            // Marketplace action
            actions.marketplace.push(actionInfo);
          }
        }
      });
    });

    return {
      ...analysis,
      actionBreakdown: actions,
      summary: {
        totalActions: actions.local.length + actions.external.length + 
                     actions.marketplace.length + actions.docker.length,
        localCount: actions.local.length,
        externalCount: actions.external.length,
        marketplaceCount: actions.marketplace.length,
        dockerCount: actions.docker.length
      }
    };
  }
}

module.exports = WorkflowAnalyzer;
