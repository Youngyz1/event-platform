-- migration_59_organizer_verification_schema_rollback.sql
--
-- WARNING: this destroys every verification submission, document record and
-- audit event. The audit trail exists precisely so decisions can be
-- reconstructed later; dropping it is not recoverable.
--
-- It does NOT delete the files themselves — those live in the
-- verification-documents bucket (migration_58) and would be orphaned, still
-- occupying storage with nothing pointing at them. Check what would be
-- stranded first:
--
--   SELECT storage_path, uploaded_at FROM verification_documents;
--
-- Nothing here touches organizers, fundraisers or profiles: migration_59 added
-- no columns to existing tables, deliberately, so this rollback cannot affect
-- the public directory or any live campaign.

BEGIN;

-- Children first; the FKs are ON DELETE CASCADE but explicit order keeps the
-- intent obvious.
DROP TABLE IF EXISTS verification_events;
DROP TABLE IF EXISTS verification_documents;
DROP TABLE IF EXISTS verification_requirements;
DROP TABLE IF EXISTS organizer_verification;

COMMIT;

NOTIFY pgrst, 'reload schema';
