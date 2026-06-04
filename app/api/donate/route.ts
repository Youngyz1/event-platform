import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { amount, fundraiserTitle, fundraiserSlug, donorName, donorEmail } = await req.json();
    const safeAmount = Number(amount);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
    }

    if (!fundraiserSlug || !Number.isFinite(safeAmount) || safeAmount < 1) {
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: donorEmail || undefined,
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
      success_url: `${baseUrl}/fundraisers/${fundraiserSlug}?success=true`,
      cancel_url: `${baseUrl}/fundraisers/${fundraiserSlug}?cancelled=true`,
      metadata: {
        kind: "donation",
        fundraiser_id: fundraiser.id,
        fundraiser_slug: fundraiser.slug,
        fundraiser_title: fundraiser.title || fundraiserTitle || "",
        donor_name: donorName || "Anonymous",
        donor_email: donorEmail || "",
        amount: String(safeAmount),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
