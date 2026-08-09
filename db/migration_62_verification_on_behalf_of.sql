-- migration_62_verification_on_behalf_of.sql
--
-- Closes spec item 1 from the 2026-08-09 verification audit: a content
-- creator raising money FOR an organization (not personally) had no way to
-- declare that or record their relationship/consent — they just silently
-- re-entered as a generic nonprofit/business submitter with no link back to
-- the fact a creator, not the org itself, is the one submitting.
--
-- Two columns on the existing organizer_verification row. No new table: the
-- wizard already routes an "on behalf of" submission through the existing
-- nonprofit/business requirement set (same documents, same review queue) —
-- this just records the declaration and the stated relationship alongside
-- it, exactly where a reviewer is already looking.

ALTER TABLE organizer_verification
  ADD COLUMN IF NOT EXISTS on_behalf_of_org boolean NOT NULL DEFAULT false;

ALTER TABLE organizer_verification
  ADD COLUMN IF NOT EXISTS on_behalf_relationship text;

-- No RLS change needed: both columns fall under the existing row-level
-- policies (owners read/write their own row while draft/changes_requested;
-- admins read/manage all) since organizer_verification has no column-level
-- grants the way organizers does — access is controlled per-row, not
-- per-column, for this table.
