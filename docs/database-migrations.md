# Database migrations — canonical source of truth (C3)

> Status: `db/` is canonical. Everything else is a snapshot, stub, or
> incomplete history. Read this before touching any `.sql` file.

## 1. Canonical location: `db/`

- Chronological migrations: `db/migration_01_*.sql` … `db/migration_74_*.sql`
  (`migration_73_ticket_inventory` is a LEGACY product migration — ticketing is
  retired; safe to apply and safe to leave, see `docs/production-verification.md` §10;
  `migration_74` revokes the H3 enumeration oracle and is CURRENT),
  (plus lettered patches `67b/67c/67d`), and standalone schemas
  (`donations_schema.sql`, `comments_schema.sql`, `organizers_schema.sql`,
  `ticket_orders_and_seats_schema.sql`, `import_sources_schema.sql`,
  `gofundme_sources_schema.sql`, `eventbrite_sources_schema.sql`).
- Rollback companions: `db/*_rollback.sql` (26 files). These are
  **manual, best-effort** scripts for operators — they are NOT an automated
  down-migration system and most have never been executed against production.
  Never assume “rollback = safe”; see §5.
- How to create a migration: copy the header/body convention of
  `db/migration_71_follows_privacy.sql` (numbered prefix, `BEGIN;` … `COMMIT;`,
  `DROP POLICY IF EXISTS` before `CREATE POLICY`, trailing
  `NOTIFY pgrst, 'reload schema';`), add the matching `*_rollback.sql`, and
  apply with the Supabase CLI / SQL editor against staging first.
- How migrations are applied: manually via Supabase tooling (there is no
  CI job that pushes migrations — `ls .github/workflows` is empty). The
  operator must record which files were applied; the repo cannot tell you
  what production has run (see §4).

## 2. What the other files are (NOT canonical)

| Path | What it is | Rule |
|---|---|---|
| `supabase/migrations/` | Incomplete history: contains ONLY `20260828231400_migration_71_follows_privacy.sql` (content-identical to `db/migration_71_follows_privacy.sql`). Supabase CLI expects full history here; a single file means `supabase db push` / `supabase migration list` does NOT reflect the real schema. | Do not treat as authoritative. Do not add one-off files here without backfilling 01–70 or documenting why. |
| `db/schema.sql` (58 KB) | Stale consolidated dump/snapshot. Predates hardening migrations. | Reference only. Never restore production from it (see §3). |
| `schema.sql` (repo root) | Broken stub (historical accident — contains npm install prompt output, not SQL). Kept as a pointer so old scripts referencing it fail loudly instead of silently. | Do not use as a schema. |
| `db/*_rollback.sql` | Manual operator aids, not tested automation. | Read before running; several are destructive-by-design. |

## 3. Security-policy drift that motivated this note (C3.2)

`db/schema.sql` still contains blanket policies that `db/migration_53_*` and
`db/migration_71_*` intentionally removed. Permissive policies are OR-ed, so
any surviving `USING (true)` defeats the hardened policy:

| Table | Stale `db/schema.sql` (DO NOT DEPLOY) | Intended policy (`db/` canonical) |
|---|---|---|
| `organizers` | `"Public read organizers" USING (true)` | `migration_53`: drop it; keep `"Public organizers are readable"` scoped to `(visibility='public' AND deleted_at IS NULL) OR auth.uid()=user_id`, plus column-level GRANT excluding `tax_id` / `nonprofit_registration_number` |
| `fundraiser_updates` | `"Public can view fundraiser updates" USING (true)` | `migration_53`: drop it; `"Updates of published fundraisers are readable"` only when parent `fundraisers.status='published' AND deleted_at IS NULL` |
| `fundraiser_media` | `"Fundraiser media is publicly readable" / "Public can view fundraiser media" USING (true)` | `migration_53`: drop both; `"Media of published fundraisers is readable"` with the same published-parent gate |
| `organizer_follows` | `"Organizer follows are publicly readable" / "Anyone can view follows" USING (true)` (exposes `user_id`) | `migration_53` + `migration_71`: party-only reads (`auth.uid()=follower_id OR auth.uid()=following_id` on `follows`) |
| `notifications` | (no stale equivalent; always scoped) | `migration_44`: `auth.uid()=user_id` for SELECT/UPDATE, inserts service-role only |

Consequence: restoring a database from `db/schema.sql` (or from any snapshot
that predates 53/71) silently re-opens these reads. Always apply the full
`db/migration_*` chain after any snapshot restore.

## 4. Production verification

`PRODUCTION DATABASE STATE REQUIRES EXTERNAL VERIFICATION`

The repository records intent, not deployment. To verify production:

1. `supabase migration list` (or `SELECT * FROM supabase_migrations.schema_migrations`)
   against the PRODUCTION project and compare with `db/migration_*`.
2. Query `pg_policies` for the five tables above and confirm no `USING (true)`
   SELECT policy survives.
3. Confirm `supabase/.temp/*` (local CLI state, currently untracked/modified in
   some checkouts) is never used as deployment evidence.

## 5. Rollback / backwards-compatibility notes (C3.5)

- Non-destructive (safe to roll code back): `53` (policy/grant tightening —
  old code that used explicit column lists keeps working; note old code doing
  `select("*")` on `organizers` FAILS by design), `54` (new `rate_limits`
  table; limiter fails open), `58` (new private bucket), `68–71` (policy /
  display-preference / backfill changes).
- Destructive / NOT code-compatible: `migration_65_remove_events_and_tickets`
  (`DROP TABLE events/tickets/ticket_orders/seats/venue_layouts CASCADE` —
  historical ticket data cannot be restored; ticket purchase endpoints now
  return `410 Gone`). Rolling application code back across 65 does not bring
  the tables back.
- Data migrations (`70` backfill display names, `67*` trigger rewrites, `31/33`
  backfills) are one-way; their `*_rollback.sql` files (where present) drop
  objects rather than restoring prior data.
- Rule: ship schema changes as expand-then-contract (additive first, destructive
  separately) and never assume a previous app version runs against the new
  schema without checking this section.

## 6. Preventing future drift

1. `db/` is the only place new migrations land. Never edit `db/schema.sql` by
   hand — regenerate it from a migrated database when a fresh snapshot is needed.
2. Keep `supabase/migrations/` in sync (backfill 01-70/72-73 or remove the directory
   and document the CLI workflow); a one-file history is worse than none because
   it looks complete.
3. CI check (recommended): fail the build if `supabase db diff` against a
   migrated staging database is non-empty, or if any `USING (true)` SELECT
   policy exists on user-owned tables.
