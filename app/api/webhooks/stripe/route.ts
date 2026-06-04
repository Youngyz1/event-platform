import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function donationExists(paymentIntentId: string) {
  const { data, error } = await supabaseAdmin
    .from("donations")
    .select("id")
    .eq("payment_intent_id", paymentIntentId)
    .single();

  if (error && error.code === "42703") return false;
  return Boolean(data);
}

async function insertDonation(session: Stripe.Checkout.Session, meta: Stripe.Metadata) {
  const fundraiserId = meta.fundraiser_id;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.id;

  if (!fundraiserId) {
    console.error("Missing fundraiser metadata in donation webhook:", meta);
    return;
  }

  if (await donationExists(paymentIntentId)) return;

  const amount = Number(meta.amount) || (session.amount_total ?? 0) / 100;
  const fullPayload = {
    fundraiser_id: fundraiserId,
    donor_name: meta.donor_name || "Anonymous",
    donor_email: meta.donor_email || session.customer_email || null,
    amount,
    currency: session.currency?.toUpperCase() || "USD",
    status: "succeeded",
    payment_intent_id: paymentIntentId,
  };

  const { error } = await supabaseAdmin.from("donations").insert(fullPayload);

  if (!error) return;

  console.error("Donation insert error:", error.message);

  const { error: fallbackError } = await supabaseAdmin.from("donations").insert({
    fundraiser_id: fullPayload.fundraiser_id,
    donor_name: fullPayload.donor_name,
    donor_email: fullPayload.donor_email,
    amount: fullPayload.amount,
    status: fullPayload.status,
    payment_intent_id: fullPayload.payment_intent_id,
  });

  if (fallbackError) console.error("Donation fallback insert error:", fallbackError.message);
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};

    if (meta.kind === "donation") {
      await insertDonation(session, meta);
      return NextResponse.json({ received: true });
    }

    const {
      qr_code, event_id, ticket_id, seat_id, seat_label,
      event_slug, event_title, quantity, buyer_name, buyer_email, total_amount,
    } = meta;

    if (!event_id || !qr_code) {
      console.error("Missing ticket metadata in webhook:", meta);
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const { data: existing } = await supabaseAdmin
      .from("ticket_orders")
      .select("id")
      .eq("qr_code", qr_code)
      .single();

    if (!existing) {
      const { error: insertError } = await supabaseAdmin.from("ticket_orders").insert({
        event_id,
        ticket_id: ticket_id || null,
        seat_id: seat_id || null,
        seat_label: seat_label || null,
        buyer_email: buyer_email || session.customer_email || null,
        buyer_name: buyer_name || null,
        quantity: parseInt(quantity) || 1,
        total_amount: parseFloat(total_amount) || (session.amount_total ?? 0) / 100,
        qr_code,
        status: "valid",
        stripe_session_id: session.id,
      });

      if (insertError) console.error("Insert error:", insertError.message);
    }

    if (seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({ status: "sold", reserved_until: null })
        .eq("id", seat_id);
    }

    const recipientEmail = buyer_email || session.customer_email;
    if (recipientEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/send-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: recipientEmail,
          buyerName: buyer_name || "",
          eventTitle: event_title || "",
          eventSlug: event_slug || "",
          qrCode: qr_code,
          seatLabel: seat_label || null,
          isFree: false,
        }),
      });
    }
  }

  return NextResponse.json({ received: true });
}
