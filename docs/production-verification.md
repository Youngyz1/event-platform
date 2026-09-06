# Production Supabase verification

> **Product scope (final scope-correction pass):** Fund4Good is a fundraising
> platform. Historical event/ticket functionality is retained in the
> repository/database but is **not part of the current Fund4Good product
> scope** (no event pages, no ticket checkout callers, tables dropped by
> `db/migration_65_remove_events_and_tickets.sql`). Ticket-specific checks
> below are marked LEGACY/CONDITIONAL and are not deployment blockers for the
> fundraising product. See §10.

All queries below are **read-only SELECTs**. Run them with `postgres` /
`service_role` in the Supabase SQL editor (or `supabase db execute`) against
the **production** project. Never paste secrets into tickets/docs.

Canonical migration history: `db/migration_01…74.sql`
(see `docs/database-migrations.md`).

---

## 0. Identify the production database

1. Open the Supabase dashboard → confirm the project slug/ref matches the
   production project (not staging/preview).
2. Run: `SELECT current_database(), current_user, version();`
3. Record the project ref with the results. Every check below is meaningless
   against the wrong project.

## 1. Migration history

Supabase CLI records applied migrations in `supabase_migrations`:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

- **Expected:** one row per applied migration, including the entries covering
  `migration_53`, `migration_71`, `migration_72`, `migration_73`, `migration_74`.
- **If the relation does not exist:** this instance predates CLI tracking (or
  migrations were applied by hand in the SQL editor). Fall back to the
  policy/function checks in §2–§4 as ground truth and record the gap.
- **Blocker:** any of 53/71/72/73/74 missing → apply the corresponding
  `db/migration_*` file before deploying the code that depends on it.

## 2. Security policies (migrations 53 + 71)

RLS must be enabled on every sensitive table:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('follows','organizers','fundraiser_updates',
    'fundraiser_media','notifications','fundraisers','profiles',
    'organizer_follows','donations','comments','reviews');
-- Expected: rowsecurity = true on ALL rows. Any false = BLOCKER.
```

Dangerous blanket policies must be gone:

```sql
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true' OR qual LIKE '%USING (true)%');
-- Expected: zero rows on user-owned tables. Any USING (true) SELECT on
-- follows / organizers / fundraiser_updates / fundraiser_media /
-- notifications / fundraisers = BLOCKER (stale pre-53/71 snapshot).
```

Positive checks:

```sql
-- 71: follows readable by parties only
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'follows' AND cmd = 'SELECT';
-- Expected: 'Only parties to a follow can read it' with
-- auth.uid() = follower_id OR auth.uid() = following_id.
-- A policy named 'Follows are publicly readable' / 'Anyone can view follows'
-- = migration 71 NOT applied = BLOCKER.

-- 53: organizers scoped + no blanket policy
SELECT policyname FROM pg_policies
WHERE tablename = 'organizers' AND cmd = 'SELECT';
-- Expected: 'Public organizers are readable' present,
-- 'Public read organizers' ABSENT. Presence of the latter = BLOCKER.

-- 53: updates/media gated on published parent
SELECT policyname FROM pg_policies
WHERE tablename IN ('fundraiser_updates','fundraiser_media') AND cmd = 'SELECT';
-- Expected: 'Updates of published fundraisers are readable' /
-- 'Media of published fundraisers is readable' present;
-- 'Public can view fundraiser updates' / 'Fundraiser media is publicly
-- readable' / 'Public can view fundraiser media' ABSENT. Otherwise BLOCKER.

-- 44: notifications owner-scoped
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'notifications';
-- Expected: auth.uid() = user_id predicates; no public INSERT/DELETE.

-- 53: sensitive organizer columns not granted to anon/authenticated
SELECT grantee, privilege_type, column_name
FROM information_schema.role_column_grants
WHERE table_schema = 'public' AND table_name = 'organizers'
  AND column_name IN ('tax_id','nonprofit_registration_number')
  AND grantee IN ('anon','authenticated');
-- Expected: zero rows. Any row = BLOCKER (PII leak).

-- 74 (H3): enumeration oracle must not be directly callable
SELECT grantee FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name = 'check_email_pending_deletion';
-- Expected: service_role (and owner) only. anon/authenticated/PUBLIC present
-- = BLOCKER (unauthenticated callers can probe pending-deletion state).
```

## 3. Story sanitization trigger (migration 72)

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_sanitize_fundraiser_story';
-- Expected: one row, tgenabled = 'O'. Missing (after 72 applied) = BLOCKER.

SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('sanitize_fundraiser_story');
-- Expected: present. Absent = BLOCKER.
```

Smoke test (rolls back, writes nothing):

```sql
BEGIN;
INSERT INTO fundraisers (title, slug, story, goal, status, user_id)
VALUES ('__verify72','__verify72',
  '<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)">',
  1, 'pending_review', auth.uid())
RETURNING story;
-- Expected: story contains <p>ok</p>, no <script, no javascript:, no onerror.
ROLLBACK;
```

## 4. Ticket/payment schema (migration 73 + C1)

```sql
-- Inventory functions (called by both webhooks through service_role only)
SELECT proname FROM pg_proc
WHERE proname IN ('try_consume_ticket_inventory',
  'create_ticket_order_with_inventory','activate_ticket_order_with_inventory');
-- Expected: all three present. Missing = BLOCKER for any ticket-selling deploy.
-- (If ticketing tables were dropped per migration_65 and ticket sales stay
-- disabled, record that instead: intent routes return 410 by design.)

-- Ticket stock columns / constraints
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='tickets';
-- Expected: price (numeric), quantity (integer) present when tickets exist.

-- Required indexes from the canonical chain
SELECT indexname FROM pg_indexes
WHERE schemaname='public'
  AND indexname IN ('idx_rate_limits_window_start',
    'idx_notifications_user_created','idx_donations_fundraiser_id',
    'idx_donations_payment_intent_id','idx_ticket_orders_qr_code',
    'idx_fundraisers_organizer_id');
-- Expected: all present (ticket ones only where ticketing tables exist).
-- Missing notifications/donations/rate-limit indexes = BLOCKER (perf).

-- Function grants: service_role only (mirrors migration_54 convention)
SELECT grantee FROM information_schema.role_routine_grants
WHERE routine_schema='public'
  AND routine_name='create_ticket_order_with_inventory';
-- Expected: service_role (and owner). anon/authenticated present = BLOCKER.
```

## 5. Checklist

```text
[ ] Production project ref identified (§0)
[ ] Migration history lists 53/71/72/73 (§1)
[ ] RLS enabled on all sensitive tables (§2)
[ ] No USING(true) on user-owned tables (§2)
[ ] follows party-only policy present (§2)
[ ] organizers blanket policy absent; tax columns ungranted (§2)
[ ] updates/media published-parent gates present (§2)
[ ] Story trigger + function present; smoke test strips (§3)
[ ] Inventory functions present with service_role-only grants (§4)
[ ] Required indexes present (§4)
```

Every unchecked item after investigation = deployment blocker, except the
ticketing rows when ticket sales are intentionally retired (record the
decision explicitly instead).

---

## 6. Staging verification status (final C3 pass)

`STAGING DATABASE NOT AVAILABLE — LIVE DATABASE VERIFICATION REQUIRED`

Determined 2026-09-05 from repository/environment evidence (no connections
attempted, no credentials read):

- `.env.local` `NEXT_PUBLIC_SUPABASE_URL` resolves to a **remote cloud** host
  (not localhost); the linked project ref in `supabase/.temp/` is the
  production project. There is no staging/test project ref anywhere in the
  repo, and no `*.staging.*` / preview configuration.
- `npx supabase status` fails: Docker Desktop is unavailable, so the local
  Supabase stack cannot run here.
- Migrations 72/73 were therefore verified by: TypeScript + ESLint + production
  build + 65 pure-function/model security checks + SQL review against the
  canonical schema (column names from `ticket_orders_and_seats_schema.sql` /
  `migration_25` / `db/schema.sql`). Concurrency/idempotency proofs are model
  tests, not live-DB executions.

`STAGING NOT VERIFIED` ≠ `STAGING VERIFICATION FAILED`: nothing failed; there
was simply no authorized non-production database to execute against. The
operator MUST run §7 (reconciliation) and the §8 deployment sequence, including
the live smoke tests, before declaring the deploy healthy.

## 7. Historical ticket-inventory reconciliation (read-only)

Background: `tickets.quantity` was never decremented before migration_73, so
`current_quantity` almost certainly equals the originally configured stock and
overstates what remains wherever fulfilled orders exist.

Consumed semantics (from application code, not assumptions):

| Source | Statuses that CONSUME inventory |
|---|---|
| `ticket_orders` (Stripe fulfilled + crypto activated) | `valid`, `used` |
| `ticket_orders` (never consume) | `pending` (unpaid invoice in flight), `cancelled`, `refunded` |
| `seats` (consumed unit) | `sold` |
| `seats` (never consume) | `available`, `reserved` (transient; released by `release_expired_seat_reservations()`) |

Read-only reconciliation — run per ticket before enabling enforcement:

```sql
-- Per-ticket reconciliation: configured vs fulfilled vs current.
SELECT
  t.id                       AS ticket_id,
  t.name                     AS ticket_name,
  t.quantity                 AS configured_quantity,
  COALESCE(SUM(CASE WHEN o.status IN ('valid','used') THEN o.quantity ELSE 0 END), 0)
                             AS historical_consumed_quantity,
  (t.quantity - COALESCE(SUM(CASE WHEN o.status IN ('valid','used') THEN o.quantity ELSE 0 END), 0))
                             AS calculated_remaining_quantity,
  t.quantity                 AS current_quantity,
  COALESCE(SUM(CASE WHEN o.status IN ('valid','used') THEN o.quantity ELSE 0 END), 0)
                             AS difference
FROM tickets t
LEFT JOIN ticket_orders o ON o.ticket_id = t.id
GROUP BY t.id, t.name, t.quantity
ORDER BY difference DESC;
```

Pending exposure (informational — do NOT subtract; these may still pay):

```sql
SELECT ticket_id, COUNT(*) AS pending_orders, SUM(quantity) AS pending_units
FROM ticket_orders
WHERE status = 'pending'
GROUP BY ticket_id;
```

Seat cross-check (per event):

```sql
SELECT event_id, status, COUNT(*) FROM seats GROUP BY event_id, status;
-- 'sold' seats should roughly track fulfilled seat-orders; large gaps need review.
```

**Findings to expect:** every ticket with fulfilled sales will show
`difference > 0` (i.e. `current_quantity != calculated_remaining`). That is
the known historical gap, not a new bug.

**Safe operator procedure (no automatic mutation):**

```text
1. Confirm backup/PITR availability (restore tested or retention verified).
2. Run the read-only queries above; save output with the deploy record.
3. Review each difference > 0: confirm the orders are genuine (spot-check
   payment intents / NOWPayments invoices for the largest gaps).
4. If reliable, apply ONE explicit correction per ticket with an optimistic
   guard so a concurrent sale aborts instead of silently stacking:
     UPDATE tickets SET quantity = <calculated_remaining>
     WHERE id = '<ticket_id>' AND quantity = <observed_current>;
   (0 rows affected = someone moved it; re-run the query, do not force it.)
5. Re-run the reconciliation: all differences must be 0.
6. Only then enable inventory enforcement (deploy the app calling the RPCs).
```

If fulfilled history cannot be trusted (e.g. test orders, duplicates, or the
`ticket_orders` table was reseeded), **do not correct**: record
`RECONCILIATION INCONCLUSIVE`, keep enforcement deployed (it is correct
going forward from whatever baseline exists), and reconcile by physical
capacity instead. Never claim inventory readiness while an unreviewed
difference remains.

## 8. Migration safety audit (72 + 73)

### Migration 72 — classification `A — Fully reversible`
- Removes nothing pre-existing; adds one function + one trigger.
- Transforms no existing rows (trigger fires only on future INSERT/UPDATE OF
  story). Rows written while active keep stripped content — intended effect,
  not reverted, and safe to keep.
- Rollback drops trigger first, then function (correct dependency order); no
  grants were issued; no dependents exist outside the trigger.
- Restores exact prior behavior.

### Migration 73 — classification `A — Fully reversible (schema only)`
- Adds three functions + grants; drops in reverse-dependency order
  (activate/create before try_consume). Grants die with the functions.
- Transforms no rows. **Critical distinction:** quantities consumed later by
  application calls are business data, NOT migration effects — a schema
  rollback does NOT (and must NOT) reverse already-consumed inventory or
  delete fulfilled orders.
- Rolling back after go-live only disables future atomic fulfillment; existing
  orders/quantities stay intact. Webhook code calling a dropped function would
  error loudly (monitored), which is why rollback order is app-first (§9).

### Failure scenarios
- **72 succeeds, 73 fails:** safe state. 72 is independent. Fix 73 forward
  (re-run the file; `CREATE OR REPLACE` + `DROP ... IF EXISTS` make it
  idempotent) — do not roll back 72 to "match".
- **73 succeeds, app deploy fails:** safe state. Old webhooks don't call the
  new functions; new functions sit unused. Fix the app forward. Schema
  rollback is allowed but unnecessary.
- **App deployed, fulfillment RPC errors at runtime** (e.g. grants missed):
  orders are NOT created and inventory is NOT consumed (single transaction) —
  the payment may still be captured (Stripe) → the sold-out refund path and
  error logs fire. Forward-fix grants/permissions; do NOT roll back the app
  while captured payments need the refund path. For crypto, orders stay
  `pending` and can activate after the fix.

### Deployment sequence (expand → migrate → contract)
Both migrations are purely additive (EXPAND) and backward-compatible: old code
runs unchanged against the new schema. No CONTRACT step exists (nothing old is
removed). Safe order:

```text
1. Confirm production database identity (§0)
2. Confirm backup/PITR availability (restore point taken)
3. Verify current migration state (§1–§2); record baseline
4. Run read-only inventory reconciliation (§7); resolve discrepancies
5. Apply migration 72; verify trigger + smoke test (§3 in prior doc §3)
6. Apply migration 73; verify functions + grants (§4)
7. Deploy application (the only behavior switch: webhooks now call RPCs)
8. Run payment/ticket smoke tests (donation + ticket intent, no real money:
   use Stripe test mode / NOWPayments sandbox + webhook retries)
9. Monitor errors (fulfillment RPC errors, CRITICAL sold_out/shortfall logs)
10. Confirm inventory invariants (no negative quantities; consumed == fulfilled)
11. Declare deployment healthy; file the verification record
```

Rollback order (only if needed): revert application FIRST, then optionally
drop 73/72 functions. Never roll back schema while the new app is serving.

### Backup/PITR requirement
A verified restore point before step 5 is REQUIRED (not optional): 72/73 are
safe, but step 4 corrections and any fulfillment activity after step 7 are
business data. Without PITR, an operator error during reconciliation has no
recovery path.

## 9. Required deployment blockers (final)

```text
[ ] Production migration state unknown
[ ] Production backup/PITR unavailable or unverified
[ ] Migration 72 fails verification
[ ] Migration 74 (enumeration-oracle revoke) not applied
[ ] RLS unexpectedly weakened
[ ] Payment/order (donation) idempotency broken
[ ] Story sanitization bypassed (server path or trigger missing)
[ ] Required donation/notification/fundraiser indexes missing
[ ] Hosted Auth OTP expiry not set to 30 minutes (§11)
[ ] Hosted Auth rate limits not confirmed (§11)
[ ] Staging verification fails (currently: STAGING NOT VERIFIED — see §6)
```

LEGACY (not blockers for the fundraising product — see §10):

```text
[ ] Migration 73 / inventory functions unverified (LEGACY — ticketing retired)
[ ] Ticket inventory cannot be reconciled (RETIRED — no ticket sales)
[ ] Seat inventory unverified (RETIRED — no seat sales)
```

## 10. Current product scope vs legacy event/ticket functionality

Current product: auth, fundraisers + stories + media, organizers/orgs,
beneficiaries, **donation** payments (Stripe PaymentElement via
`/api/donate/intent`; NOWPayments crypto via `/api/crypto/create-payment`
`type:"donation"`), donation webhooks (Stripe signature-verified;
NOWPayments HMAC), receipts/certificates, fundraiser-updates, comments
(fundraiser-only), reviews, notifications, follows, search/campaigns, admin
moderation, verification/identity, import/gofundme-sync. Payouts (no Connect
integration — placeholder UI) and messaging (empty-state page, no backend)
are explicitly not implemented.

| Functionality | Classification | Evidence | Action |
|---|---|---|---|
| Event pages / checkout UI | DEAD | No `/events` or `/dashboard/events` pages; DonatePage calls only donation endpoints | None (redirects in `next.config.ts` stay) |
| `events`/`tickets`/`ticket_orders`/`seats` tables | LEGACY | Dropped by migration_65 if applied; guarded `?? []` queries degrade if absent | Do not re-add; do not query in new code |
| `lib` event helpers (`queryDashboardEvents`, `deleteEvents…`, `exportEventsCsv`) | DEAD | Zero callers in `app/` | None (do not delete in this pass) |
| Ticket intent routes + `lib/ticket-pricing.ts` | LEGACY (protective) | No UI initiates ticket purchases; pricing is DB-authoritative | KEEP as-is; not a blocker |
| Ticket webhook branches, `crypto/status` ticket lookups, `comments/verify` event branch | LEGACY | Reachable only with ticket-kind metadata / `targetType=event`; donation branches are current | KEEP; donation branches stay in scope |
| Dashboard/admin event+ticket sections | LEGACY (degrading) | Live pages, empty-safe via guards | KEEP; show empty when tables absent |
| Migration 73 + inventory RPCs | LEGACY PRODUCT MIGRATION | Meaningful only if ticketing tables exist | Safe to apply AND safe to leave (callers 404/410/RPC-catch); NOT a blocker; do not roll back blindly if present in prod |
| C1 ticket pricing / inventory oversell / fulfillment / seat findings | RETIRED — OUT OF CURRENT PRODUCT SCOPE | Product has no ticket sales | Removed from blockers; code retained protectively |

Retired-component rule: `SCOPE UNCERTAIN — OPERATOR/PRODUCT CONFIRMATION REQUIRED` applies only if a future change re-connects ticket flows to checkout; until then the §7 reconciliation is retired with the feature (revive it before any ticket relaunch).

## 11. Hosted Auth verification (H1/H2 — operator action, not verifiable from repo)

`supabase/config.toml` now sets `otp_expiry = 1800` (30 minutes), but that
file configures **local `supabase start` only**. The hosted project must be
confirmed in Dashboard → Authentication:

```text
[ ] Sign-in / Sign-up → Email OTP expiry = 1800 seconds (30 minutes)
[ ] Rate limits → per-email / per-IP Auth limits enabled (signup, sign-in,
    password recovery, OTP verification). Client-side Supabase Auth calls
    (login/signup/forgot-password pages) cannot be limited from this repo —
    these hosted limits are the enforcement point.
[ ] Password-reset email redirects to the production /reset-password URL.
```

Until confirmed, record `HOSTED AUTH NOT VERIFIED`. The in-repo application
rate limiter (Postgres-backed, `lib/rate-limit.ts`) covers only the
server-side API routes listed in §12 and does not apply to Supabase Auth.

## 12. Application rate-limit inventory (H2)

Budgets live in `lib/rate-limit.ts` (Postgres-backed, multi-instance safe;
429 + Retry-After + `Cache-Control: no-store`; fails open on DB outage by
documented design). Authenticated callers key on user id, anonymous on IP
(Vercel edge headers; untrusted off-Vercel — see code comments).

Newly protected in the H-pass (before: beneficiaryInvite, paymentIntent,
importUrl, commentLike only):

```text
cryptoPayment      POST /api/crypto/create-payment            auth-or-IP  10/10m
commentPost        POST /api/comments, GET /api/comments/verify  user-or-IP 20/h
reviewPost         POST /api/reviews                          user      10/h
followToggle       POST /api/follow                           user      30/h
fundraiserCreate   POST /api/fundraisers                      user       5/h
fundraiserUpdate   POST /api/fundraiser-updates, PATCH /api/fundraisers/[id]  user  30/h
verificationSubmit POST /api/verification/submit|document|document-url, /api/identity-verification/submit|document  user  10/h
beneficiaryClaim   POST /api/beneficiary/claim                user      10/h
geocode            GET  /api/geocode                          IP       100/h
statusPoll         GET  /api/crypto/status                    IP        60/h
documentFetch      GET  /api/certificates/[id], /api/receipts/[id], /api/receipts/lookup  IP  30/h
mediaImport        POST /api/media/import                     user      20/h
gofundmeSync       POST /api/gofundme-sync                    user      10/h
dataExport         GET  /api/dashboard/*/export, /api/dashboard/reports(+/export), /api/admin/*/export  user  30/h
accountAction      DELETE /api/account, POST /api/account/recover  user  5/h
```

Deliberately NOT limited: Stripe/NOWPayments webhooks and cron (provider
signature / shared-secret gated; must survive retry storms), admin routes
(admin-only), read-only authenticated GETs (notifications, donor history,
dashboard lists), public read GETs (comments/reviews/donors lists — the
product surface; scraping accepted as residual risk).
