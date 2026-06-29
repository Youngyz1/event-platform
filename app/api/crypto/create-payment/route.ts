import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const {
      amount,
      currency = "usd",
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

    const numAmount = Number(amount);
    if (!type || !numAmount || numAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment details: type and amount are required." },
        { status: 400 }
      );
    }

    if (!process.env.NOWPAYMENTS_API_KEY) {
      return NextResponse.json(
        { error: "NOWPayments is not configured on the server." },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const ipnCallbackUrl = `${baseUrl}/api/crypto/webhook`;
    const successUrl = `${baseUrl}/crypto-pending?paymentId={payment_id}`;

    // Create NOWPayments invoice
    let cancelUrl = baseUrl;
    let orderDescription = "";
    let fundraiserId: string | null = null;
    let eventSlug = "";

    if (type === "donation") {
      if (!fundraiserSlug) {
        return NextResponse.json({ error: "fundraiserSlug is required for donations." }, { status: 400 });
      }
      
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
      
      // Look up event slug for cancel_url
      const { data: event, error: eventErr } = await supabaseAdmin
        .from("events")
        .select("slug, title")
        .eq("id", eventId)
        .maybeSingle();

      if (eventErr || !event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      eventSlug = event.slug;
      cancelUrl = `${baseUrl}/events/${eventSlug}?cancelled=true`;
      orderDescription = `Ticket order for "${event.title}"`;
    } else {
      return NextResponse.json({ error: "Invalid type. Must be donation or ticket." }, { status: 400 });
    }

    const orderId = crypto.randomUUID();

    // Call NOWPayments API to create invoice
    const nowpaymentsRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": process.env.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: numAmount,
        price_currency: currency.toLowerCase(),
        order_id: orderId,
        order_description: orderDescription,
        ipn_callback_url: ipnCallbackUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    const nowpaymentsData = await nowpaymentsRes.json();
    if (!nowpaymentsRes.ok || !nowpaymentsData.invoice_url) {
      console.error("NOWPayments invoice error:", nowpaymentsData);
      return NextResponse.json(
        { error: nowpaymentsData.message || "Failed to create NOWPayments invoice." },
        { status: 502 }
      );
    }

    const paymentId = String(nowpaymentsData.id);
    const paymentUrl = nowpaymentsData.invoice_url;

    // Save pending record in Supabase
    if (type === "donation") {
      const { error: insertError } = await supabaseAdmin.from("donations").insert({
        fundraiser_id: fundraiserId,
        donor_name: anonymous ? "Anonymous" : (donorName || "Anonymous"),
        donor_email: donorEmail || null,
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
      const safeQuantity = Math.max(1, Number(quantity) || 1);

      // Reserve seat if applicable
      if (seatId) {
        const { data: seatData, error: seatCheckError } = await supabaseAdmin
          .from("seats")
          .select("status")
          .eq("id", seatId)
          .single();

        if (seatCheckError || seatData?.status !== "available") {
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
    console.error("create-payment route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
