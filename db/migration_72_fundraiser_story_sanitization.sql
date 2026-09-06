-- migration_72_fundraiser_story_sanitization.sql
--
-- Obj1 backstop: neutralize executable HTML in `fundraisers.story` at the
-- database boundary, so a custom client writing through Supabase RLS directly
-- cannot persist scriptable content by bypassing the application.
--
-- Layering (defense in depth, each layer independent):
--   1. Editor validation (lib/safe-url.ts + TipTap isAllowedUri)
--   2. Server API sanitization (POST/PATCH /api/fundraisers via
--      lib/sanitize-html.ts, isomorphic-dompurify) — authoritative app path
--   3. THIS TRIGGER — plain-form backstop for any other writer
--      (direct RLS inserts, CSV import, SQL editor, future code paths)
--   4. Renderer DOMPurify (FundraiserStory) on display — authoritative for
--      display, and the layer that also neutralizes entity-obfuscated forms
--      (&#106;avascript:) which this trigger intentionally does not decode
--
-- The trigger STRIPS (never rejects): rejecting would turn edge-case content
-- into failed saves, while stripping fails safe in the display direction.
-- Legitimate fundraiser formatting (paragraphs, headings, lists, links,
-- images, video) is preserved; only executable vectors are removed.
--
-- SCOPE: fundraisers.story only. fundraiser_updates.content is written
-- exclusively through POST /api/fundraiser-updates (server-sanitized).
--
-- Rollback: db/migration_72_fundraiser_story_sanitization_rollback.sql
-- (drops the trigger + function; stored rows are NOT re-modified).

BEGIN;

CREATE OR REPLACE FUNCTION sanitize_fundraiser_story()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.story IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Remove <script ...>...</script> blocks (case-insensitive), then any
  --    stray opening <script ...> without a closer.
  NEW.story := regexp_replace(NEW.story, '<script[^>]*>.*?</script\s*>', '', 'gis');
  NEW.story := regexp_replace(NEW.story, '<script[^>]*>', '', 'gi');

  -- 2. Remove event-handler attributes (onload=, onerror=, onclick=, ...),
  --    double-quoted, single-quoted, and unquoted forms.
  NEW.story := regexp_replace(NEW.story, '\s+on[a-z]+\s*=\s*"[^"]*"', '', 'gi');
  NEW.story := regexp_replace(NEW.story, '\s+on[a-z]+\s*=\s*''[^'']*''', '', 'gi');
  NEW.story := regexp_replace(NEW.story, '\s+on[a-z]+\s*=\s*[^\s>]+', '', 'gi');

  -- 3. Neutralize dangerous URL schemes in href/src attributes by replacing
  --    the scheme with "blocked:" (structure preserved, URL inert).
  --    Covers: javascript, data, vbscript, file, blob.
  NEW.story := regexp_replace(
    NEW.story,
    '(href|src)(\s*=\s*["'']?\s*)(javascript|data|vbscript|file|blob)\s*:',
    '\1\2blocked:',
    'gi'
  );

  -- 4. Neutralize scriptable URLs inside style attributes and IE expression().
  NEW.story := regexp_replace(NEW.story, 'javascript\s*:', 'blocked:', 'gi');
  NEW.story := regexp_replace(NEW.story, 'vbscript\s*:', 'blocked:', 'gi');
  NEW.story := regexp_replace(NEW.story, 'expression\s*\(', 'blocked-preserving-removed(', 'gi');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sanitize_fundraiser_story ON fundraisers;
CREATE TRIGGER trg_sanitize_fundraiser_story
  BEFORE INSERT OR UPDATE OF story ON fundraisers
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_fundraiser_story();

COMMIT;

NOTIFY pgrst, 'reload schema';
