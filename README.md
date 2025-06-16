# GitHub App Environment Protection Rule - Local Action Checker

This GitHub App acts as an environment protection rule that evaluates workflow files to determine if they use local GitHub Actions (actions referenced with `./` in the `uses:` field).

## Features

- Webhook handler for environment protection rule events
- Analyzes workflow files for local action usage
- Provides approval/rejection based on local action detection
- Configurable rules and exemptions

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a GitHub App:
   - Go to GitHub Settings > Developer settings > GitHub Apps
   - Create a new GitHub App
   - Set the webhook URL to your deployed app endpoint
   - Enable the following permissions:
     - Repository permissions: Actions (read), Contents (read), Environments (write)
     - Subscribe to: Deployment protection rule events

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub App credentials
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Configuration

The app can be configured through environment variables:

- `GITHUB_APP_ID`: Your GitHub App ID
- `GITHUB_PRIVATE_KEY`: Your GitHub App private key (PEM format)
- `GITHUB_WEBHOOK_SECRET`: Webhook secret for verifying requests
- `PORT`: Port to run the webhook server (default: 3000)
- `ALLOW_LOCAL_ACTIONS`: Set to "true" to approve workflows with local actions (default: false)

## How it works

1. When a deployment requires environment protection, GitHub sends a webhook
2. The app fetches the workflow file being executed
3. It parses the YAML and checks for any `uses:` fields starting with `./`
4. Based on the configuration, it approves or rejects the deployment

## API Endpoints

- `POST /webhook` - GitHub webhook endpoint
- `GET /health` - Health check endpoint
