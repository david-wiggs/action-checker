#!/usr/bin/env node

const crypto = require('crypto');

/**
 * Test webhook signature generation
 * This helps debug webhook signature issues
 */

function generateSignature(payload, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  return `sha256=${signature}`;
}

function testWebhookSignature() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'ch33z3burg3r';
  const testPayload = JSON.stringify({
    action: 'test',
    repository: { full_name: 'test/repo' }
  });

  console.log('🧪 Webhook Signature Test');
  console.log('='.repeat(50));
  console.log(`Secret: ${secret}`);
  console.log(`Payload: ${testPayload}`);
  console.log(`Expected Signature: ${generateSignature(testPayload, secret)}`);
  console.log('='.repeat(50));
  
  // Test with different payload formats
  const payloadBuffer = Buffer.from(testPayload);
  console.log(`Buffer Signature: ${generateSignature(payloadBuffer, secret)}`);
  
  return {
    secret,
    payload: testPayload,
    signature: generateSignature(testPayload, secret)
  };
}

function verifySignature(payload, signature, secret) {
  const expectedSignature = generateSignature(payload, secret);
  return signature === expectedSignature;
}

if (require.main === module) {
  // Load environment if running directly
  require('dotenv').config();
  testWebhookSignature();
} else {
  module.exports = { generateSignature, verifySignature, testWebhookSignature };
}
