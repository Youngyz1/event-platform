import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServer } from "@/lib/supabase-server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function insertDonationFromSession(session: Stripe.Checkout.Session) {
  const meta = session.metadata || {};
  const fundraiserId = meta.fundraiser_id;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.id;

  if (meta.kind !== "donation" || !fundraiserId) {
    return { inserted: false, reason: "not_donation" };
  }

  const { data: existing } = await supabaseAdmin
    .from("donations")
    .select("id")
    .eq("payment_intent_id", paymentIntentId)
    .single();

  if (existing) {
    return { inserted: false, reason: "exists" };
  }

  const amount = Number(meta.amount) || (session.amount_total ?? 0) / 100;
  const payload = {
    fundraiser_id: fundraiserId,
    donor_name: meta.donor_name || "Anonymous",
    donor_email: meta.donor_email || session.customer_email || null,
    amount,
    status: "succeeded",
    payment_intent_id: paymentIntentId,
  };

  const { error } = await supabaseAdmin.from("donations").insert(payload);

  if (error) {
    return { inserted: false, reason: error.message };
  }

  return { inserted: true, reason: "inserted" };
}

export async function POST() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Sync is not configured." }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sessions = await stripe.checkout.sessions.list({ limit: 50 });
  let inserted = 0;
  const skipped: string[] = [];

  for (const session of sessions.data) {
    const result = await insertDonationFromSession(session);
    if (result.inserted) {
      inserted += 1;
    } else if (result.reason !== "not_donation" && result.reason !== "exists") {
      skipped.push(result.reason);
    }
  }

  return NextResponse.json({ inserted, skipped });
}
