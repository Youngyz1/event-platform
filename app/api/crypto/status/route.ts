import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findRecordByInvoiceId(invoiceId: string) {
  // 1. Look up in donations
  const { data: donation } = await supabaseAdmin
    .from("donations")
    .select("id, status, fundraiser_id, fundraiser:fundraisers(slug)")
    .eq("payment_intent_id", invoiceId)
    .maybeSingle();

  if (donation) {
    return {
      id: donation.id,
      status: donation.status,
      type: "donation" as const,
      slug: (donation.fundraiser as any)?.slug || null,
      qrCode: null,
    };
  }

  // 2. Look up in ticket_orders
  const { data: order } = await supabaseAdmin
    .from("ticket_orders")
    .select("id, status, event_id, qr_code, event:events(slug)")
    .eq("stripe_payment_intent_id", invoiceId)
    .maybeSingle();

  if (order) {
    return {
      id: order.id,
      status: order.status,
      type: "ticket" as const,
      slug: (order.event as any)?.slug || null,
      qrCode: order.qr_code || null,
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId parameter." }, { status: 400 });
    }

    if (!process.env.NOWPAYMENTS_API_KEY) {
      return NextResponse.json({ error: "NOWPayments is not configured." }, { status: 500 });
    }

    // 1. Check if the paymentId matches directly (as invoice ID) in our database
    let record = await findRecordByInvoiceId(paymentId);
    if (record && (record.status === "completed" || record.status === "valid" || record.status === "succeeded")) {
      return NextResponse.json({
        status: "confirmed",
        type: record.type,
        recordId: record.id,
        slug: record.slug,
        qrCode: record.qrCode,
      });
    }

    // 2. Fetch status from NOWPayments GET /v1/payment/:id
    let nowpaymentsStatus = "waiting";
    let invoiceIdFromPayment = paymentId;

    const paymentRes = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
      headers: {
        "x-api-key": process.env.NOWPAYMENTS_API_KEY,
      },
    });

    if (paymentRes.ok) {
      const paymentData = await paymentRes.json();
      nowpaymentsStatus = paymentData.payment_status || "waiting";
      if (paymentData.invoice_id) {
        invoiceIdFromPayment = String(paymentData.invoice_id);
      }
    } else {
      // If payment status fails, check GET /v1/invoice/:id
      const invoiceRes = await fetch(`https://api.nowpayments.io/v1/invoice/${paymentId}`, {
        headers: {
          "x-api-key": process.env.NOWPAYMENTS_API_KEY,
        },
      });

      if (invoiceRes.ok) {
        const invoiceData = await invoiceRes.json();
        const invStatus = invoiceData.invoice_status || invoiceData.status;
        if (invStatus === "paid" || invStatus === "confirmed") {
          nowpaymentsStatus = "confirmed";
        } else if (invStatus === "expired" || invStatus === "partially_paid") {
          nowpaymentsStatus = invStatus;
        } else {
          nowpaymentsStatus = "waiting";
        }
      }
    }

    // 3. Find database record by the invoice ID
    if (!record || record.status === "pending") {
      record = await findRecordByInvoiceId(invoiceIdFromPayment);
    }

    // Map NOWPayments status to a simplified UI status ("confirmed" or "waiting" or "failed")
    let finalStatus = "waiting";
    if (nowpaymentsStatus === "confirmed" || nowpaymentsStatus === "finished") {
      finalStatus = "confirmed";
    } else if (nowpaymentsStatus === "failed" || nowpaymentsStatus === "expired") {
      finalStatus = "failed";
    } else if (record && (record.status === "completed" || record.status === "valid" || record.status === "succeeded")) {
      finalStatus = "confirmed";
    }

    return NextResponse.json({
      status: finalStatus,
      type: record?.type || null,
      recordId: record?.id || null,
      slug: record?.slug || null,
      qrCode: record?.qrCode || null,
    });
  } catch (err: unknown) {
    console.error("crypto/status route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
