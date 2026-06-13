import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Service role: bypasses RLS — admin operations only
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — server misconfiguration.");
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      amount,
      fundraiserTitle,
      fundraiserSlug,
      fundraiserId,
      donorName,
      donorEmail,
      message,
    } = body;
    const safeAmount = Number(amount);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    }

    if ((!fundraiserSlug && !fundraiserId) || !Number.isFinite(safeAmount) || safeAmount < 1) {
      return NextResponse.json({ error: "Invalid donation details." }, { status: 400 });
    }

    let fundraiserQuery = supabaseAdmin
      .from("fundraisers")
      .select("id, title, slug")
      .limit(1);

    fundraiserQuery = fundraiserId
      ? fundraiserQuery.eq("id", fundraiserId)
      : fundraiserQuery.eq("slug", fundraiserSlug);

    const { data: fundraiser } = await fundraiserQuery.single();

    if (!fundraiser) {
      return NextResponse.json({ error: "Fundraiser not found." }, { status: 404 });
    }

    const donationMetadata = {
      kind: "donation",
      fundraiser_id: body.fundraiserId || fundraiser.id,
      fundraiser_slug: fundraiser.slug,
      fundraiser_title: fundraiser.title || fundraiserTitle || "",
      donor_name: donorName || "",
      donor_email: donorEmail || "",
      message: message || "",
      amount: String(safeAmount),
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: donorEmail || undefined,
      payment_intent_data: {
        metadata: donationMetadata,
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Donation — ${fundraiser.title || fundraiserTitle}`,
            },
            unit_amount: Math.round(safeAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url:
        `${baseUrl}/donation-confirmation` +
        `?fundraiser_slug=${fundraiserSlug || fundraiser.slug}` +
        `&donor_name=${encodeURIComponent(donorName || "")}` +
        `&amount=${safeAmount}`,
      cancel_url: `${baseUrl}/fundraisers/${fundraiser.slug}?cancelled=true`,
      metadata: donationMetadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
