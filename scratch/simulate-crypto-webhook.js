/**
 * End-to-end test of the crypto webhook's kind-tag dispatch fix.
 *
 * Creates one synthetic pending row per kind (donation, ticket_order,
 * business) tied to real FK targets, fires signed NOWPayments-style IPN
 * payloads at the local dev server for each — plus one untagged legacy
 * payload to prove the fallback path still works — verifies each row
 * updated correctly, then deletes everything it created and restores
 * fundraisers.raised (a full recompute, so deleting the test donation and
 * recalculating erases the test amount exactly).
 *
 * Run with: node scratch/simulate-crypto-webhook.js
 * Requires the dev server running on localhost:3000.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

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

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const NOWPAYMENTS_IPN_SECRET = env.NOWPAYMENTS_IPN_SECRET;
const WEBHOOK_URL = 'http://localhost:3000/api/crypto/webhook';

if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
if (!NOWPAYMENTS_IPN_SECRET) throw new Error('NOWPAYMENTS_IPN_SECRET missing from .env.local');

const FUNDRAISER_ID = '647bdfd3-53cc-4f36-8061-a1251b0f04e9';
const EVENT_ID = 'ead2bd2c-71b9-403d-ad12-50224c71442d';
const BUSINESS_OWNER_ID = 'd78362ce-acc7-45b4-afdd-9c53efbac71b';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function signBody(body) {
  const sortedKeys = Object.keys(body).sort();
  const sortedString = JSON.stringify(body, sortedKeys);
  return crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET).update(sortedString).digest('hex');
}

async function postWebhook(body) {
  const sig = signBody(body);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-nowpayments-sig': sig },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, data };
}

function pass(label) { console.log(`  ✓ PASS  ${label}`); }
function fail(label, detail) { console.log(`  ✗ FAIL  ${label}${detail ? ' — ' + detail : ''}`); }

async function main() {
  const results = [];

  // ── Setup: create one synthetic pending row per kind ──────────────────────
  const { data: donation, error: donationErr } = await supabase
    .from('donations')
    .insert({
      fundraiser_id: FUNDRAISER_ID,
      donor_name: 'Webhook Test',
      donor_email: null, // no email → no real Resend send
      amount: 0.01,
      currency: 'USD',
      status: 'pending',
      payment_intent_id: 'test-crypto-donation-placeholder',
      payment_method: 'crypto',
    })
    .select('id')
    .single();
  if (donationErr) throw new Error('Failed to create test donation: ' + donationErr.message);

  const { data: ticketOrder, error: ticketErr } = await supabase
    .from('ticket_orders')
    .insert({
      event_id: EVENT_ID,
      buyer_email: null, // no email → no real Resend send
      buyer_name: 'Webhook Test',
      quantity: 1,
      total_amount: 0.01,
      currency: 'usd',
      qr_code: `TESTQR-CRYPTOWEBHOOK-${Date.now()}`,
      status: 'pending',
      stripe_payment_intent_id: 'test-crypto-ticket-placeholder',
      payment_method: 'crypto',
    })
    .select('id')
    .single();
  if (ticketErr) throw new Error('Failed to create test ticket order: ' + ticketErr.message);

  const businessCryptoPaymentId = `test-crypto-business-corr-${Date.now()}`;
  const { data: business, error: businessErr } = await supabase
    .from('businesses')
    .insert({
      owner_id: BUSINESS_OWNER_ID,
      name: 'Webhook Test Business',
      slug: `webhook-test-business-${Date.now()}`,
      description: 'Synthetic business row created to test the crypto webhook kind-tag fix end to end.',
      industry: 'Testing',
      category: 'Testing',
      listing_tier: 'one_time',
      status: 'pending_payment',
      crypto_payment_id: businessCryptoPaymentId,
    })
    .select('id, crypto_payment_id')
    .single();
  if (businessErr) throw new Error('Failed to create test business: ' + businessErr.message);

  console.log('Created test rows:');
  console.log('  donation      id =', donation.id);
  console.log('  ticket_order  id =', ticketOrder.id);
  console.log('  business      id =', business.id, ' crypto_payment_id =', business.crypto_payment_id);
  console.log('');

  // ── Case 1: tagged donation ────────────────────────────────────────────────
  console.log('Case 1: tagged donation payload');
  const r1 = await postWebhook({
    invoice_id: 'test-invoice-donation',
    payment_id: 'test-payment-donation',
    payment_status: 'finished',
    order_id: `donation:${donation.id}`,
  });
  console.log('  HTTP', r1.httpStatus, JSON.stringify(r1.data));
  const { data: donationAfter } = await supabase.from('donations').select('status').eq('id', donation.id).single();
  console.log('  donations.status after webhook =', donationAfter.status);
  if (donationAfter.status === 'completed') pass('donation flipped to completed');
  else fail('donation status', `expected completed, got ${donationAfter.status}`);
  results.push(['tagged donation', donationAfter.status === 'completed']);
  console.log('');

  // ── Case 2: tagged ticket ───────────────────────────────────────────────────
  console.log('Case 2: tagged ticket payload');
  const r2 = await postWebhook({
    invoice_id: 'test-invoice-ticket',
    payment_id: 'test-payment-ticket',
    payment_status: 'finished',
    order_id: `ticket:${ticketOrder.id}`,
  });
  console.log('  HTTP', r2.httpStatus, JSON.stringify(r2.data));
  const { data: ticketAfter } = await supabase.from('ticket_orders').select('status').eq('id', ticketOrder.id).single();
  console.log('  ticket_orders.status after webhook =', ticketAfter.status);
  if (ticketAfter.status === 'valid') pass('ticket order flipped to valid');
  else fail('ticket order status', `expected valid, got ${ticketAfter.status}`);
  results.push(['tagged ticket', ticketAfter.status === 'valid']);
  console.log('');

  // ── Case 3: tagged business ─────────────────────────────────────────────────
  console.log('Case 3: tagged business payload');
  const r3 = await postWebhook({
    invoice_id: 'test-invoice-business',
    payment_id: 'test-payment-business',
    payment_status: 'finished',
    order_id: `business:${business.crypto_payment_id}`,
  });
  console.log('  HTTP', r3.httpStatus, JSON.stringify(r3.data));
  const { data: businessAfter } = await supabase.from('businesses').select('status, current_period_end').eq('id', business.id).single();
  console.log('  businesses.status after webhook =', businessAfter.status);
  if (businessAfter.status === 'active') pass('business flipped to active');
  else fail('business status', `expected active, got ${businessAfter.status}`);
  results.push(['tagged business', businessAfter.status === 'active']);
  console.log('');

  // ── Case 4: legacy untagged fallback (bare donation id, no kind prefix) ────
  // Reuses the SAME donation row (already completed) to prove the legacy path
  // still resolves an untagged order_id correctly — it should find the row
  // via the fallback probe and log "already in status: completed" rather
  // than erroring or silently doing nothing.
  console.log('Case 4: legacy untagged payload (bare donation id, no kind prefix)');
  const r4 = await postWebhook({
    invoice_id: 'test-invoice-legacy',
    payment_id: 'test-payment-legacy',
    payment_status: 'finished',
    order_id: donation.id, // no "donation:" prefix — simulates a pre-fix invoice
  });
  console.log('  HTTP', r4.httpStatus, JSON.stringify(r4.data));
  const legacyOk = r4.httpStatus === 200 && r4.data && r4.data.received === true;
  if (legacyOk) pass('legacy untagged payload accepted (check server log for the fallback warning + "already in status: completed")');
  else fail('legacy untagged payload', `unexpected response`);
  results.push(['legacy untagged fallback', legacyOk]);
  console.log('');

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log('Cleaning up test rows...');
  await supabase.from('donations').delete().eq('id', donation.id);
  await supabase.from('ticket_orders').delete().eq('id', ticketOrder.id);
  await supabase.from('businesses').delete().eq('id', business.id);

  // fundraisers.raised is a full recompute in recalculateFundraiserRaised,
  // so recomputing it here after deleting the test donation restores the
  // true value exactly (no drift left behind).
  const { data: remaining } = await supabase
    .from('donations')
    .select('amount, status')
    .eq('fundraiser_id', FUNDRAISER_ID);
  const trueTotal = (remaining || []).reduce((sum, d) => {
    return d.status === 'completed' || d.status === 'succeeded' ? sum + Number(d.amount || 0) : sum;
  }, 0);
  await supabase.from('fundraisers').update({ raised: trueTotal }).eq('id', FUNDRAISER_ID);
  console.log('  Deleted test donation, ticket_order, business rows.');
  console.log('  Restored fundraisers.raised to', trueTotal);
  console.log('');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('=== SUMMARY ===');
  for (const [label, ok] of results) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  }
  const allPassed = results.every(([, ok]) => ok);
  console.log(allPassed ? '\nAll cases passed.' : '\nSOME CASES FAILED — see above.');
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
