import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};

    const {
      qr_code,
      event_id,
      ticket_id,
      seat_id,
      seat_label,
      event_slug,
      event_title,
      ticket_name,
      quantity,
      buyer_name,
      buyer_email,
      total_amount,
    } = meta;

    if (!event_id || !qr_code) {
      console.error("Missing metadata in webhook:", meta);
      return NextResponse.json({ error: "Missing metadata." }, { status: 400 });
    }

    // Check order doesn't already exist (idempotency)
    const { data: existing } = await supabaseAdmin
      .from("ticket_orders")
      .select("id")
      .eq("qr_code", qr_code)
      .single();

    if (!existing) {
      // Create the confirmed order
      await supabaseAdmin.from("ticket_orders").insert({
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
    }

    // Mark seat as sold
    if (seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({ status: "sold", reserved_until: null })
        .eq("id", seat_id);
    }

    // Send ticket email
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