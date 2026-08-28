-- migration_71_follows_privacy_rollback.sql
-- Reverts migration_71: restores the original fully-public SELECT policy.

DROP POLICY IF EXISTS "Only parties to a follow can read it" ON follows;

CREATE POLICY "Follows are publicly readable"
  ON follows FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
