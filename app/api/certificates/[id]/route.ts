import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase-server";
import { generateCertificatePdf } from "@/lib/certificate";
import {
  isPaidDonationStatus,
  isStripePaymentIntentId,
  isStripeSessionId,
  safeEqual,
} from "@/lib/certificate-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Invalid donation ID." }, { status: 400 });
    }

    // H2: PDF generation is CPU-heavy and guest access is unauthenticated.
    const limited = await enforceRateLimit("documentFetch", request);
    if (limited) return limited;

    // Retrieve donation (status-gated: certificates are proof of PAYMENT)
    const { data: donation, error: donError } = await supabaseAdmin
      .from("donations")
      .select("id, donor_name, donor_email, amount, currency, created_at, payment_intent_id, fundraiser_id, status")
      .eq("id", id)
      .single();

    if (donError || !donation) {
      return NextResponse.json({ error: "Donation not found." }, { status: 404 });
    }

    // H5: unpaid/unverified donations never receive payment certificates.
    if (!isPaidDonationStatus(donation.status)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Retrieve fundraiser
    const { data: fundraiser } = await supabaseAdmin
      .from("fundraisers")
      .select("title, organizer_id, user_id")
      .eq("id", donation.fundraiser_id)
      .single();

    // Retrieve organizer
    let organizer = null;
    if (fundraiser?.organizer_id) {
      const { data: org } = await supabaseAdmin
        .from("organizers")
        .select("user_id, name, organization_name")
        .eq("id", fundraiser.organizer_id)
        .single();
      organizer = org;
    }

    // Authorization Check (H5: a predictable donation ID is NEVER sufficient —
    // the `donation.id`-as-bearer clause was removed).
    let authorized = false;

    // Check 1: guest access right after checkout, verified server-side.
    // - Stripe checkout (session_id): session retrieved from Stripe, payment
    //   intent must match (same pattern as /api/receipts/[id]).
    // - Stripe inline (paymentId=pi_*): intent retrieved from Stripe, must be
    //   succeeded and must match.
    // - Crypto (opaque NOWPayments invoice id): constant-time equality against
    //   the stored payment_intent_id. The id is server-generated per payment
    //   and paired with the random donation UUID in the path; both are needed.
    const sp = request.nextUrl.searchParams;
    const queryPaymentId = sp.get("paymentId");
    const querySessionId = sp.get("session_id");

    if (querySessionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(querySessionId);
        const stripePi =
          typeof session.payment_intent === "string" ? session.payment_intent : session.id;
        if (stripePi && donation.payment_intent_id && stripePi === donation.payment_intent_id) {
          authorized = true;
        }
        } catch {
          console.error("[certificates] Stripe session verification failed");
        }
    }

    if (!authorized && queryPaymentId && donation.payment_intent_id) {
      if (isStripePaymentIntentId(queryPaymentId) && process.env.STRIPE_SECRET_KEY) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const pi = await stripe.paymentIntents.retrieve(queryPaymentId);
          if (pi.id === donation.payment_intent_id && pi.status === "succeeded") {
            authorized = true;
          }
        } catch {
          console.error("[certificates] Stripe intent verification failed");
        }
      } else if (!isStripePaymentIntentId(queryPaymentId) && !isStripeSessionId(queryPaymentId)) {
        // Non-Stripe (crypto) opaque payment identifier.
        authorized = safeEqual(queryPaymentId, donation.payment_intent_id);
      }
    }

    // Check 2: Authenticated user
    if (!authorized) {
      const supabase = await createSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Is admin?
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .single();
        
        if (profile?.role === "admin" && profile.status === "active") {
          authorized = true;
        }
        // Is donor?
        else if (donation.donor_email && user.email && donation.donor_email.toLowerCase() === user.email.toLowerCase()) {
          authorized = true;
        }
        // Is organizer?
        else if (organizer?.user_id === user.id) {
          authorized = true;
        }
        // Is the fundraiser's own owner (personal fundraiser, no organizer)?
        else if (fundraiser?.user_id === user.id) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Generate Certificate PDF
    const pdfBuffer = await generateCertificatePdf(
      donation.donor_name || "Anonymous",
      donation.amount,
      donation.currency || "USD",
      fundraiser?.title || "Campaign",
      donation.created_at,
      organizer?.name || "Organizer"
    );

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", 'inline; filename="certificate.pdf"');

    return new NextResponse(new Uint8Array(pdfBuffer), {
  status: 200,
  headers,
});
  } catch (err: any) {
    console.error("Certificate generation failed:", err);
    return NextResponse.json({ error: "Failed to generate certificate PDF." }, { status: 500 });
  }
}
