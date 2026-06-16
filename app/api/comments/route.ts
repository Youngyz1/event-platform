import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TargetType = "event" | "fundraiser";

function isTargetType(value: string | null): value is TargetType {
  return value === "event" || value === "fundraiser";
}

function targetTable(targetType: TargetType) {
  return targetType === "event" ? "events" : "fundraisers";
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

async function targetExists(targetType: TargetType, targetId: string) {
  const { data, error } = await supabaseAdmin
    .from(targetTable(targetType))
    .select("id")
    .eq("id", targetId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId") || "";
  const includeDonorAmounts = searchParams.get("includeDonorAmounts") === "true";

  if (!isTargetType(targetType) || !uuidPattern.test(targetId)) {
    return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, author_name, author_email, body, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const comments = data || [];
  const emails = comments
    .map((c) => c.author_email)
    .filter((e): e is string => Boolean(e));

  const amountByEmail = new Map<string, number>();
  const organizerIdByEmail = new Map<string, string>();

  if (emails.length > 0) {
    const promises = [];

    // 1. Fetch donation amounts if requested
    if (includeDonorAmounts && targetType === "fundraiser") {
      promises.push(
        supabaseAdmin
          .from("donations")
          .select("donor_email, amount")
          .eq("fundraiser_id", targetId)
          .in("status", ["completed", "succeeded"])
          .in("donor_email", emails)
          .then(({ data: donations }) => {
            for (const d of donations || []) {
              const key = (d.donor_email || "").toLowerCase();
              if (!amountByEmail.has(key) || Number(d.amount ?? 0) > (amountByEmail.get(key) ?? 0)) {
                amountByEmail.set(key, Number(d.amount ?? 0));
              }
            }
          })
      );
    }

    // 2. Fetch organizer profile mapping
    promises.push(
      (async () => {
        const { data: authUsers } = await supabaseAdmin
          .from("auth.users")
          .select("id, email")
          .in("email", emails);

        const userIdByEmail = new Map<string, string>();
        for (const u of authUsers || []) {
          if (u.email && u.id) {
            userIdByEmail.set(u.email.toLowerCase(), u.id);
          }
        }

        const userIds = Array.from(userIdByEmail.values());
        if (userIds.length > 0) {
          const { data: organizers } = await supabaseAdmin
            .from("organizers")
            .select("id, user_id")
            .in("user_id", userIds)
            .eq("visibility", "public")
            .not("status", "in", "(rejected,suspended)");

          const organizerIdByUserId = new Map<string, string>();
          for (const o of organizers || []) {
            organizerIdByUserId.set(o.user_id, o.id);
          }

          for (const [email, userId] of userIdByEmail.entries()) {
            const orgId = organizerIdByUserId.get(userId);
            if (orgId) {
              organizerIdByEmail.set(email, orgId);
            }
          }
        }
      })()
    );

    await Promise.all(promises);
  }

  const safeComments = comments.map((comment) => {
    const emailKey = comment.author_email?.toLowerCase();
    return {
      id: comment.id,
      author_name: comment.author_name,
      body: comment.body,
      created_at: comment.created_at,
      donor_amount: emailKey ? (amountByEmail.get(emailKey) ?? null) : null,
      author_organizer_id: emailKey ? (organizerIdByEmail.get(emailKey) ?? null) : null,
    };
  });

  return NextResponse.json({ comments: safeComments });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const targetType = cleanText(payload.targetType || payload.type);
  const targetId = cleanText(payload.targetId || payload.fundraiser_id);
  const authorName = cleanText(payload.authorName || payload.author_name, "Anonymous").slice(0, 120) || "Anonymous";
  const authorEmail = cleanText(payload.authorEmail).slice(0, 255) || null;
  const body = cleanText(payload.body);
  const stripeSessionId = cleanText(payload.stripeSessionId);
  const postDonationFlow = payload.type === "fundraiser" && Boolean(payload.fundraiser_id);

  if (!isTargetType(targetType) || !uuidPattern.test(targetId)) {
    return NextResponse.json({ error: "Invalid comment target." }, { status: 400 });
  }

  // Comments are only allowed on fundraisers now
  if (targetType !== "fundraiser") {
    return NextResponse.json({ error: "Comments are not enabled for this type." }, { status: 403 });
  }

  if (body.length < 2 || body.length > 1000) {
    return NextResponse.json(
      { error: "Message must be between 2 and 1000 characters." },
      { status: 400 }
    );
  }

  let verifiedDonation: { id?: string; amount?: number | null; donor_email?: string | null } | null = null;

  if (!postDonationFlow) {
    // ── Donation verification ────────────────────────────────────────────────
    // Must supply a valid Stripe session ID that corresponds to a donation for this fundraiser.
    if (!stripeSessionId) {
      return NextResponse.json(
        { error: "A valid donation session is required to leave a message." },
        { status: 403 }
      );
    }

    const { data: donation } = await supabaseAdmin
      .from("donations")
      .select("id, amount, donor_email")
      .eq("fundraiser_id", targetId)
      .eq("payment_intent_id", stripeSessionId)
      .in("status", ["completed", "succeeded"])
      .limit(1)
      .maybeSingle();

    // payment_intent_id may store either the session ID or the payment intent ID.
    // Fall back to checking if any completed donation exists for this email + fundraiser.
    verifiedDonation = donation;
    if (!verifiedDonation && authorEmail) {
      const { data: fallback } = await supabaseAdmin
        .from("donations")
        .select("id, amount, donor_email")
        .eq("fundraiser_id", targetId)
        .ilike("donor_email", authorEmail)
        .in("status", ["completed", "succeeded"])
        .limit(1)
        .maybeSingle();
      verifiedDonation = fallback;
    }

    if (!verifiedDonation) {
      return NextResponse.json(
        { error: "We could not verify your donation for this fundraiser." },
        { status: 403 }
      );
    }
    // ─────────────────────────────────────────────────────────────────────────
  } else if (authorEmail) {
    const { data: fallback } = await supabaseAdmin
      .from("donations")
      .select("id, amount, donor_email")
      .eq("fundraiser_id", targetId)
      .ilike("donor_email", authorEmail)
      .in("status", ["completed", "succeeded"])
      .limit(1)
      .maybeSingle();
    verifiedDonation = fallback;
  }

  try {
    const exists = await targetExists(targetType, targetId);
    if (!exists) {
      return NextResponse.json({ error: "This fundraiser no longer exists." }, { status: 404 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify fundraiser.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      target_type: targetType,
      target_id: targetId,
      author_name: authorName,
      author_email: authorEmail || verifiedDonation?.donor_email || null,
      body,
      status: "approved",
    })
    .select("id, author_name, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    comment: {
      ...data,
      donor_amount: Number(verifiedDonation?.amount ?? 0),
    }
  }, { status: 201 });
}
