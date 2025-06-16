const WorkflowAnalyzer = require('../src/workflow-analyzer');

describe('WorkflowAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new WorkflowAnalyzer();
  });

  describe('isLocalAction', () => {
    test('should identify local actions starting with ./', () => {
      expect(analyzer.isLocalAction('./my-action')).toBe(true);
      expect(analyzer.isLocalAction('./path/to/action')).toBe(true);
    });

    test('should identify single dot as local action', () => {
      expect(analyzer.isLocalAction('.')).toBe(true);
    });

    test('should not identify external actions as local', () => {
      expect(analyzer.isLocalAction('actions/checkout@v4')).toBe(false);
      expect(analyzer.isLocalAction('docker://alpine:latest')).toBe(false);
      expect(analyzer.isLocalAction('github/super-linter@v4')).toBe(false);
    });

    test('should handle invalid inputs', () => {
      expect(analyzer.isLocalAction(null)).toBe(false);
      expect(analyzer.isLocalAction(undefined)).toBe(false);
      expect(analyzer.isLocalAction('')).toBe(false);
      expect(analyzer.isLocalAction(123)).toBe(false);
    });
  });

  describe('analyzeWorkflow', () => {
    test('should detect local actions in workflow', () => {
      const workflowContent = `
name: Test Workflow
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Local Action
        uses: ./my-local-action
      - name: Another Local Action
        uses: ./path/to/action
`;

      const result = analyzer.analyzeWorkflow(workflowContent);
      
      expect(result.hasLocalActions).toBe(true);
      expect(result.localActions).toContain('./my-local-action');
      expect(result.localActions).toContain('./path/to/action');
      expect(result.totalSteps).toBe(3);
      expect(result.jobs).toHaveLength(1);
    });

    test('should handle workflow without local actions', () => {
      const workflowContent = `
name: Test Workflow
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v3
`;

      const result = analyzer.analyzeWorkflow(workflowContent);
      
      expect(result.hasLocalActions).toBe(false);
      expect(result.localActions).toHaveLength(0);
      expect(result.totalSteps).toBe(2);
    });

    test('should handle multiple jobs', () => {
      const workflowContent = `
name: Multi Job Workflow
on: [push]
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - name: Local Action in Job 1
        uses: ./action1
  job2:
    runs-on: ubuntu-latest
    steps:
      - name: External Action
        uses: actions/checkout@v4
      - name: Local Action in Job 2
        uses: ./action2
`;

      const result = analyzer.analyzeWorkflow(workflowContent);
      
      expect(result.hasLocalActions).toBe(true);
      expect(result.localActions).toContain('./action1');
      expect(result.localActions).toContain('./action2');
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].hasLocalActions).toBe(true);
      expect(result.jobs[1].hasLocalActions).toBe(true);
    });

    test('should handle invalid YAML', () => {
      const invalidYaml = `
invalid: yaml: content:
  - this is not: valid
    yaml: [unclosed bracket
`;

      const result = analyzer.analyzeWorkflow(invalidYaml);
      
      expect(result.hasLocalActions).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle empty workflow', () => {
      const result = analyzer.analyzeWorkflow('');
      
      expect(result.hasLocalActions).toBe(false);
      expect(result.localActions).toHaveLength(0);
      expect(result.totalSteps).toBe(0);
    });
  });

  describe('getActionDetails', () => {
    test('should categorize different types of actions', () => {
      const workflowContent = `
name: Action Types Test
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Local Action
        uses: ./my-action
      - name: Docker Action
        uses: docker://alpine:latest
      - name: Third Party Action
        uses: github/super-linter@v4
`;

      const result = analyzer.getActionDetails(workflowContent);
      
      expect(result.actionBreakdown.local).toHaveLength(1);
      expect(result.actionBreakdown.external).toHaveLength(2);
      expect(result.actionBreakdown.docker).toHaveLength(1);
      expect(result.summary.totalActions).toBe(4);
      expect(result.summary.localCount).toBe(1);
    });
  });
});
