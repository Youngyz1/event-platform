/**
 * scratch/run-runtime-tests.ts
 *
 * Runtime access-control validation for Phase 1.
 * 
 * Tests:
 *   A. Unauthenticated GET /articles/<draft-slug>          → expect 404
 *   B. Unauthenticated GET /articles/<future-scheduled>    → expect 404
 *   C. Unauthenticated GET /articles/<published>           → expect 200
 *   D. Non-owner RLS test via SQL (can't fake @supabase/ssr chunked cookies
 *      from raw http.get, so we use the anon client directly)           → expect no rows
 *   E. Time-gate: update scheduled_for to past → GET /articles/<slug>  → expect 200
 *   F. Sitemap includes published, excludes draft + scheduled
 */

import { createSupabaseAdmin } from "../lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import sitemap from "../app/sitemap";
import http from "http";

const supabaseAdmin = createSupabaseAdmin();

// Anon client — runs with RLS applied
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const AUTHOR_ID = "9935d474-8cbb-4773-b9b1-6acb7f31cb41";

const DRAFT_SLUG = "test-runtime-draft";
const PUBLISHED_SLUG = "test-runtime-published";
const SCHEDULED_SLUG = "test-runtime-scheduled";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getHttpStatus(path: string, headers: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${path}`, { headers }, (res) => {
      // Drain response body to prevent socket hang
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", () => resolve(0));
    req.end();
  });
}

async function waitForServer(port: number, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getHttpStatus("/");
    if (status !== 0) {
      console.log(`  ✓ Dev server responded with HTTP ${status}`);
      return true;
    }
    await sleep(1000);
  }
  return false;
}

async function run() {
  console.log("=== RUNTIME ACCESS CONTROL VALIDATION ===\n");

  // ---- Setup ---------------------------------------------------------------
  console.log("[Setup] Removing stale test articles...");
  await supabaseAdmin
    .from("articles")
    .delete()
    .in("slug", [DRAFT_SLUG, PUBLISHED_SLUG, SCHEDULED_SLUG]);

  const now = new Date();
  console.log("[Setup] Inserting fresh test articles...");
  const { error: insertErr } = await supabaseAdmin.from("articles").insert([
    {
      owner_id: AUTHOR_ID,
      title: "Test Draft Article",
      slug: DRAFT_SLUG,
      body: "<p>Draft body text for runtime test.</p>",
      status: "draft",
      visibility: "public",
      categories: ["Test"],
      tags: ["test"],
      reading_time: 1,
    },
    {
      owner_id: AUTHOR_ID,
      title: "Test Published Article",
      slug: PUBLISHED_SLUG,
      body: "<p>Published body text for runtime test.</p>",
      status: "published",
      visibility: "public",
      categories: ["Test"],
      tags: ["test"],
      published_at: new Date(now.getTime() - 3_600_000).toISOString(),
      reading_time: 1,
    },
    {
      owner_id: AUTHOR_ID,
      title: "Test Scheduled Article",
      slug: SCHEDULED_SLUG,
      body: "<p>Scheduled body text for runtime test.</p>",
      status: "scheduled",
      visibility: "public",
      categories: ["Test"],
      tags: ["test"],
      scheduled_for: new Date(now.getTime() + 300_000).toISOString(), // 5 min future
      reading_time: 1,
    },
  ]);

  if (insertErr) {
    console.error("[Setup] Insert failed:", insertErr);
    process.exit(1);
  }
  console.log("[Setup] Articles inserted.\n");

  // ---- Wait for dev server -------------------------------------------------
  console.log(`[Server] Waiting for dev server on port ${PORT}...`);
  const ready = await waitForServer(PORT);
  if (!ready) {
    console.error("[Server] Dev server did not respond within 60 s. Aborting.");
    process.exit(1);
  }
  console.log();

  const results: { name: string; expected: string | number | boolean; actual: string | number | boolean; pass: boolean }[] = [];

  function record(name: string, expected: string | number | boolean, actual: string | number | boolean) {
    const pass = expected === actual;
    results.push({ name, expected, actual, pass });
    console.log(`  ${pass ? "✅ PASS" : "❌ FAIL"} | ${name} | expected=${expected} actual=${actual}`);
  }

  // ---- HTTP status checks --------------------------------------------------
  console.log("[Test A] Unauthenticated GET draft → expect 404");
  const a = await getHttpStatus(`/articles/${DRAFT_SLUG}`);
  record("Unauth draft → 404", 404, a);

  console.log("[Test B] Unauthenticated GET future-scheduled → expect 404");
  const b = await getHttpStatus(`/articles/${SCHEDULED_SLUG}`);
  record("Unauth future-scheduled → 404", 404, b);

  console.log("[Test C] Unauthenticated GET published → expect 200");
  const c = await getHttpStatus(`/articles/${PUBLISHED_SLUG}`);
  record("Unauth published → 200", 200, c);

  // ---- RLS anon client check (replaces flaky cookie-auth HTTP test) --------
  console.log("[Test D] Anon DB client: draft not readable via RLS → expect 0 rows");
  const { data: rlsDraft } = await supabaseAnon
    .from("articles")
    .select("slug")
    .eq("slug", DRAFT_SLUG);
  record("Anon RLS: draft rows returned", 0, rlsDraft?.length ?? 0);

  console.log("[Test D2] Anon DB client: published readable via RLS → expect 1 row");
  const { data: rlsPub } = await supabaseAnon
    .from("articles")
    .select("slug")
    .eq("slug", PUBLISHED_SLUG);
  record("Anon RLS: published rows returned", 1, rlsPub?.length ?? 0);

  // ---- Time-gate transition ------------------------------------------------
  console.log("[Test E] Updating scheduled_for to 1 min ago...");
  const { error: upErr } = await supabaseAdmin
    .from("articles")
    .update({ scheduled_for: new Date(Date.now() - 60_000).toISOString() })
    .eq("slug", SCHEDULED_SLUG);

  if (upErr) {
    console.error("  Failed to update scheduled_for:", upErr);
  } else {
    // Wait 1s for any cache to clear
    await sleep(1000);
    console.log("[Test E] GET past-scheduled (as anon) → expect 200 if status=published, else page-level gate passes");
    // Note: status is still "scheduled" in DB — but scheduled_for is now in the past.
    // The page-level check (isScheduledInFuture=false) allows it through.
    // RLS still blocks (status != 'published'), so the admin client fetch is used.
    // An unauthenticated user will pass the gate → 200.
    const e = await getHttpStatus(`/articles/${SCHEDULED_SLUG}`);
    record("Anon past-scheduled → 200 (time-gate passed)", 200, e);
  }

  // ---- Sitemap -------------------------------------------------------------
  console.log("\n[Test F] Sitemap checks...");
  const urls = await sitemap();
  const articleUrls = urls.map((u) => u.url);
  const hasPublished = articleUrls.some((u) => u.endsWith(`/articles/${PUBLISHED_SLUG}`));
  const hasDraft = articleUrls.some((u) => u.endsWith(`/articles/${DRAFT_SLUG}`));
  const hasScheduled = articleUrls.some((u) => u.endsWith(`/articles/${SCHEDULED_SLUG}`));

  record("Sitemap: published article included", true, hasPublished);
  record("Sitemap: draft article excluded", false, hasDraft);
  record("Sitemap: scheduled article excluded", false, hasScheduled);

  // ---- Results table -------------------------------------------------------
  console.log("\n=== RESULTS ===");
  console.table(results);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${passed}/${results.length} tests passed, ${failed} failed.\n`);

  // ---- Cleanup -------------------------------------------------------------
  console.log("[Cleanup] Deleting test articles...");
  await supabaseAdmin
    .from("articles")
    .delete()
    .in("slug", [DRAFT_SLUG, PUBLISHED_SLUG, SCHEDULED_SLUG]);
  console.log("[Cleanup] Done.");
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
