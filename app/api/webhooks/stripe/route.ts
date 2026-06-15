import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordDonationFromSession } from "@/lib/donations";

// Service role: bypasses RLS — admin operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
}

async function sendTicketEmail(params: {
  buyerEmail: string;
  buyerName: string;
  eventTitle: string;
  eventSlug: string;
  qrCode: string;
  seatLabel: string | null;
  isFree: boolean;
  base: string;
}) {
  try {
    await fetch(`${params.base}/api/send-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerEmail: params.buyerEmail,
        buyerName: params.buyerName,
        eventTitle: params.eventTitle,
        eventSlug: params.eventSlug,
        qrCode: params.qrCode,
        seatLabel: params.seatLabel,
        isFree: params.isFree,
      }),
    });
  } catch (err) {
    console.error("[webhook] Failed to send ticket email:", err);
  }
}

// ── payment_intent.succeeded ──────────────────────────────────────────────────
// Handles BOTH inline ticket purchases AND inline donations.
// (checkout.session.completed still handles legacy Stripe Checkout Sessions)

async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
  req: NextRequest
) {
  const meta = pi.metadata ?? {};
  const kind = meta.kind;

  // ── Ticket order (inline PaymentElement flow) ─────────────────────────────
  if (kind === "ticket") {
    const { event_id, qr_code } = meta;

    if (!event_id || !qr_code) {
      console.error("[webhook] Ticket intent missing event_id or qr_code:", meta);
      return;
    }

    // Idempotency: skip if a ticket_orders row already exists for this intent
    const { data: existing } = await supabaseAdmin
      .from("ticket_orders")
      .select("id")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();

    if (existing) {
      console.log("[webhook] Ticket order already exists for intent:", pi.id);
      return;
    }

    const qty = parseInt(meta.quantity) || 1;
    const totalAmount = parseFloat(meta.total_amount) || pi.amount / 100;

    const { error: insertError } = await supabaseAdmin
      .from("ticket_orders")
      .insert({
        event_id: meta.event_id,
        ticket_id: meta.ticket_id || null,
        seat_id: meta.seat_id || null,
        seat_label: meta.seat_label || null,
        buyer_email: meta.buyer_email || null,
        buyer_name: meta.buyer_name || null,
        quantity: qty,
        total_amount: totalAmount,
        currency: meta.currency ?? pi.currency ?? "usd",
        qr_code,
        status: "valid",
        stripe_payment_intent_id: pi.id,
      });

    if (insertError) {
      console.error("[webhook] ticket_orders insert error:", insertError.message);
    }

    // Mark seat as sold
    if (meta.seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({ status: "sold", reserved_until: null })
        .eq("id", meta.seat_id);
    }

    // Send ticket confirmation email
    const recipientEmail = meta.buyer_email;
    if (recipientEmail) {
      await sendTicketEmail({
        buyerEmail: recipientEmail,
        buyerName: meta.buyer_name || "",
        eventTitle: meta.event_title || "",
        eventSlug: meta.event_slug || "",
        qrCode: qr_code,
        seatLabel: meta.seat_label || null,
        isFree: false,
        base: baseUrl(req),
      });
    }

    return;
  }

  // ── Donation (inline PaymentElement flow) ─────────────────────────────────
  if (kind === "donation" && meta.fundraiser_id) {
    // Idempotency: skip if donation already recorded for this intent
    const { data: existing } = await supabaseAdmin
      .from("donations")
      .select("id")
      .eq("payment_intent_id", pi.id)
      .maybeSingle();

    if (existing) {
      console.log("[webhook] Donation already recorded for intent:", pi.id);
      return;
    }

    const { error: insertError } = await supabaseAdmin.from("donations").insert({
      fundraiser_id: meta.fundraiser_id,
      donor_name: meta.donor_name || "Anonymous",
      donor_email: meta.donor_email || null,
      message: meta.message || null,
      // Use the donation_amount (without tip), not the total charged
      amount: parseFloat(meta.donation_amount) || pi.amount / 100,
      currency: (meta.currency ?? pi.currency ?? "usd").toUpperCase(),
      status: "completed",
      payment_intent_id: pi.id,
    });

    if (insertError) {
      console.error("[webhook] donations insert error:", insertError.message);
    } else {
      const { recalculateFundraiserRaised } = await import("@/lib/donations");
      await recalculateFundraiserRaised(meta.fundraiser_id);
    }

    return;
  }
}

// ── checkout.session.completed ────────────────────────────────────────────────
// Kept to handle legacy Stripe Checkout Sessions (old ticket + donation flows).
// New flows use payment_intent.succeeded above.

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  req: NextRequest
) {
  const meta = session.metadata ?? {};

  // Legacy donation via Stripe Checkout
  if (meta.kind === "donation") {
    await recordDonationFromSession(session);
    return;
  }

  // Legacy ticket via Stripe Checkout
  const {
    qr_code,
    event_id,
    ticket_id,
    seat_id,
    seat_label,
    event_slug,
    event_title,
    quantity,
    buyer_name,
    buyer_email,
    total_amount,
  } = meta;

  if (!event_id || !qr_code) {
    console.error("[webhook] Missing ticket metadata in session:", meta);
    return;
  }

  // Idempotency: check by qr_code (session flow doesn't have payment_intent_id here)
  const { data: existing } = await supabaseAdmin
    .from("ticket_orders")
    .select("id")
    .eq("qr_code", qr_code)
    .maybeSingle();

  if (existing) {
    console.log("[webhook] Ticket order already exists for qr_code:", qr_code);
    return;
  }

  const { error: insertError } = await supabaseAdmin.from("ticket_orders").insert({
    event_id,
    ticket_id: ticket_id || null,
    seat_id: seat_id || null,
    seat_label: seat_label || null,
    buyer_email: buyer_email || session.customer_email || null,
    buyer_name: buyer_name || null,
    quantity: parseInt(quantity) || 1,
    total_amount: parseFloat(total_amount) || (session.amount_total ?? 0) / 100,
    currency: session.currency ?? "usd",
    qr_code,
    status: "valid",
    stripe_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  if (insertError) {
    console.error("[webhook] ticket_orders insert error:", insertError.message);
  }

  if (seat_id) {
    await supabaseAdmin
      .from("seats")
      .update({ status: "sold", reserved_until: null })
      .eq("id", seat_id);
  }

  const recipientEmail = buyer_email || session.customer_email;
  if (recipientEmail) {
    await sendTicketEmail({
      buyerEmail: recipientEmail,
      buyerName: buyer_name || "",
      eventTitle: event_title || "",
      eventSlug: event_slug || "",
      qrCode: qr_code,
      seatLabel: seat_label || null,
      isFree: false,
      base: baseUrl(req),
    });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe not configured." },
      { status: 500 }
    );
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
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      await handlePaymentIntentSucceeded(
        event.data.object as Stripe.PaymentIntent,
        req
      );
    } else if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        req
      );
    }
    // Silently acknowledge all other event types
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    // Return 200 to prevent Stripe retrying — log the error internally
  }

  return NextResponse.json({ received: true });
}
