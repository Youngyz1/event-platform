import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { processDonationCertificate } from "@/lib/certificate";
import { processDonationReceipt } from "@/lib/receipt";
import { recalculateFundraiserRaised } from "@/lib/donations";

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function verifySignature(reqBody: any, signature: string, ipnSecret: string) {
  try {
    const sortedKeys = Object.keys(reqBody).sort();
    const sortedString = JSON.stringify(reqBody, sortedKeys);
    const hmac = crypto.createHmac("sha512", ipnSecret);
    hmac.update(sortedString);
    const calculatedSignature = hmac.digest("hex");
    return calculatedSignature === signature;
  } catch (err) {
    console.error("Signature verification helper error:", err);
    return false;
  }
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
    console.error("[crypto webhook] Failed to send ticket email:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("x-nowpayments-sig");

    if (!sig) {
      return NextResponse.json({ error: "Missing x-nowpayments-sig header." }, { status: 400 });
    }

    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      return NextResponse.json({ error: "NOWPayments webhook is not configured." }, { status: 500 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const isValid = verifySignature(body, sig, process.env.NOWPAYMENTS_IPN_SECRET);
    if (!isValid) {
      console.warn("[crypto webhook] Signature verification failed. Sig:", sig);
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const { invoice_id, payment_id, payment_status, order_id } = body;
    console.log(`[crypto webhook] Received IPN callback: invoice=${invoice_id}, payment=${payment_id}, status=${payment_status}, order_id=${order_id}`);

    const isConfirmed = payment_status === "finished" || payment_status === "confirmed";

    if (isConfirmed) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;

      // 1. Check if this is a donation (match by order_id UUID or legacy invoice_id)
      let donation: any = null;
      if (order_id || invoice_id) {
        let donationQuery = supabaseAdmin.from("donations").select("*");
        if (order_id && invoice_id) {
          donationQuery = donationQuery.or(`id.eq.${order_id},payment_intent_id.eq.${invoice_id}`);
        } else if (order_id) {
          donationQuery = donationQuery.eq("id", order_id);
        } else {
          donationQuery = donationQuery.eq("payment_intent_id", String(invoice_id));
        }
        const { data } = await donationQuery.maybeSingle();
        donation = data;
      }

      if (donation) {
        if (donation.status === "pending") {
          // Update status to completed
          const { error: updateError } = await supabaseAdmin
            .from("donations")
            .update({
              status: "completed",
              payment_intent_id: payment_id ? String(payment_id) : donation.payment_intent_id, // Update with payment ID if available
            })
            .eq("id", donation.id);

          if (updateError) {
            console.error("[crypto webhook] Failed to update donation status:", updateError.message);
          } else {
            console.log(`[crypto webhook] Donation ${donation.id} updated to completed`);

            // If message exists, insert approved comment
            if (donation.message && donation.message.trim()) {
              const { error: commentError } = await supabaseAdmin.from("comments").insert({
                target_type: "fundraiser",
                target_id: donation.fundraiser_id,
                author_name: donation.donor_name || "Anonymous",
                author_email: donation.donor_email || null,
                body: donation.message.trim(),
                status: "approved",
              });
              if (commentError) {
                console.error("[crypto webhook] Comment insert error:", commentError.message);
              }
            }

            // Recalculate fundraiser raised
            await recalculateFundraiserRaised(donation.fundraiser_id);

            // Generate receipt and certificate
            processDonationReceipt(donation.id).catch((err) =>
              console.error("[crypto webhook] Receipt generation error:", err)
            );
            processDonationCertificate(donation.id).catch((err) =>
              console.error("[crypto webhook] Certificate generation error:", err)
            );
          }
        } else {
          console.log(`[crypto webhook] Donation ${donation.id} is already in status: ${donation.status}`);
        }
      }

      // 2. Check if this is a ticket order (match by order_id UUID or legacy invoice_id)
      let order: any = null;
      if (order_id || invoice_id) {
        let orderQuery = supabaseAdmin.from("ticket_orders").select("*");
        if (order_id && invoice_id) {
          orderQuery = orderQuery.or(`id.eq.${order_id},stripe_payment_intent_id.eq.${invoice_id}`);
        } else if (order_id) {
          orderQuery = orderQuery.eq("id", order_id);
        } else {
          orderQuery = orderQuery.eq("stripe_payment_intent_id", String(invoice_id));
        }
        const { data } = await orderQuery.maybeSingle();
        order = data;
      }

      if (order) {
        if (order.status === "pending") {
          // Update status to valid
          const { error: updateError } = await supabaseAdmin
            .from("ticket_orders")
            .update({
              status: "valid",
              stripe_payment_intent_id: payment_id ? String(payment_id) : order.stripe_payment_intent_id, // Update with payment ID if available
            })
            .eq("id", order.id);

          if (updateError) {
            console.error("[crypto webhook] Failed to update ticket order status:", updateError.message);
          } else {
            console.log(`[crypto webhook] Ticket order ${order.id} updated to valid`);

            // Sell the seat if reserved
            if (order.seat_id) {
              await supabaseAdmin
                .from("seats")
                .update({ status: "sold", reserved_until: null })
                .eq("id", order.seat_id);
            }

            // Fetch event details to send email
            const { data: event } = await supabaseAdmin
              .from("events")
              .select("title, slug")
              .eq("id", order.event_id)
              .maybeSingle();

            if (event && order.buyer_email) {
              await sendTicketEmail({
                buyerEmail: order.buyer_email,
                buyerName: order.buyer_name || "",
                eventTitle: event.title,
                eventSlug: event.slug,
                qrCode: order.qr_code,
                seatLabel: order.seat_label,
                isFree: false,
                base: baseUrl,
              });
            }
          }
        } else {
          console.log(`[crypto webhook] Ticket order ${order.id} is already in status: ${order.status}`);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("crypto webhook route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
