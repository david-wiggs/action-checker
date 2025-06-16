# Local Action Checker Configuration

This file documents the configuration options available for the Local Action Checker GitHub App.

## Core Configuration

### Required Environment Variables

```bash
# Your GitHub App ID (found in app settings)
GITHUB_APP_ID=123456

# Your GitHub App private key (PEM format)
# Include the full key with headers and footers
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"

# Webhook secret for verifying incoming requests
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
```

### Optional Environment Variables

```bash
# Server port (default: 3000)
PORT=3000

# Whether to allow deployments with local actions (default: false)
# Set to "true" to approve workflows with local actions
ALLOW_LOCAL_ACTIONS=false

# Node.js environment (development/production)
NODE_ENV=development
```

## Advanced Configuration

### Logging Levels

The app uses console logging. In development mode (`NODE_ENV=development`), you'll see more verbose output.

### Webhook Events

The app listens for the following GitHub webhook events:
- `deployment_protection_rule.requested`

### API Permissions Required

Your GitHub App needs these permissions:
- **Repository permissions:**
  - Actions: Read
  - Contents: Read
  - Environments: Write
  - Metadata: Read

## Local Action Detection Rules

The analyzer considers the following patterns as local actions:
- `uses: ./path/to/action` - Relative path actions
- `uses: .` - Current directory action
- Any `uses:` value starting with `./`

The following are NOT considered local actions:
- `uses: actions/checkout@v4` - GitHub marketplace actions
- `uses: org/repo@version` - External GitHub actions
- `uses: docker://image:tag` - Docker actions

## Environment Protection Setup

1. Go to repository Settings > Environments
2. Create or edit an environment
3. Under "Deployment protection rules", select your GitHub App
4. The app will be called before any deployment to this environment

## Deployment Scenarios

### Scenario 1: Block Local Actions (Default)
```bash
ALLOW_LOCAL_ACTIONS=false
```
- Workflows with local actions will be **rejected**
- Workflows without local actions will be **approved**

### Scenario 2: Allow Local Actions
```bash
ALLOW_LOCAL_ACTIONS=true
```
- All workflows will be **approved**
- Local actions will be logged but not blocked

## Testing Your Configuration

Use the included CLI tool to test workflow analysis:

```bash
# Test a workflow file
node cli.js path/to/workflow.yml

# Test with local actions allowed
ALLOW_LOCAL_ACTIONS=true node cli.js path/to/workflow.yml
```

## Monitoring and Alerting

### Health Check Endpoint
```
GET /health
```
Returns JSON with status and timestamp.

### Webhook Endpoint
```
POST /webhook
```
Receives GitHub webhook events.

### Log Monitoring

Key log messages to monitor:
- `Deployment protection rule requested` - New deployment request
- `Deployment approved` - Deployment was allowed
- `Deployment rejected` - Deployment was blocked
- `Webhook error` - Error processing webhook
- `Error parsing workflow YAML` - Invalid workflow file

## Security Best Practices

1. **Private Key Security**
   - Never commit private keys to version control
   - Use environment variables or secure secret management
   - Rotate keys regularly

2. **Webhook Security**
   - Use a strong webhook secret
   - Verify webhook signatures
   - Use HTTPS endpoints only

3. **Network Security**
   - Run app behind a reverse proxy if possible
   - Implement rate limiting for production
   - Monitor for unusual webhook activity

4. **Access Control**
   - Limit GitHub App installation scope
   - Review app permissions regularly
   - Monitor app usage through GitHub's audit logs
