# Deployment Guide

This guide will help you deploy the Local Action Checker GitHub App.

## Prerequisites

- Node.js 18 or higher
- A GitHub account with organization admin permissions
- A server or hosting platform (e.g., Railway, Heroku, AWS, DigitalOcean)

## Step 1: Create a GitHub App

1. Go to your GitHub organization settings
2. Navigate to "Developer settings" > "GitHub Apps"
3. Click "New GitHub App"
4. Fill in the required information:
   - **App name**: `Local Action Checker` (or your preferred name)
   - **Homepage URL**: Your app's homepage (can be your repository)
   - **Webhook URL**: `https://your-domain.com/webhook`
   - **Webhook secret**: Generate a random secret string

### Permissions

Set the following permissions for your GitHub App:

#### Repository permissions:
- **Actions**: Read
- **Contents**: Read
- **Environments**: Write
- **Metadata**: Read

#### Organization permissions:
- **Members**: Read (if you need organization-level features)

### Events

Subscribe to the following webhook events:
- **Deployment protection rule**

## Step 2: Generate and Download Private Key

1. After creating the app, scroll down to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file and keep it secure

## Step 3: Install the App

1. In your GitHub App settings, go to "Install App"
2. Install it on your organization or specific repositories
3. Note the installation ID from the URL

## Step 4: Deploy the Application

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

### Option B: Heroku

1. Install Heroku CLI
2. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```
3. Set environment variables:
   ```bash
   heroku config:set GITHUB_APP_ID=your_app_id
   heroku config:set GITHUB_PRIVATE_KEY="$(cat path/to/your/private-key.pem)"
   heroku config:set GITHUB_WEBHOOK_SECRET=your_webhook_secret
   heroku config:set ALLOW_LOCAL_ACTIONS=false
   ```
4. Deploy:
   ```bash
   git push heroku main
   ```

### Option C: Docker

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

## Step 5: Configure Environment Protection Rules

1. Go to your repository settings
2. Navigate to "Environments"
3. Create or edit an environment (e.g., "production")
4. Under "Deployment protection rules", add your GitHub App
5. The app will now be called whenever a deployment to this environment is requested

## Step 6: Test the Setup

1. Create a workflow that deploys to your protected environment
2. Include a local action (e.g., `uses: ./my-action`)
3. Trigger the workflow
4. The deployment should be blocked by your app
5. Check the app logs to see the analysis results

## Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GITHUB_APP_ID` | Yes | Your GitHub App ID | - |
| `GITHUB_PRIVATE_KEY` | Yes | Your GitHub App private key (PEM format) | - |
| `GITHUB_WEBHOOK_SECRET` | Yes | Webhook secret for verifying requests | - |
| `PORT` | No | Port to run the server on | 3000 |
| `ALLOW_LOCAL_ACTIONS` | No | Whether to allow local actions | false |
| `NODE_ENV` | No | Node environment | development |

## Monitoring and Logs

- Check `/health` endpoint for basic health monitoring
- Monitor application logs for webhook events and analysis results
- Set up alerts for webhook failures or analysis errors

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Verify webhook URL is correct and accessible
   - Check webhook secret matches
   - Ensure app has correct permissions

2. **Authentication errors**
   - Verify GitHub App ID is correct
   - Check private key format (should include headers/footers)
   - Ensure app is installed on the repository

3. **Permission errors**
   - Verify app has required permissions
   - Check if app is installed on the organization/repository
   - Ensure environment protection rules are configured

### Debug Mode

Set `NODE_ENV=development` for more verbose logging.

## Security Considerations

- Keep your private key secure and never commit it to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your webhook secret
- Monitor app usage and access logs
- Consider implementing rate limiting for production use
