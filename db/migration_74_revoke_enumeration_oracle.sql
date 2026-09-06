-- migration_74_revoke_enumeration_oracle.sql
--
-- H3: close the account-enumeration oracle at the PostgREST layer.
--
-- `check_email_pending_deletion(text)` (migration_39, SECURITY DEFINER) was
-- created without any REVOKE, so PostgreSQL's default PUBLIC execute grant
-- lets any anonymous caller invoke it directly over the Data API
-- (`/rest/v1/rpc/check_email_pending_deletion`) with an arbitrary email and
-- learn whether that email sits in the pending-deletion grace period — even
-- after the /api/signup-guard route was removed.
--
-- This migration revokes direct execution from everyone except the owner and
-- service_role. No application code calls this function anymore (verified:
-- the deleted signup-guard route was its only caller), so nothing breaks.
-- The account-recovery flow does not use it (it reads the caller's own
-- profile row server-side).
--
-- Rollback: db/migration_74_revoke_enumeration_oracle_rollback.sql
-- (restores the default PUBLIC grant; only use if a legitimate caller needs
-- direct RPC access, which none currently does).

BEGIN;

REVOKE ALL ON FUNCTION public.check_email_pending_deletion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_email_pending_deletion(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_pending_deletion(text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
