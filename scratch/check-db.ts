import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Checking DB connection...");
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // 1. Get one fundraiser and one event to use as FK references
  const { data: fundraisers } = await supabaseAdmin.from("fundraisers").select("id, slug").limit(1);
  const { data: events } = await supabaseAdmin.from("events").select("id, slug").limit(1);
  
  console.log("Fundraiser:", fundraisers?.[0]);
  console.log("Event:", events?.[0]);
  
  if (!fundraisers?.[0] || !events?.[0]) {
    console.error("Could not find fundraiser or event for testing.");
    return;
  }
  
  // 2. Check if we can insert pending donation with payment_method: crypto
  console.log("Testing insert into donations...");
  const tempDonationId = "00000000-0000-0000-0000-000000000001";
  const { data: donationData, error: donationError } = await supabaseAdmin
    .from("donations")
    .insert({
      id: tempDonationId,
      fundraiser_id: fundraisers[0].id,
      donor_name: "Test Donor",
      donor_email: "test@example.com",
      amount: 10.00,
      currency: "USD",
      status: "pending",
      payment_method: "crypto",
      payment_intent_id: "test-crypto-intent-1"
    })
    .select();
    
  if (donationError) {
    console.error("Donation insert error:", donationError);
  } else {
    console.log("Donation insert success:", donationData);
    // Cleanup
    await supabaseAdmin.from("donations").delete().eq("id", tempDonationId);
  }
  
  // 3. Check if we can insert pending ticket order
  console.log("Testing insert into ticket_orders...");
  const tempOrderId = "00000000-0000-0000-0000-000000000002";
  const { data: orderData, error: orderError } = await supabaseAdmin
    .from("ticket_orders")
    .insert({
      id: tempOrderId,
      event_id: events[0].id,
      buyer_name: "Test Buyer",
      buyer_email: "buyer@example.com",
      quantity: 1,
      total_amount: 15.00,
      currency: "usd",
      qr_code: "test-crypto-qr-123456",
      status: "pending",
      stripe_payment_intent_id: "test-crypto-intent-ticket"
    })
    .select();
    
  if (orderError) {
    console.error("Ticket order insert error:", orderError);
  } else {
    console.log("Ticket order insert success:", orderData);
    // Cleanup
    await supabaseAdmin.from("ticket_orders").delete().eq("id", tempOrderId);
  }
}

main().catch(console.error);
