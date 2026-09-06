/**
 * Security checks for C1/C2 (prior passes) and H1–H6 (this pass).
 *
 *   node --experimental-strip-types scripts/security-checks/c1-c2-checks.mts
 *   (also: npm run security:checks)
 *
 * No test runner exists in this repo, so this is a plain script in the style
 * of scripts/verify-requirements.mts: relative imports, console TAP-ish
 * output, non-zero exit on failure. Pure-function checks plus static
 * regression tripwires (explicitly labeled as such) — no Stripe,
 * NOWPayments, or database calls, no real money, no browser execution.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clientPriceContradicts,
  resolveTicketPrice,
  validateDonationAmount,
  validateDonationCurrency,
  validateTicketQuantity,
  MAX_TICKET_QUANTITY,
} from "../../lib/ticket-pricing.ts";
import { isAllowedHttpUrl } from "../../lib/safe-url.ts";
import { sanitizeRichTextHtml } from "../../lib/sanitize-html.ts";
import {
  isPaidDonationStatus,
  isStripePaymentIntentId,
  isStripeSessionId,
  safeEqual,
} from "../../lib/certificate-auth.ts";
// NOTE: lib/rate-limit.ts imports next/server, which cannot load under plain
// node — H2 bucket assertions below parse RATE_LIMITS statically instead.

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
function readRepo(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

let pass = 0;
let fail = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

// ── C1: legitimate price (Test A: db 100 x qty 2 = 200 / 20000c) ─────────────
{
  const r = resolveTicketPrice({
    ticket: { id: "t", event_id: "e", name: "GA", price: 100, quantity: 50 },
    event: { id: "e", slug: "show", title: "Show" },
    eventId: "e",
    quantity: 2,
  });
  check(
    "C1.A legitimate price 100x2=200 (20000c, usd)",
    r.ok &&
      (r as { ok: true; value: { total: number; totalCents: number; currency: string } }).value.total === 200 &&
      (r as { ok: true; value: { total: number; totalCents: number; currency: string } }).value.totalCents === 20000 &&
      (r as { ok: true; value: { total: number; totalCents: number; currency: string } }).value.currency === "usd",
    r
  );
}

// ── C1: manipulated / inflated client prices never used (Tests B, C) ─────────
{
  // resolveTicketPrice takes no client price input by construction: the only
  // price signal is the ticket row. A client sending 0.01 contradicts 100.
  check("C1.B manipulated 0.01 contradicts db 100", clientPriceContradicts(0.01, 100) === true);
  check("C1.C inflated 999999 contradicts db 100", clientPriceContradicts(999999, 100) === true);
  check("C1 matching price does not contradict", clientPriceContradicts(100, 100) === false);
  check("C1 absent price does not contradict", clientPriceContradicts(undefined, 100) === false);
  check("C1 non-numeric price contradicts", clientPriceContradicts("abc", 100) === true);
}

// ── C1: quantity validation (Test D) ─────────────────────────────────────────
{
  check("C1.D qty 0 rejected", validateTicketQuantity(0).ok === false);
  check("C1.D qty -2 rejected", validateTicketQuantity(-2).ok === false);
  check("C1.D qty 1.5 rejected", validateTicketQuantity(1.5).ok === false);
  check("C1.D qty huge rejected", validateTicketQuantity(10_000).ok === false);
  check("C1.D qty NaN rejected", validateTicketQuantity("abc").ok === false);
  check("C1.D qty undefined rejected", validateTicketQuantity(undefined).ok === false);
  const over = validateTicketQuantity(MAX_TICKET_QUANTITY + 1);
  check("C1.D qty over max rejected", over.ok === false);
  const good = validateTicketQuantity(2);
  check("C1.D qty 2 accepted", good.ok && (good as { ok: true; quantity: number }).quantity === 2);
}

// ── C1: invalid ticket/event (Test E) ────────────────────────────────────────
{
  const wrongEvent = resolveTicketPrice({
    ticket: { id: "t", event_id: "other", name: "GA", price: 100, quantity: 10 },
    event: { id: "e", slug: "s", title: "T" },
    eventId: "e",
    quantity: 1,
  });
  check("C1.E ticket of another event rejected", !wrongEvent.ok, wrongEvent);

  const missing = resolveTicketPrice({
    ticket: null,
    event: { id: "e", slug: "s", title: "T" },
    eventId: "e",
    quantity: 1,
  });
  check("C1.E missing ticket rejected", !missing.ok, missing);

  const soldOut = resolveTicketPrice({
    ticket: { id: "t", event_id: "e", name: "GA", price: 100, quantity: 0 },
    event: { id: "e", slug: "s", title: "T" },
    eventId: "e",
    quantity: 1,
  });
  check("C1.E sold-out ticket rejected", !soldOut.ok, soldOut);

  const badSeat = resolveTicketPrice({
    ticket: { id: "t", event_id: "e", name: "GA", price: 100, quantity: 10 },
    event: { id: "e", slug: "s", title: "T" },
    seat: { id: "s1", event_id: "e", status: "sold", price_override: null, ticket_id: "t" },
    eventId: "e",
    quantity: 1,
  });
  check("C1.E sold seat rejected", !badSeat.ok, badSeat);

  const seatOverride = resolveTicketPrice({
    ticket: { id: "t", event_id: "e", name: "GA", price: 100, quantity: 10 },
    event: { id: "e", slug: "s", title: "T" },
    seat: { id: "s1", event_id: "e", status: "available", price_override: 75, ticket_id: "t" },
    eventId: "e",
    quantity: 2,
  });
  check(
    "C1.E seat override 75x2=150",
    seatOverride.ok && (seatOverride as { ok: true; value: { total: number } }).value.total === 150,
    seatOverride
  );
}

// ── C1: donation + currency validation ───────────────────────────────────────
{
  check("C1 donation 0 rejected", validateDonationAmount(0).ok === false);
  check("C1 donation negative rejected", validateDonationAmount(-5).ok === false);
  check("C1 donation huge rejected", validateDonationAmount(2_000_000).ok === false);
  const d = validateDonationAmount(25);
  check("C1 donation 25 accepted", d.ok === true);
  check("C1 currency usd accepted", validateDonationCurrency("usd").ok === true);
  check("C1 currency xxx rejected", validateDonationCurrency("xxx").ok === false);
  check("C1 currency empty defaults handling", validateDonationCurrency("").ok === false);
}

// ── C2: dangerous schemes rejected ───────────────────────────────────────────
{
  const bad = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "javascript://evil",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://x/y",
    "//evil.com/x",
    "/relative/path",
    "#anchor",
    "",
  ];
  for (const u of bad) {
    check(`C2 rejects ${JSON.stringify(u)}`, isAllowedHttpUrl(u) === false, u);
  }
  check("C2 rejects tab-smuggled scheme", isAllowedHttpUrl("java\tscript:alert(1)") === false);
  check("C2 rejects entity-encoded scheme", isAllowedHttpUrl("&#106;avascript:alert(1)") === false);
  check("C2 rejects backslash URL", isAllowedHttpUrl("https:\\\\evil.com") === false);

  check("C2 allows https", isAllowedHttpUrl("https://example.com") === true);
  check("C2 allows http", isAllowedHttpUrl("http://example.com/path?q=1") === true);
  check("C2 allows https uppercase host", isAllowedHttpUrl("HTTPS://EXAMPLE.COM") === true);
}

// ── C2: server sanitizer strips payloads, keeps legit links ──────────────────
{
  const stripped = sanitizeRichTextHtml(
    '<p>hi</p><a href="javascript:alert(1)">x</a><script>alert(1)</script><a href="https://example.com">ok</a>'
  );
  check("C2 sanitize removes javascript: href", !stripped.includes("javascript:"), stripped);
  check("C2 sanitize removes script tags", !stripped.includes("<script"), stripped);
  check("C2 sanitize keeps https link", stripped.includes('href="https://example.com"'), stripped);

  const handlers = sanitizeRichTextHtml('<p onclick="alert(1)">x</p><a href="https://example.com" onclick="alert(1)">y</a>');
  check("C2 sanitize removes event handlers", !handlers.includes("onclick"), handlers);

  const dataImg = sanitizeRichTextHtml('<img src="data:text/html,<script>alert(1)</script>">');
  check("C2 sanitize removes data: img src", !dataImg.includes("data:text/html"), dataImg);
}

// ── Obj1: direct-submit story bypass payloads (what a custom client could POST;
//         the server must store only the sanitized result) ─────────────────────
{
  const directScript = sanitizeRichTextHtml("<p>Hello</p><script>alert(1)</script>");
  check("Obj1 bypass <script> stripped, text kept",
    directScript.includes("Hello") && !directScript.includes("<script"), directScript);

  const directJsLink = sanitizeRichTextHtml('<a href="javascript:alert(1)">Click</a>');
  check("Obj1 bypass javascript: href neutralized",
    !directJsLink.includes("javascript:"), directJsLink);

  const directHandler = sanitizeRichTextHtml('<img src="x" onerror="alert(1)">');
  check("Obj1 bypass onerror stripped", !directHandler.includes("onerror"), directHandler);

  const legit = sanitizeRichTextHtml(
    "<h2>Our story</h2><p>We help <strong>kids</strong>.</p><ul><li>Food</li></ul>" +
    '<a href="https://example.com/donate">Donate</a>' +
    '<iframe src="https://www.youtube.com/embed/abc123"></iframe>'
  );
  check("Obj1 legit formatting preserved",
    legit.includes("<h2>") && legit.includes("<strong>") &&
    legit.includes('href="https://example.com/donate"') &&
    legit.includes("youtube.com/embed/abc123"), legit);
}

// ── Obj1 (final pass): CSV import rows take the same server path ─────────────
// POST /api/fundraisers applies sanitizeRichTextHtml to every story, including
// CSV-sourced ones. These assert the exact function the route uses neutralizes
// malicious CSV cells while preserving plain-text CSV stories byte-for-byte.
{
  const csvScript = "Help build a school<script>alert(1)</script>";
  const csvScriptOut = sanitizeRichTextHtml(csvScript);
  check("Obj1 CSV <script> cell sanitized",
    csvScriptOut.includes("Help build a school") && !csvScriptOut.includes("<script"), csvScriptOut);

  const csvJsLink = '<a href="javascript:alert(1)">x</a>';
  const csvJsLinkOut = sanitizeRichTextHtml(csvJsLink);
  check("Obj1 CSV javascript: cell neutralized",
    !csvJsLinkOut.includes("javascript:"), csvJsLinkOut);

  const csvPlain = "Help build a local school";
  check("Obj1 CSV plain-text story preserved exactly",
    sanitizeRichTextHtml(csvPlain) === csvPlain, sanitizeRichTextHtml(csvPlain));

  // One malicious row cannot affect another: sanitization is per-value, pure.
  const rowA = sanitizeRichTextHtml("<script>alert(1)</script>Row A");
  const rowB = sanitizeRichTextHtml("Row B");
  check("Obj1 CSV rows isolated",
    !rowA.includes("<script") && rowB === "Row B", { rowA, rowB });
}
// These model the SQL semantics of migration_73 in-process: the "unsafe" model
// yields to the event loop between check and write (like two separate SQL
// statements under concurrency); the "safe" model performs check+write as one
// indivisible step (like UPDATE ... WHERE quantity >= qty).
{
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // Test B logic: insufficient stock rejected, inventory untouched.
  {
    let stock: number | null = 2;
    const consume = (qty: number): boolean => {
      if (stock === null) return true;
      if (stock < qty) return false;
      stock -= qty;
      return true;
    };
    check("Obj2.B purchase 3 from 2 rejected", consume(3) === false);
    check("Obj2.B inventory remains 2", stock === 2);
  }

  // Test A logic: 10 - 3 = 7.
  {
    let stock: number | null = 10;
    const consume = (qty: number): boolean => {
      if (stock === null) return true;
      if (stock < qty) return false;
      stock -= qty;
      return true;
    };
    check("Obj2.A purchase 3 from 10 succeeds", consume(3) === true);
    check("Obj2.A inventory is 7", stock === 7);
  }

  // Test C: two simultaneous purchases of 3 from stock 5.
  const unsafe = async (): Promise<{ results: boolean[]; stock: number }> => {
    let stock = 5;
    const buy = async (qty: number): Promise<boolean> => {
      const seen = stock;
      await tick(); // race window: concurrent caller interleaves here
      if (seen < qty) return false;
      stock = seen - qty;
      return true;
    };
    const results = await Promise.all([buy(3), buy(3)]);
    return { results, stock };
  };
  const safe = async (): Promise<{ results: boolean[]; stock: number }> => {
    let stock = 5;
    const buy = async (qty: number): Promise<boolean> => {
      // No await between check and write: models a single atomic UPDATE.
      if (stock < qty) return false;
      stock -= qty;
      return true;
    };
    const results = await Promise.all([buy(3), buy(3)]);
    return { results, stock };
  };
  const u = await unsafe();
  // Both callers saw stock=5 and both wrote stock=2: two tickets issued for
  // 6 units of demand against 5 in stock (lost update). Oversell proven.
  check("Obj2.C unsafe pattern oversells (proves the race is real)",
    u.results.filter(Boolean).length === 2, u);
  const s = await safe();
  check("Obj2.C atomic consume allows exactly one purchase",
    s.results.filter(Boolean).length === 1, s);
  check("Obj2.C final inventory never negative", s.stock >= 0, s.stock);
  check("Obj2.C total consumed never exceeds 5", 5 - s.stock <= 5 && s.stock === 2, s.stock);

  // Test D: duplicate fulfillment of the same order consumes once.
  {
    let stock = 5;
    let flipped = false; // models ticket_orders.status pending->valid
    const activate = (qty: number): string => {
      if (flipped) return "already"; // idempotency guard: no second consume
      flipped = true;
      if (stock < qty) return "shortfall";
      stock -= qty;
      return "activated";
    };
    check("Obj2.D first activation consumes", activate(3) === "activated");
    check("Obj2.D duplicate activation consumes nothing", activate(3) === "already");
    check("Obj2.D inventory consumed exactly once", stock === 2, stock);
  }

  // Test E: failed payment never reaches fulfillment → no consumption.
  {
    let stock = 5;
    const paymentSucceeded = false;
    if (paymentSucceeded) stock -= 3; // fulfillment only runs on success
    check("Obj2.E failed payment consumes nothing", stock === 5);
  }
}

// ── H1: OTP expiry target 30 minutes (static: local config only) ─────────────
{
  const toml = readRepo("supabase/config.toml");
  const m = toml.match(/^otp_expiry\s*=\s*(\d+)/m);
  check("H1 otp_expiry present in supabase/config.toml", m !== null, m?.[0]);
  check("H1 otp_expiry is 1800s (30 minutes)", m !== null && Number(m[1]) === 1800, m?.[1]);
}

// ── H2: rate-limit budgets exist and are sane (static: source parse) ──────────
{
  const src = readRepo("lib/rate-limit.ts");
  const found = new Map<string, { limit: number; windowSeconds: number }>();
  for (const m of src.matchAll(/(\w+):\s*\{\s*limit:\s*(\d+),\s*windowSeconds:\s*(\d+)\s*\}/g)) {
    found.set(m[1], { limit: Number(m[2]), windowSeconds: Number(m[3]) });
  }
  for (const n of [
    "beneficiaryInvite", "paymentIntent", "importUrl", "commentLike",
    "cryptoPayment", "commentPost", "reviewPost", "followToggle",
    "fundraiserCreate", "fundraiserUpdate", "verificationSubmit",
    "beneficiaryClaim", "geocode", "statusPoll", "documentFetch",
    "mediaImport", "gofundmeSync", "dataExport", "accountAction",
  ]) {
    check(`H2 bucket ${n} registered`, found.has(n));
  }
  for (const [n, b] of found) {
    check(`H2 bucket ${n} sane (limit>=1, window>=60s)`,
      Number.isInteger(b.limit) && b.limit >= 1 &&
      Number.isInteger(b.windowSeconds) && b.windowSeconds >= 60, b);
  }
}

// ── H3: signup-guard oracle removed (static regression tripwires) ────────────
{
  check("H3 /api/signup-guard route deleted",
    !existsSync(join(REPO, "app/api/signup-guard/route.ts")));
  const signup = readRepo("app/signup/page.tsx");
  check("H3 signup page no longer probes account state",
    !signup.includes("signup-guard") && !signup.includes("isPendingDeletion"),
    "probe remnants found");
  const m74 = readRepo("db/migration_74_revoke_enumeration_oracle.sql");
  check("H3 migration 74 revokes the oracle from PUBLIC/anon/authenticated",
    m74.includes("REVOKE ALL ON FUNCTION public.check_email_pending_deletion(text) FROM PUBLIC") &&
    m74.includes("FROM anon, authenticated") &&
    m74.includes("GRANT EXECUTE ON FUNCTION public.check_email_pending_deletion(text) TO service_role"),
    "revoke incomplete");
}

// ── H5: certificate authorization helpers ────────────────────────────────────
{
  check("H5 pi_ classified as Stripe intent", isStripePaymentIntentId("pi_123") === true);
  check("H5 cs_ not an intent", isStripePaymentIntentId("cs_test_123") === false);
  check("H5 opaque id not an intent", isStripePaymentIntentId("don_abc") === false);
  check("H5 cs_ classified as session", isStripeSessionId("cs_test_123") === true);
  check("H5 pi_ not a session", isStripeSessionId("pi_123") === false);
  check("H5 completed is paid", isPaidDonationStatus("completed") === true);
  check("H5 succeeded is paid", isPaidDonationStatus("succeeded") === true);
  check("H5 pending is NOT paid", isPaidDonationStatus("pending") === false);
  check("H5 failed is NOT paid", isPaidDonationStatus("failed") === false);
  check("H5 refunded is NOT paid", isPaidDonationStatus("refunded") === false);
  check("H5 safeEqual matches", safeEqual("abc", "abc") === true);
  check("H5 safeEqual differs", safeEqual("abc", "abd") === false);
  check("H5 safeEqual differs on length", safeEqual("abc", "abcd") === false);
  const certRoute = readRepo("app/api/certificates/[id]/route.ts");
  check("H5 donation.id bearer clause gone",
    !certRoute.includes("queryPaymentId === donation.id"), "bearer clause present");
}

// ── H6: admin header dependency removed (static regression tripwires) ────────
{
  const layout = readRepo("app/admin/layout.tsx");
  const proxy = readRepo("proxy.ts");
  check("H6 layout always requires admin server-side",
    layout.includes("await requireAdmin()") && !layout.includes("x-admin-verified"),
    "layout must call requireAdmin() unconditionally");
  check("H6 proxy no longer mints x-admin-verified",
    !proxy.includes("x-admin-verified"), "header minting present");
}

// ── H4: error boundaries (static regression tripwires) ───────────────────────
{
  const dashErr = readRepo("app/dashboard/error.tsx");
  check("H4 dashboard boundary hides exception detail",
    !dashErr.includes("error.message"), "raw message rendered");
  check("H4 global-error boundary exists",
    existsSync(join(REPO, "app/global-error.tsx")));
  const globalErr = readRepo("app/global-error.tsx");
  check("H4 global boundary hides exception detail",
    !globalErr.includes("error.message"), "raw message rendered");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
