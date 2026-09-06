import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/lib/rate-limit";
import { internalError } from "@/lib/api-error";
import {
  clientPriceContradicts,
  resolveTicketPrice,
  validateTicketQuantity,
} from "@/lib/ticket-pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});

function generateQRCode(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
        { status: 500 }
      );
    }

    // Unauthenticated endpoint, so IP is the only available identity.
    // Checked before the Stripe PaymentIntent call below.
    const limited = await enforceRateLimit("paymentIntent", req);
    if (limited) return limited;

    const body = await req.json();
    // NOTE (C1): ticketPrice / currency / ticketName / eventTitle / eventSlug
    // from the client are NEVER authoritative. Identifiers (eventId, ticketId,
    // seatId, quantity) are resolved against the database below and the Stripe
    // amount is computed exclusively from the trusted DB unit price.
    // ticketPrice is accepted only for contradiction detection (clear 400 on
    // obvious tampering probes) and is never used in any computation.
    const {
      ticketPrice: clientTicketPrice,
      eventId,
      ticketId,
      seatId,
      seatLabel,
      quantity,
      buyerEmail,
      buyerName,
      // UUID generated on the client at the moment the user clicks "Continue".
      // A fresh UUID is created for every new checkout attempt, preventing
      // StripeIdempotencyError when the user goes back and tries again.
      checkoutAttemptId,
    } = body;

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "eventId is required." },
        { status: 400 }
      );
    }

    if (!ticketId || typeof ticketId !== "string") {
      return NextResponse.json(
        { error: "ticketId is required." },
        { status: 400 }
      );
    }

    const qtyCheck = validateTicketQuantity(quantity);
    if (!qtyCheck.ok) {
      return NextResponse.json({ error: qtyCheck.error }, { status: 400 });
    }
    const qty = qtyCheck.quantity;

    // Trusted price lookup (service-role: ticket/event rows are not
    // client-readable at authoritative granularity).
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let ticket: {
      id: string;
      event_id: string | null;
      name: string | null;
      price: number | null;
      quantity: number | null;
    } | null = null;
    let event: { id: string; slug: string | null; title: string | null } | null =
      null;
    let seat: {
      id: string;
      event_id: string;
      status: string;
      price_override: number | null;
      ticket_id: string | null;
    } | null = null;

    try {
      const [{ data: ticketData }, { data: eventData }] = await Promise.all([
        supabaseAdmin
          .from("tickets")
          .select("id, event_id, name, price, quantity")
          .eq("id", ticketId)
          .maybeSingle(),
        supabaseAdmin
          .from("events")
          .select("id, slug, title")
          .eq("id", eventId)
          .maybeSingle(),
      ]);
      ticket = ticketData;
      event = eventData;

      if (seatId && typeof seatId === "string" && seatId.length > 0) {
        const { data: seatData } = await supabaseAdmin
          .from("seats")
          .select("id, event_id, status, price_override, ticket_id")
          .eq("id", seatId)
          .maybeSingle();
        seat = seatData;
        // A seat bound to a different ticket cannot be used with this ticket.
        if (seat && seat.ticket_id && seat.ticket_id !== ticketId) {
          return NextResponse.json(
            { error: "Seat is no longer available." },
            { status: 400 }
          );
        }
      }
    } catch (err) {
      // migration_65_remove_events_and_tickets dropped these tables. A missing
      // relation (42P01) means ticket sales are retired, not free.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("42P01") || message.toLowerCase().includes("does not exist")) {
        return NextResponse.json(
          { error: "Ticket sales are no longer available." },
          { status: 410 }
        );
      }
      console.error("[create-payment-intent] price lookup failed");
      return NextResponse.json(
        { error: "Could not verify ticket price. Please try again." },
        { status: 500 }
      );
    }

    if (!ticket || !event) {
      return NextResponse.json(
        { error: !event ? "Event not found." : "Ticket not found for this event." },
        { status: 404 }
      );
    }

    const resolved = resolveTicketPrice({
      ticket,
      event,
      seat,
      eventId,
      quantity: qty,
    });
    if (!resolved.ok) {
      const status =
        resolved.code === "ticket_not_found" || resolved.code === "event_not_found"
          ? 404
          : 400;
      return NextResponse.json({ error: resolved.error }, { status });
    }
    const trusted = resolved.value;

    // Contradictory client price: reject loudly so tampering probes get a
    // clear signal instead of silently paying the real price. Absent or
    // matching values proceed (the client value is still never used).
    if (clientPriceContradicts(clientTicketPrice, trusted.unitPrice)) {
      return NextResponse.json(
        { error: "Ticket price mismatch. Please refresh and try again." },
        { status: 400 }
      );
    }

    const totalAmount = trusted.totalCents;
    const currency = trusted.currency;

    // Generate QR code here so the webhook can use it to create the order
    const qrCode = generateQRCode();

    // Idempotency key: use the client-supplied UUID so that:
    //  • Refreshing the review page with the same UUID reuses the existing intent
    //  • Going back and clicking Continue again generates a new UUID → new intent
    // Fall back to a deterministic key only if no UUID is supplied (legacy callers).
    const idempotencyKey =
      checkoutAttemptId && typeof checkoutAttemptId === "string"
        ? `ticket-intent-${checkoutAttemptId}`
        : `ticket-${eventId}-${ticketId ?? "noid"}-${qty}-${Date.now()}`;

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        receipt_email: buyerEmail || undefined,
        metadata: {
          // Identifies this intent as a ticket purchase for the webhook
          kind: "ticket",
          // Pre-generated QR — written to ticket_orders by the webhook
          qr_code: qrCode,
          event_id: eventId ?? "",
          event_slug: trusted.eventSlug ?? "",
          event_title: trusted.eventTitle ?? "",
          ticket_id: ticketId ?? "",
          ticket_name: trusted.ticketName ?? "",
          seat_id: seatId ?? "",
          seat_label: seatLabel ?? "",
          quantity: String(qty),
          unit_price: String(trusted.unitPrice),
          total_amount: String((totalAmount / 100).toFixed(2)),
          currency: currency.toLowerCase(),
          buyer_email: buyerEmail ?? "",
          buyer_name: buyerName ?? "",
        },
      },
      { idempotencyKey }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      qrCode, // returned so the success screen can show it immediately
    });
  } catch (err) {
    return internalError("create-payment-intent", err);
  }
}