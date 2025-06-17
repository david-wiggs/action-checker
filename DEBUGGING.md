# Webhook Signature Debugging Guide

This guide helps you troubleshoot the webhook signature mismatch error.

## 🚨 Error: "signature does not match event payload and secret"

### Step 1: Verify GitHub App Configuration

1. Go to your GitHub App settings: https://github.com/settings/apps
2. Click on your "Local Action Checker" app
3. Check the **Webhook URL** should be: `https://your-domain.com/` (root URL, not `/webhook`)
4. Verify the **Webhook Secret** matches exactly: `ch33z3burg3r`

### Step 2: Check Environment Variables

Run this command to verify your environment:
```bash
node test-webhook.js
```

This will show:
- Your current webhook secret
- A test signature generation
- Expected signature format

### Step 3: Test Webhook Signature Locally

You can test webhook signatures using curl:

```bash
# Generate a test signature
SECRET="ch33z3burg3r"
PAYLOAD='{"action":"test"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Test the webhook endpoint
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: test" \
  -H "X-GitHub-Delivery: 12345" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

### Step 4: Enable Debug Logging

The updated server now includes detailed logging. When you receive a webhook, you'll see:

```
Webhook received at root path
Headers: {
  'x-github-delivery': '...',
  'x-github-event': '...',
  'x-hub-signature-256': '...',
  'content-type': '...'
}
```

### Step 5: Common Issues and Solutions

#### Issue 1: Wrong Webhook URL
**Problem**: GitHub App still pointing to `/webhook` endpoint
**Solution**: Update webhook URL to just your domain root

#### Issue 2: Secret Mismatch
**Problem**: GitHub App secret ≠ environment variable
**Solution**: Regenerate webhook secret in GitHub App and update `.env`

#### Issue 3: Content-Type Issues
**Problem**: GitHub sends `application/json` but body isn't parsed correctly
**Solution**: We've added raw body parsing middleware

#### Issue 4: Environment Variables Not Loaded
**Problem**: `.env` file not loaded properly
**Solution**: Ensure `.env` is in project root and `dotenv` is configured

### Step 6: Regenerate Webhook Secret (If Needed)

1. Go to GitHub App settings
2. In "Webhook" section, click "Generate new webhook secret"
3. Copy the new secret
4. Update your `.env` file:
   ```
   GITHUB_WEBHOOK_SECRET=your_new_secret_here
   ```
5. Restart your application

### Step 7: Test with Real GitHub Event

1. Create a test repository
2. Set up environment protection rules
3. Trigger a deployment
4. Check your app logs for detailed webhook information

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

### Still Having Issues?

1. Check GitHub App installation is active
2. Verify repository has environment protection rules enabled
3. Ensure your app has correct permissions:
   - Actions: Read
   - Contents: Read  
   - Environments: Write
4. Test with a simple HTTP client first
5. Check GitHub App's "Advanced" tab for delivery attempts and errors
