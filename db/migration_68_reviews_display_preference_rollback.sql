-- db/migration_68_reviews_display_preference_rollback.sql
-- Rollback for Migration 68: drop display_preference column and restore original constraint including legacy event_id.

ALTER TABLE reviews DROP COLUMN IF EXISTS display_preference;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_target_or_platform;

ALTER TABLE reviews ADD CONSTRAINT reviews_target_or_platform CHECK (
  (review_type = 'platform' AND event_id IS NULL AND fundraiser_id IS NULL AND organizer_id IS NULL) OR
  (review_type != 'platform' AND ((event_id IS NOT NULL)::integer + (fundraiser_id IS NOT NULL)::integer + (organizer_id IS NOT NULL)::integer >= 1))
);

NOTIFY pgrst, 'reload schema';
