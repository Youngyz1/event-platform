-- migration_74_revoke_enumeration_oracle_rollback.sql
-- Manual operator rollback for migration_74. Restores the PostgreSQL default
-- PUBLIC execute grant on check_email_pending_deletion. Re-opens the
-- enumeration oracle — only apply if a legitimate direct-RPC caller exists
-- (none does as of this writing).

BEGIN;

GRANT EXECUTE ON FUNCTION public.check_email_pending_deletion(text) TO PUBLIC;

COMMIT;

NOTIFY pgrst, 'reload schema';
