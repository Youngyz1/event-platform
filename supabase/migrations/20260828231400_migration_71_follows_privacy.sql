-- migration_71_follows_privacy.sql
-- Tightens the SELECT policy on the `follows` table so that only the two
-- parties to a follow relationship can read the row.
-- The previous policy was USING (true) (fully public).
--
-- Impact analysis (checked before writing):
--   1. Follower/following COUNTS on /profile/[id]: supabaseAdmin (service-role)
--      -- bypasses RLS entirely, counts are unaffected.
--   2. Follow LIST fetch in ProfileClient.tsx: anon client -- correctly
--      restricted after this change. App-layer gate also added in same session.
--   3. INSERT/DELETE policies: unchanged.
--   4. isFollowing check in page.tsx: supabaseAdmin -- unaffected.

-- Replace the open SELECT policy with a party-only policy
DROP POLICY IF EXISTS "Follows are publicly readable" ON follows;
DROP POLICY IF EXISTS "Only parties to a follow can read it" ON follows;

CREATE POLICY "Only parties to a follow can read it"
  ON follows FOR SELECT
  USING (
    auth.uid() = follower_id
    OR auth.uid() = following_id
  );

NOTIFY pgrst, 'reload schema';
