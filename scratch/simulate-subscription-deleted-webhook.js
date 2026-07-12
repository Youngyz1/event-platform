const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const secret = loadEnvLocal().STRIPE_WEBHOOK_SECRET;
if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing from .env.local');
const subscriptionId = 'sub_test_12345';

const payload = JSON.stringify({
  id: "evt_test_54321",
  object: "event",
  api_version: "2022-11-15",
  created: Math.floor(Date.now() / 1000),
  type: "customer.subscription.deleted",
  data: {
    object: {
      id: subscriptionId,
      object: "subscription",
      status: "canceled"
    }
  }
});

const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const signature = crypto
  .createHmac('sha256', secret)
  .update(signedPayload)
  .digest('hex');

const stripeSignature = `t=${timestamp},v1=${signature}`;

console.log('Sending webhook to http://localhost:3000/api/webhooks/stripe...');
console.log('Signature:', stripeSignature);

fetch('http://localhost:3000/api/webhooks/stripe', {
  method: 'POST',
  headers: {
    'stripe-signature': stripeSignature,
    'content-type': 'application/json'
  },
  body: payload
})
  .then(res => res.json().then(data => ({ status: res.status, data })))
  .then(res => {
    console.log(`HTTP Status: ${res.status}`);
    console.log('Response:', JSON.stringify(res.data));
  })
  .catch(err => {
    console.error('Error sending webhook:', err);
  });
