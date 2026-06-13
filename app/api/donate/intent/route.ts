import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      amount,
      tip = 0,
      fundraiserSlug,
      fundraiserTitle,
      donorName,
      donorEmail,
      message,
      anonymous = false,
      saveCard = false,
    } = await req.json();

    const donationAmount = Number(amount);
    const tipAmount = Number(tip) || 0;

    if (!fundraiserSlug || !Number.isFinite(donationAmount) || donationAmount < 1) {
      return NextResponse.json({ error: "Invalid donation details." }, { status: 400 });
    }

    const { data: fundraiser } = await supabaseAdmin
      .from("fundraisers")
      .select("id, title, slug")
      .eq("slug", fundraiserSlug)
      .single();

    if (!fundraiser) {
      return NextResponse.json({ error: "Fundraiser not found." }, { status: 404 });
    }

    const totalCents = Math.round((donationAmount + tipAmount) * 100);

    const normalizedDonorEmail =
      typeof donorEmail === "string" ? donorEmail.trim() : "";
    const normalizedDonorName =
      typeof donorName === "string" ? donorName.trim() : "";

    let customerId: string | undefined;
    if (saveCard && normalizedDonorEmail) {
      const customer = await stripe.customers.create({
        email: normalizedDonorEmail,
        name: anonymous ? undefined : normalizedDonorName || undefined,
        metadata: {
          kind: "donor",
          fundraiser_id: fundraiser.id,
          fundraiser_slug: fundraiser.slug,
        },
      });
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      customer: customerId,
      setup_future_usage: saveCard ? "off_session" : undefined,
      metadata: {
        kind: "donation",
        fundraiser_id: fundraiser.id,
        fundraiser_slug: fundraiser.slug,
        fundraiser_title: fundraiser.title || fundraiserTitle || "",
        donor_name: anonymous ? "Anonymous" : (normalizedDonorName || "Anonymous"),
        donor_email: normalizedDonorEmail,
        message: message || "",
        donation_amount: String(donationAmount),
        tip_amount: String(tipAmount),
        anonymous: String(anonymous),
        save_card: String(Boolean(saveCard)),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
