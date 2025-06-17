# GitHub App Environment Protection Rule - Local Action Checker

This GitHub App acts as an environment protection rule that evaluates workflow files to determine if they use local GitHub Actions (actions referenced with `./` in the `uses:` field). It automatically blocks or allows deployments based on configurable rules for local action usage.

## 🏗️ How It Works

1. When a deployment requires environment protection, GitHub sends a webhook
2. The app fetches the workflow file being executed
3. It parses the YAML and checks for any `uses:` fields starting with `./`
4. Dynamic workflows (code scanning) are automatically ignored
5. Based on the configuration, it approves or rejects the deployment
6. The decision is sent back to GitHub via the deployment protection rule API

## 🌟 Features

- **Webhook handler** for environment protection rule events
- **Analyzes workflow files** for local action usage patterns
- **Configurable approval/rejection** based on local action detection
- **Dynamic workflow filtering** - ignores GitHub's code scanning workflows
- **Comprehensive logging** for debugging and monitoring
- **CLI tool** for local testing and analysis
- **Docker support** with health checks

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Test a workflow locally:**
   ```bash
   npm run analyze examples/workflow-with-local-actions.yml
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

## 📋 Table of Contents

- [Local Action Detection Rules](#local-action-detection-rules)
- [GitHub App Setup](#github-app-setup)
- [Deployment Guide](#deployment-guide)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Testing & Development](#testing--development)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## 🔍 Local Action Detection Rules

The analyzer identifies the following patterns as **local actions**:
- `uses: ./path/to/action` - Relative path actions
- `uses: .` - Current directory action
- Any `uses:` value starting with `./`

The following are **NOT** considered local actions:
- `uses: actions/checkout@v4` - GitHub marketplace actions
- `uses: org/repo@version` - External GitHub actions
- `uses: docker://image:tag` - Docker actions

**Dynamic workflows** (containing `dynamic/github-code-scanning/codeql`) are automatically ignored and require no approval/rejection.

### Deployment Scenarios

#### Scenario 1: Block Local Actions (Default)
```bash
ALLOW_LOCAL_ACTIONS=false
```
- Workflows with local actions will be **rejected**
- Workflows without local actions will be **approved**

#### Scenario 2: Allow Local Actions
```bash
ALLOW_LOCAL_ACTIONS=true
```
- All workflows will be **approved**
- Local actions will be logged but not blocked

## 🛠️ GitHub App Setup

### Prerequisites

- Node.js 18 or higher
- A GitHub account with organization admin permissions
- A server or hosting platform to deploy the app

### Step 1: Create a GitHub App

1. Go to your GitHub organization settings
2. Navigate to "Developer settings" > "GitHub Apps"
3. Click "New GitHub App"
4. Fill in the required information:
   - **App name**: `Local Action Checker` (or your preferred name)
   - **Homepage URL**: Your app's homepage (can be your repository)
   - **Webhook URL**: `https://your-domain.com/` (root URL of your deployed app)
   - **Webhook secret**: Generate a random secret string

#### Required Permissions

Set the following permissions for your GitHub App:

**Repository permissions:**
- **Actions**: Read
- **Contents**: Read
- **Deployments**: Read/Write
- **Metadata**: Read


#### Webhook Events

Subscribe to:
- **Deployment protection rule**

### Step 2: Generate and Download Private Key

1. After creating the app, scroll down to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file and keep it secure

### Step 3: Install the App

1. In your GitHub App settings, go to "Install App"
2. Install it on your organization or specific repositories

## 🚀 Deployment Guide

### Option A: Railway (Recommended)

1. Fork this repository
2. Connect Railway to your GitHub account
3. Create a new project from your forked repository
4. Set the following environment variables:
   ```
   GITHUB_APP_ID=your_app_id
   GITHUB_PRIVATE_KEY=your_private_key_content
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ALLOW_LOCAL_ACTIONS=false
   PORT=3000
   ```

### Option B: Docker

1. Build the Docker image:
   ```bash
   docker build -t local-action-checker .
   ```
2. Run the container:
   ```bash
   docker run -p 3000:3000 \
     -e GITHUB_APP_ID=your_app_id \
     -e GITHUB_PRIVATE_KEY="$(cat path/to/your/private-key.pem)" \
     -e GITHUB_WEBHOOK_SECRET=your_webhook_secret \
     -e ALLOW_LOCAL_ACTIONS=false \
     local-action-checker
   ```

### Step 4: Configure Environment Protection Rules

1. Go to your repository settings
2. Navigate to "Environments"
3. Create or edit an environment (e.g., "production")
4. Under "Deployment protection rules", add your GitHub App
5. The app will now be called whenever a deployment to this environment is requested

## ⚙️ Configuration

### Required Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GITHUB_APP_ID` | Yes | Your GitHub App ID | - |
| `GITHUB_PRIVATE_KEY` | Yes | Your GitHub App private key (PEM format) | - |
| `GITHUB_WEBHOOK_SECRET` | Yes | Webhook secret for verifying requests | - |

### Optional Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Port to run the server on | 3000 |
| `ALLOW_LOCAL_ACTIONS` | No | Whether to allow local actions | false |

### Example Configuration

Create a `.env` file:

```bash
# GitHub App Credentials
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here

# Server Configuration
PORT=3000

# App Configuration
ALLOW_LOCAL_ACTIONS=false
```

## 🔌 API Endpoints

- `POST /` - Primary webhook endpoint for GitHub events
- `POST /webhook` - Legacy webhook endpoint (for backward compatibility)
- `GET /` - App information and status
- `GET /health` - Health check endpoint

## 🧪 Testing & Development

### CLI Tool

Use the included CLI tool to test workflow analysis locally:

```bash
# Test a workflow file
node cli.js path/to/workflow.yml

# Test with local actions allowed
ALLOW_LOCAL_ACTIONS=true node cli.js path/to/workflow.yml

# Use npm script
npm run analyze examples/workflow-with-local-actions.yml
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Development Server

```bash
# Start with file watching
npm run dev
```

### Test Webhook Signatures

```bash
# Test webhook signature generation
node test-webhook.js
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Webhook Signature Mismatch

**Error**: `signature does not match event payload and secret`

**Solutions**:
1. Verify webhook URL is correct: `https://your-domain.com/` (root URL, not `/webhook`)
2. Check webhook secret matches exactly in GitHub App settings
3. Ensure app has correct permissions
4. Test webhook signature locally:
   ```bash
   node test-webhook.js
   ```

#### 2. Authentication Errors

**Solutions**:
- Verify GitHub App ID is correct
- Check private key format (should include headers/footers)
- Ensure app is installed on the repository

#### 3. Permission Errors

**Solutions**:
- Verify app has required permissions
- Check if app is installed on the organization/repository
- Ensure environment protection rules are configured

#### 4. 404 Errors on Deployment Approval/Rejection

**Solutions**:
- Check that the workflow run ID is correctly extracted
- Verify the API endpoint format
- Ensure the app has Environment Write permissions

### Debug Mode

Set `NODE_ENV=development` for more verbose logging.

### Debug Output Example

When working correctly, you should see:
```
✅ Environment variables validated
📱 GitHub App ID: 1415688
🔐 Webhook Secret: Set
🔑 Private Key: Set (1678 chars)
Webhook received at root path
Headers: { ... }
Deployment protection rule requested: { ... }
```

### Log Monitoring

Key log messages to monitor:
- `Deployment protection rule requested` - New deployment request
- `Deployment approved` - Deployment was allowed
- `Deployment rejected` - Deployment was blocked
- `Webhook error` - Error processing webhook
- `Error parsing workflow YAML` - Invalid workflow file

## 🔒 Security Considerations

### Private Key Security
- Never commit private keys to version control
- Use environment variables or secure secret management
- Rotate keys regularly

### Webhook Security
- Use a strong webhook secret
- Verify webhook signatures
- Use HTTPS endpoints only


### Access Control
- Limit GitHub App installation scope
- Review app permissions regularly
- Monitor app usage through GitHub's audit logs

## 📊 Monitoring and Alerting

- Check `/health` endpoint for basic health monitoring
- Monitor application logs for webhook events and analysis results
- Set up alerts for webhook failures or analysis errors

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run the test suite
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.


