import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";
import { tagCryptoOrderId, getNowPaymentsConfig } from "@/lib/cryptoPayment";
import {
  TICKET_CURRENCY,
  clientPriceContradicts,
  resolveTicketPrice,
  validateDonationAmount,
  validateDonationCurrency,
  validateTicketQuantity,
} from "@/lib/ticket-pricing";
import { internalError } from "@/lib/api-error";
import { enforceRateLimit } from "@/lib/rate-limit";

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateQRCode(): string {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createSupabaseServer();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    // H2: invoice creation is provider-billable — same budget class as Stripe
    // intents, keyed on user when signed in, else IP.
    const limited = await enforceRateLimit("cryptoPayment", req, userId);
    if (limited) return limited;
    const {
      amount: clientAmount,
      ticketPrice: clientTicketPrice,
      currency: clientCurrency,
      fundraiserSlug,
      eventId,
      donorName,
      donorEmail,
      type, // "donation" or "ticket"
      
      // Optional/Extra fields
      message,
      anonymous,
      ticketId,
      seatId,
      seatLabel,
      quantity = 1,
    } = body;

    if (!type || (type !== "donation" && type !== "ticket")) {
      return NextResponse.json(
        { error: "Invalid type. Must be donation or ticket." },
        { status: 400 }
      );
    }

    const nowPayments = getNowPaymentsConfig();
    if (!nowPayments.apiKey) {
      return NextResponse.json(
        { error: "NOWPayments is not configured on the server." },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://www.fund4agoodcause.com";
    const ipnCallbackUrl = `${baseUrl}/api/crypto/webhook`;

    // Create NOWPayments invoice
    // NOTE (C1): ticket pricing is NEVER taken from the client. Donations are
    // donor-chosen amounts validated below; tickets resolve to a trusted DB
    // unit price via resolveTicketPrice().
    let cancelUrl = baseUrl;
    let orderDescription = "";
    let fundraiserId: string | null = null;
    let eventSlug = "";
    // Trusted charge, resolved per branch below.
    let chargeAmount: number = 0;
    let chargeCurrency: string = TICKET_CURRENCY;
    let trustedQuantity = 1;

    if (type === "donation") {
      if (!fundraiserSlug) {
        return NextResponse.json({ error: "fundraiserSlug is required for donations." }, { status: 400 });
      }

      const amountCheck = validateDonationAmount(clientAmount);
      if (!amountCheck.ok) {
        return NextResponse.json({ error: amountCheck.error }, { status: 400 });
      }
      const currencyCheck = validateDonationCurrency(clientCurrency ?? "usd");
      if (!currencyCheck.ok) {
        return NextResponse.json({ error: currencyCheck.error }, { status: 400 });
      }
      chargeAmount = amountCheck.amount;
      chargeCurrency = currencyCheck.currency;
      
      // Look up fundraiser by slug
      const { data: fundraiser, error: fundErr } = await supabaseAdmin
        .from("fundraisers")
        .select("id, title")
        .eq("slug", fundraiserSlug)
        .maybeSingle();

      if (fundErr || !fundraiser) {
        return NextResponse.json({ error: "Fundraiser not found." }, { status: 404 });
      }

      fundraiserId = fundraiser.id;
      cancelUrl = `${baseUrl}/fundraisers/${fundraiserSlug}`;
      orderDescription = `Donation to "${fundraiser.title}"`;
    } else if (type === "ticket") {
      if (!eventId) {
        return NextResponse.json({ error: "eventId is required for ticket purchases." }, { status: 400 });
      }
      if (!ticketId || typeof ticketId !== "string") {
        return NextResponse.json({ error: "ticketId is required for ticket purchases." }, { status: 400 });
      }

      const qtyCheck = validateTicketQuantity(quantity);
      if (!qtyCheck.ok) {
        return NextResponse.json({ error: qtyCheck.error }, { status: 400 });
      }
      trustedQuantity = qtyCheck.quantity;

      // Trusted lookups. Events/tickets were removed by
      // migration_65_remove_events_and_tickets; a missing relation means the
      // feature is retired (410), never free.
      let ticket: {
        id: string;
        event_id: string | null;
        name: string | null;
        price: number | null;
        quantity: number | null;
      } | null = null;
      let event: { id: string; slug: string | null; title: string | null } | null =
        null;
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("42P01") || msg.toLowerCase().includes("does not exist")) {
          return NextResponse.json(
            { error: "Ticket sales are no longer available." },
            { status: 410 }
          );
        }
        throw err;
      }

      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
      if (!ticket) {
        return NextResponse.json({ error: "Ticket not found for this event." }, { status: 404 });
      }

      // Seat is fetched here for price/availability; the atomic
      // reserve (eq status available) happens below before insert.
      let seatForPricing: {
        id: string;
        event_id: string;
        status: string;
        price_override: number | null;
        ticket_id: string | null;
      } | null = null;
      if (seatId && typeof seatId === "string" && seatId.length > 0) {
        const { data: seatData } = await supabaseAdmin
          .from("seats")
          .select("id, event_id, status, price_override, ticket_id")
          .eq("id", seatId)
          .maybeSingle();
        seatForPricing = seatData;
        if (
          seatForPricing &&
          seatForPricing.ticket_id &&
          seatForPricing.ticket_id !== ticketId
        ) {
          return NextResponse.json({ error: "Seat is no longer available." }, { status: 400 });
        }
      }

      const resolved = resolveTicketPrice({
        ticket,
        event: { id: event.id, slug: event.slug, title: event.title },
        seat: seatForPricing,
        eventId,
        quantity: trustedQuantity,
      });
      if (!resolved.ok) {
        const status =
          resolved.code === "ticket_not_found" || resolved.code === "event_not_found"
            ? 404
            : 400;
        return NextResponse.json({ error: resolved.error }, { status });
      }

      if (clientPriceContradicts(clientAmount, resolved.value.unitPrice * trustedQuantity) ||
          clientPriceContradicts(clientTicketPrice, resolved.value.unitPrice)) {
        return NextResponse.json(
          { error: "Ticket price mismatch. Please refresh and try again." },
          { status: 400 }
        );
      }

      chargeAmount = resolved.value.total;
      chargeCurrency = resolved.value.currency;
      eventSlug = resolved.value.eventSlug;
      cancelUrl = `${baseUrl}/events/${eventSlug}?cancelled=true`;
      orderDescription = `Ticket order for "${resolved.value.eventTitle}"`;
    }

    const numAmount = chargeAmount;
    const currency = chargeCurrency;

    const orderId = crypto.randomUUID();

    // NOWPayments does NOT support placeholder syntax like {payment_id} in URLs.
    // Curly braces are invalid URI characters and will cause a validation error.
    // We use our own orderId (generated before the API call) so the success_url
    // is a fully-formed absolute URL that NOWPayments can validate.
    const successUrl = `${baseUrl}/crypto-pending?orderId=${orderId}`;

    // Validate URLs before sending to NOWPayments to surface misconfigurations early.
    try {
      new URL(successUrl);
      new URL(cancelUrl);
      new URL(ipnCallbackUrl);
    } catch (urlErr) {
      console.error("[create-payment] Invalid URL detected:", { successUrl, cancelUrl, ipnCallbackUrl }, urlErr);
      return NextResponse.json(
        { error: "Server misconfiguration: invalid callback URL." },
        { status: 500 }
      );
    }

    console.log("[create-payment] Calling NOWPayments with URLs:", {
      success_url: successUrl,
      cancel_url: cancelUrl,
      ipn_callback_url: ipnCallbackUrl,
    });

    // Call NOWPayments API to create invoice
    const nowpaymentsRes = await fetch(`${nowPayments.baseUrl}/invoice`, {
      method: "POST",
      headers: {
        "x-api-key": nowPayments.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: numAmount,
        price_currency: currency.toLowerCase(),
        // Tagged with the kind so the IPN webhook can dispatch to exactly
        // one table instead of probing donations/ticket_orders in sequence.
        // The row's own primary key (orderId) is untouched — only what we
        // send to NOWPayments carries the tag.
        order_id: tagCryptoOrderId(type === "donation" ? "donation" : "ticket", orderId),
        order_description: orderDescription,
        ipn_callback_url: ipnCallbackUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    const nowpaymentsData = await nowpaymentsRes.json();
    if (!nowpaymentsRes.ok || !nowpaymentsData.invoice_url) {
      // Provider detail stays server-side; callers get a generic upstream error.
      console.error("[crypto/create-payment] NOWPayments invoice failed");
      return NextResponse.json(
        { error: "Payment provider unavailable. Please try again." },
        { status: 502 }
      );
    }

    const paymentId = String(nowpaymentsData.id);
    const paymentUrl = nowpaymentsData.invoice_url;

    // Save pending record in Supabase
    if (type === "donation") {
      const { error: insertError } = await supabaseAdmin.from("donations").insert({
        id: orderId,
        fundraiser_id: fundraiserId,
        donor_name: anonymous ? "Anonymous" : (donorName || "Anonymous"),
        donor_email: donorEmail || null,
        user_id: userId,
        message: message || null,
        amount: numAmount,
        currency: currency.toUpperCase(),
        status: "pending",
        payment_intent_id: paymentId,
        payment_method: "crypto",
      });

      if (insertError) {
        console.error("Supabase donation insert error:", insertError);
        return NextResponse.json({ error: "Database error recording donation." }, { status: 500 });
      }
    } else if (type === "ticket") {
      const qrCode = generateQRCode();
      // Trusted quantity/total from resolveTicketPrice above — never the
      // client-supplied amount.
      const safeQuantity = trustedQuantity;

      // Reserve seat if applicable (atomic: only transitions available -> reserved)
      if (seatId) {
        const { data: seatData, error: seatCheckError } = await supabaseAdmin
          .from("seats")
          .select("id, event_id, status, ticket_id")
          .eq("id", seatId)
          .single();

        if (
          seatCheckError ||
          seatData?.status !== "available" ||
          (seatData?.event_id && seatData.event_id !== eventId) ||
          (seatData?.ticket_id && ticketId && seatData.ticket_id !== ticketId)
        ) {
          return NextResponse.json({ error: "Seat is no longer available." }, { status: 400 });
        }

        const { error: reserveError } = await supabaseAdmin
          .from("seats")
          .update({
            status: "reserved",
            reserved_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour for crypto confirmations
          })
          .eq("id", seatId)
          .eq("status", "available");

        if (reserveError) {
          console.error("Seat reservation error:", reserveError);
          return NextResponse.json({ error: "Failed to reserve seat." }, { status: 500 });
        }
      }

      const { error: insertError } = await supabaseAdmin.from("ticket_orders").insert({
        id: orderId,
        event_id: eventId,
        ticket_id: ticketId || null,
        seat_id: seatId || null,
        seat_label: seatLabel || null,
        buyer_email: donorEmail || null,
        buyer_name: donorName || null,
        quantity: safeQuantity,
        total_amount: numAmount,
        currency: currency.toLowerCase(),
        qr_code: qrCode,
        status: "pending",
        stripe_payment_intent_id: paymentId,
        payment_method: "crypto",
      });

      if (insertError) {
        console.error("Supabase ticket order insert error:", insertError);
        // Release seat if insert failed
        if (seatId) {
          await supabaseAdmin
            .from("seats")
            .update({ status: "available", reserved_until: null })
            .eq("id", seatId);
        }
        return NextResponse.json({ error: "Database error recording ticket order." }, { status: 500 });
      }
    }

    return NextResponse.json({ paymentUrl, paymentId });
  } catch (err: unknown) {
    return internalError("crypto/create-payment", err);
  }
}
