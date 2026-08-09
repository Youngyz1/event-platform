-- migration_63_verification_events_notes_column_grant.sql
--
-- Closes the RLS gap found in the 2026-08-09 spec audit (item 2): migration_59
-- put admin-only internal notes in verification_events.metadata with a code
-- comment claiming they're "never in a column the organizer can read" — but
-- that was never actually enforced. RLS filters ROWS, not COLUMNS, and
-- "Owners read own verification history" (migration_59) lets an owner SELECT
-- their own event rows with no column restriction. Confirmed live: anon and
-- authenticated both have the table's default SELECT grant, including on
-- metadata (has_column_privilege('authenticated', 'verification_events',
-- 'metadata', 'SELECT') = true, before this migration).
--
-- Same fix shape as migration_53 on organizers: table-wide SELECT is
-- column-restricted rather than trying to filter at the RLS layer (RLS can't
-- do column-level filtering at all). Every current call site that touches
-- this table is a service-role .insert() with no .select() chained (checked:
-- app/api/verification/submit, app/api/admin/verification/review,
-- app/api/admin/verification/document) — none of them are affected by this
-- grant change, unlike the two bugs migration_53 accidentally introduced.
--
-- Chose this over a separate admin-only table because it's strictly less
-- invasive: no new table, no new RLS policies, no schema migration for
-- existing rows to move — just narrowing an already-too-broad grant on the
-- table that already exists for exactly this purpose.

REVOKE SELECT ON verification_events FROM anon, authenticated;

GRANT SELECT (
  id, verification_id, actor_id, action, reason, created_at
) ON verification_events TO anon, authenticated;

-- metadata (internal_note) is now readable only by service-role code, which
-- is how every admin route already reads/writes this table.
