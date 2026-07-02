import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordDonationFromSession } from "@/lib/donations";
import { processDonationReceipt } from "@/lib/receipt";
import { processDonationCertificate } from "@/lib/certificate";
import { Resend } from "resend";

// Service role: bypasses RLS — admin operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
}

export async function notifyOrganizerOfTicketPurchase(params: {
  eventId: string;
  buyerName: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  base: string;
}) {
  try {
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("title, organizer_id, user_id")
      .eq("id", params.eventId)
      .maybeSingle();

    if (!event) return;

    let ownerUserId = event.user_id;
    if (event.organizer_id) {
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("user_id")
        .eq("id", event.organizer_id)
        .maybeSingle();
      if (organizer?.user_id) {
        ownerUserId = organizer.user_id;
      }
    }

    if (!ownerUserId) return;

    const [profileRes, userRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", ownerUserId)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(ownerUserId),
    ]);

    const preferences = profileRes.data?.preferences as Record<string, any> | null;
    const email = userRes.data?.user?.email;
    const notify = preferences?.notify_ticket_purchase !== false;

    if (notify && email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Fund4Good <contact@fund4agoodcause.com>",
        to: email,
        subject: `New ticket purchase for ${event.title} 🎟️`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:32px;text-align:center;">
                        <p style="margin:0;color:#c7d2fe;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Fund4Good Alerts</p>
                        <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:900;">New Ticket Purchase! 🎟️</h1>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:32px;">
                        <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.6;">
                          Hi Organizer,
                        </p>
                        <p style="margin:0 0 24px;color:#18181b;font-size:16px;line-height:1.6;">
                          Great news! Someone just purchased ticket(s) for your event: <strong>${event.title}</strong>.
                        </p>
                        <!-- Order Details table -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;margin-bottom:24px;padding:20px;">
                          <tr>
                            <td style="padding:4px 0;color:#71717a;font-size:14px;"><strong>Buyer:</strong></td>
                            <td style="padding:4px 0;color:#18181b;font-size:14px;text-align:right;">${params.buyerName || "Anonymous"}</td>
                          </tr>
                          <tr>
                            <td style="padding:4px 0;color:#71717a;font-size:14px;"><strong>Quantity:</strong></td>
                            <td style="padding:4px 0;color:#18181b;font-size:14px;text-align:right;">${params.quantity}</td>
                          </tr>
                          <tr>
                            <td style="padding:4px 0;color:#71717a;font-size:14px;"><strong>Total Revenue:</strong></td>
                            <td style="padding:4px 0;color:#10b981;font-size:14px;font-weight:700;text-align:right;">$${params.totalAmount.toFixed(2)} ${params.currency.toUpperCase()}</td>
                          </tr>
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding-bottom:12px;">
                              <a href="${params.base}/dashboard"
                                style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;">
                                Go to Creator Dashboard
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background:#fafafa;border-top:1px solid #f4f4f5;padding:20px 32px;text-align:center;">
                        <p style="margin:0;color:#a1a1aa;font-size:12px;">
                          Fund4Good Alerts · You received this because your ticket purchase alerts are turned on.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });
    }
  } catch (err) {
    console.error("[webhook] Failed to notify organizer of ticket purchase:", err);
  }
}

export async function notifyOrganizerOfDonation(params: {
  fundraiserId: string;
  donorName: string;
  amount: number;
  currency: string;
  message: string | null;
  base: string;
}) {
  try {
    const { data: fundraiser } = await supabaseAdmin
      .from("fundraisers")
      .select("title, organizer_id, user_id")
      .eq("id", params.fundraiserId)
      .maybeSingle();

    if (!fundraiser) return;

    let ownerUserId = fundraiser.user_id;
    if (fundraiser.organizer_id) {
      const { data: organizer } = await supabaseAdmin
        .from("organizers")
        .select("user_id")
        .eq("id", fundraiser.organizer_id)
        .maybeSingle();
      if (organizer?.user_id) {
        ownerUserId = organizer.user_id;
      }
    }

    if (!ownerUserId) return;

    const [profileRes, userRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", ownerUserId)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(ownerUserId),
    ]);

    const preferences = profileRes.data?.preferences as Record<string, any> | null;
    const email = userRes.data?.user?.email;
    const notify = preferences?.notify_donation !== false;

    if (notify && email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Fund4Good <contact@fund4agoodcause.com>",
        to: email,
        subject: `New donation received for ${fundraiser.title} 💚`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center;">
                        <p style="margin:0;color:#a7f3d0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Fund4Good Alerts</p>
                        <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:900;">New Donation Received! 💚</h1>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:32px;">
                        <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.6;">
                          Hi Organizer,
                        </p>
                        <p style="margin:0 0 24px;color:#18181b;font-size:16px;line-height:1.6;">
                          Congratulations! You received a new donation for your campaign: <strong>${fundraiser.title}</strong>.
                        </p>
                        <!-- Donation Details table -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;margin-bottom:24px;padding:20px;">
                          <tr>
                            <td style="padding:4px 0;color:#71717a;font-size:14px;"><strong>Donor:</strong></td>
                            <td style="padding:4px 0;color:#18181b;font-size:14px;text-align:right;">${params.donorName || "Anonymous"}</td>
                          </tr>
                          <tr>
                            <td style="padding:4px 0;color:#71717a;font-size:14px;"><strong>Amount:</strong></td>
                            <td style="padding:4px 0;color:#10b981;font-size:14px;font-weight:700;text-align:right;">$${params.amount.toFixed(2)} ${params.currency.toUpperCase()}</td>
                          </tr>
                          ${params.message ? `
                          <tr>
                            <td colspan="2" style="padding-top:12px;border-top:1px solid #e4e4e7;color:#71717a;font-size:14px;">
                              <strong>Message:</strong><br/>
                              <span style="display:block;margin-top:6px;color:#18181b;font-style:italic;">"${params.message}"</span>
                            </td>
                          </tr>
                          ` : ""}
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding-bottom:12px;">
                              <a href="${params.base}/dashboard"
                                style="display:inline-block;background:#10b981;color:#ffffff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:50px;text-decoration:none;">
                                Go to Creator Dashboard
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="background:#fafafa;border-top:1px solid #f4f4f5;padding:20px 32px;text-align:center;">
                        <p style="margin:0;color:#a1a1aa;font-size:12px;">
                          Fund4Good Alerts · You received this because your donation alerts are turned on.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });
    }
  } catch (err) {
    console.error("[webhook] Failed to notify organizer of donation:", err);
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
    console.error("[webhook] Failed to send ticket email:", err);
  }
}

// ── payment_intent.succeeded ──────────────────────────────────────────────────

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

    // pi.charges is an expandable field — cast to avoid TS error on the unexpanded type
    const piAny = pi as unknown as Record<string, unknown>;
    const chargesList = piAny.charges as { data?: { billing_details?: { email?: string | null; name?: string | null } }[] } | undefined;
    const firstCharge = chargesList?.data?.[0];

    const recipientEmail = meta.buyer_email ||
      pi.receipt_email ||
      firstCharge?.billing_details?.email ||
      null;

    const recipientName = meta.buyer_name ||
      firstCharge?.billing_details?.name ||
      "";

    const { error: insertError } = await supabaseAdmin
      .from("ticket_orders")
      .insert({
        event_id: meta.event_id,
        ticket_id: meta.ticket_id || null,
        seat_id: meta.seat_id || null,
        seat_label: meta.seat_label || null,
        buyer_email: recipientEmail,
        buyer_name: recipientName || null,
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

    if (meta.seat_id) {
      await supabaseAdmin
        .from("seats")
        .update({ status: "sold", reserved_until: null })
        .eq("id", meta.seat_id);
    }

    if (recipientEmail) {
      await sendTicketEmail({
        buyerEmail: recipientEmail,
        buyerName: recipientName,
        eventTitle: meta.event_title || "",
        eventSlug: meta.event_slug || "",
        qrCode: qr_code,
        seatLabel: meta.seat_label || null,
        isFree: false,
        base: baseUrl(req),
      });
    }

    await notifyOrganizerOfTicketPurchase({
      eventId: event_id,
      buyerName: recipientName,
      quantity: qty,
      totalAmount,
      currency: meta.currency ?? pi.currency ?? "usd",
      base: baseUrl(req),
    });

    return;
  }

  // ── Donation (inline PaymentElement flow) ─────────────────────────────────
  if (kind === "donation" && meta.fundraiser_id) {
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
      amount: parseFloat(meta.donation_amount) || pi.amount / 100,
      currency: (meta.currency ?? pi.currency ?? "usd").toUpperCase(),
      status: "completed",
      payment_intent_id: pi.id,
    });

    if (insertError) {
      console.error("[webhook] donations insert error:", insertError.message);
    } else {
      if (meta.message && meta.message.trim()) {
        const { error: commentError } = await supabaseAdmin.from("comments").insert({
          target_type: "fundraiser",
          target_id: meta.fundraiser_id,
          author_name: meta.donor_name || "Anonymous",
          author_email: meta.donor_email || null,
          body: meta.message.trim(),
          status: "approved",
        });
        if (commentError) {
          console.error("[webhook] comment insert error:", commentError.message);
        }
      }

      const { recalculateFundraiserRaised } = await import("@/lib/donations");
      await recalculateFundraiserRaised(meta.fundraiser_id);

      const { data: newDonation } = await supabaseAdmin
        .from("donations")
        .select("id")
        .eq("payment_intent_id", pi.id)
        .maybeSingle();

      if (newDonation?.id) {
        processDonationReceipt(newDonation.id).catch((err) =>
          console.error("[webhook] Receipt generation error:", err)
        );
        processDonationCertificate(newDonation.id).catch((err) =>
          console.error("[webhook] Certificate generation error:", err)
        );
      }

      await notifyOrganizerOfDonation({
        fundraiserId: meta.fundraiser_id,
        donorName: meta.donor_name || "Anonymous",
        amount: parseFloat(meta.donation_amount) || pi.amount / 100,
        currency: (meta.currency ?? pi.currency ?? "usd").toUpperCase(),
        message: meta.message || null,
        base: baseUrl(req),
      });
    }

    return;
  }
}

// ── checkout.session.completed ────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  req: NextRequest
) {
  const meta = session.metadata ?? {};

  if (meta.kind === "donation") {
    await recordDonationFromSession(session);

    const piId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;
    if (piId) {
      const { data: donation } = await supabaseAdmin
        .from("donations")
        .select("id, fundraiser_id, donor_name, amount, currency, message")
        .eq("payment_intent_id", piId)
        .maybeSingle();

      if (donation) {
        processDonationReceipt(donation.id).catch((err) =>
          console.error("[webhook] Legacy receipt generation error:", err)
        );
        processDonationCertificate(donation.id).catch((err) =>
          console.error("[webhook] Legacy certificate generation error:", err)
        );

        await notifyOrganizerOfDonation({
          fundraiserId: donation.fundraiser_id,
          donorName: donation.donor_name || "Anonymous",
          amount: Number(donation.amount),
          currency: donation.currency || "USD",
          message: donation.message || null,
          base: baseUrl(req),
        });
      }
    }

    return;
  }

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

  await notifyOrganizerOfTicketPurchase({
    eventId: event_id,
    buyerName: buyer_name || "",
    quantity: parseInt(quantity) || 1,
    totalAmount: parseFloat(total_amount) || (session.amount_total ?? 0) / 100,
    currency: session.currency ?? "usd",
    base: baseUrl(req),
  });
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
  } catch (err) {
    console.error("[webhook] Handler error:", err);
  }

  return NextResponse.json({ received: true });
}