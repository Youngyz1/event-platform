/**
 * app/api/admin/fundraisers/[id]/import/route.ts
 * POST — admin-only import of historical donors and/or Words-of-Support.
 *
 * Admin-only (isAdmin() before any write) + service-role client. The raw paste
 * text is re-parsed here (never trusting the client's parse), only valid rows
 * are inserted, and `raised` is recomputed from the donations so the progress
 * bar / count / donor list reflect the import. Requires migration 42
 * (donations.source/import_batch_id, comments.source/likes/import_batch_id).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { isAdmin } from "@/lib/auth";
import { recalculateFundraiserRaised } from "@/lib/donations";
import { parseDonorsPaste, parseCommentsPaste } from "@/lib/fundraiser-import";

// Service role: bypasses RLS — admin operations only.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    donorsText?: string;
    commentsText?: string;
    confirmDuplicate?: boolean;
  };

  const donors = parseDonorsPaste(body.donorsText ?? "");
  const comments = parseCommentsPaste(body.commentsText ?? "");

  if (donors.rows.length === 0 && comments.rows.length === 0) {
    return NextResponse.json(
      {
        error: "Nothing valid to import.",
        donorErrors: donors.errors,
        commentErrors: comments.errors,
      },
      { status: 400 }
    );
  }

  // Confirm the fundraiser exists before inserting (avoid orphan rows).
  const { data: fundraiser, error: frError } = await supabaseAdmin
    .from("fundraisers")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (frError) return NextResponse.json({ error: frError.message }, { status: 500 });
  if (!fundraiser) return NextResponse.json({ error: "Fundraiser not found." }, { status: 404 });

  // Pre-import duplicate check: if >= 30% of pasted rows match existing donations, return warning unless confirmed
  if (donors.rows.length > 0 && !body.confirmDuplicate) {
    let existingDonations: { donor_name: string | null; amount: number | null; created_at: string | null }[] = [];
    let page = 0;
    while (true) {
      const { data: pageData } = await supabaseAdmin
        .from("donations")
        .select("donor_name, amount, created_at")
        .eq("fundraiser_id", id)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!pageData || pageData.length === 0) break;
      existingDonations = existingDonations.concat(pageData);
      if (pageData.length < 1000) break;
      page++;
    }

    const existingSet = new Set(
      existingDonations.map((d) => {
        const dateStr = d.created_at ? d.created_at.substring(0, 10) : "";
        const nameStr = (d.donor_name || "").trim().toLowerCase();
        const amtStr = Number(d.amount || 0).toFixed(2);
        return `${nameStr}|${amtStr}|${dateStr}`;
      })
    );

    let duplicateCount = 0;
    for (const r of donors.rows) {
      const key = `${r.name.trim().toLowerCase()}|${r.amount.toFixed(2)}|${r.date}`;
      if (existingSet.has(key)) {
        duplicateCount++;
      }
    }

    const duplicateRatio = donors.rows.length > 0 ? duplicateCount / donors.rows.length : 0;
    if (duplicateCount > 0 && duplicateRatio >= 0.3) {
      return NextResponse.json(
        {
          warning: "duplicate_risk",
          duplicateCount,
          totalRows: donors.rows.length,
          message: `This looks similar to an already-imported batch — ${duplicateCount} of ${donors.rows.length} rows (${Math.round(duplicateRatio * 100)}%) appear to be duplicates. Continue anyway?`,
        },
        { status: 409 }
      );
    }
  }

  const importBatchId = randomUUID();

  if (donors.rows.length > 0) {
    const donorPayload = donors.rows.map((r) => ({
      fundraiser_id: id,
      donor_name: r.name,
      amount: r.amount,
      currency: "USD",
      status: "completed", // counts toward raised, count, and the donor list
      source: "imported",
      payment_method: "imported",
      import_batch_id: importBatchId,
      user_id: null,
      created_at: `${r.date}T00:00:00`,
    }));

    // Chunk inserts into batches of 500 rows to prevent DB trigger statement timeouts on large pastes
    const chunkSize = 500;
    for (let i = 0; i < donorPayload.length; i += chunkSize) {
      const chunk = donorPayload.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin.from("donations").insert(chunk);
      if (error) {
        return NextResponse.json({ error: `Donation import failed: ${error.message}` }, { status: 500 });
      }
    }
  }

  if (comments.rows.length > 0) {
    const commentPayload = comments.rows.map((r) => ({
      target_type: "fundraiser",
      target_id: id,
      author_name: r.name,
      body: r.body,
      status: "approved",
      source: "imported",
      likes: r.likes,
      import_batch_id: importBatchId,
      created_at: `${r.date}T00:00:00`,
    }));

    const chunkSize = 500;
    for (let i = 0; i < commentPayload.length; i += chunkSize) {
      const chunk = commentPayload.slice(i, i + chunkSize);
      const { error } = await supabaseAdmin.from("comments").insert(chunk);
      if (error) {
        return NextResponse.json({ error: `Comment import failed: ${error.message}` }, { status: 500 });
      }
    }
  }

  // Recompute `raised` across all valid donations (completed + succeeded),
  // consistent with the donor list + webhook. The donation trigger already
  // recomputed over 'completed' on insert; this makes it authoritative.
  let raised: number | null = null;
  if (donors.rows.length > 0) {
    await recalculateFundraiserRaised(id);
    const { data } = await supabaseAdmin
      .from("fundraisers")
      .select("id, slug, raised")
      .eq("id", id)
      .maybeSingle();
    raised = data ? Number(data.raised ?? 0) : null;
    revalidatePath("/");
    revalidatePath("/campaigns");
    revalidatePath("/admin/fundraisers");
    revalidatePath(`/admin/fundraisers/${id}`);
    if (data?.slug) {
      revalidatePath(`/fundraisers/${data.slug}`);
    }
  }

  return NextResponse.json({
    success: true,
    importBatchId,
    donorsInserted: donors.rows.length,
    commentsInserted: comments.rows.length,
    donorErrors: donors.errors,
    commentErrors: comments.errors,
    raised,
  });
}
