-- db/migration_68_reviews_display_preference.sql
-- Migration 68: Add display_preference column to reviews and remove legacy event_id from reviews_target_or_platform constraint.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS display_preference TEXT DEFAULT 'full'
    CHECK (display_preference IN ('full', 'initial', 'anonymous'));

-- Drop old constraint that referenced event_id
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_target_or_platform;

-- Recreate constraint without legacy event_id
ALTER TABLE reviews ADD CONSTRAINT reviews_target_or_platform CHECK (
  (review_type = 'platform' AND fundraiser_id IS NULL AND organizer_id IS NULL) OR
  (review_type != 'platform' AND ((fundraiser_id IS NOT NULL)::integer + (organizer_id IS NOT NULL)::integer >= 1))
);

NOTIFY pgrst, 'reload schema';
