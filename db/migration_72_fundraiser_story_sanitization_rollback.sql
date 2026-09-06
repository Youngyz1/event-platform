-- migration_72_fundraiser_story_sanitization_rollback.sql
-- Manual operator rollback for migration_72. Drops the backstop trigger and
-- function. Stored rows are NOT re-modified (stripped content stays stripped).

BEGIN;

DROP TRIGGER IF EXISTS trg_sanitize_fundraiser_story ON fundraisers;
DROP FUNCTION IF EXISTS sanitize_fundraiser_story();

COMMIT;

NOTIFY pgrst, 'reload schema';
