-- migration_58_verification_documents_bucket.sql
--
-- Phase 1 of organizer verification: private storage for identity and
-- registration documents.
--
-- Every existing bucket on this project is PUBLIC (videos, event-videos,
-- organizer-images, organizer-banners, profile-images, fundraiser-media,
-- event-banners), and the only upload helper is uploadPublicFile. There was
-- nowhere a government ID or registration certificate could go without being
-- published at a guessable URL. This creates that place.
--
-- SCOPE: bucket + policies only. No application tables — the verification
-- schema is a separate phase.
--
-- Rollback: db/migration_58_verification_documents_bucket_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Bucket
--
-- public=false is the whole point: Supabase will not serve these objects from
-- the public object endpoint, so the only way to read one is a signed URL
-- minted server-side.
--
-- The MIME allow-list is a real control, not decoration. Without it an HTML or
-- SVG file could be stored and later opened through a signed URL, executing in
-- the viewer's origin. Only document formats are accepted.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- Policies
--
-- Path convention: verification-documents/<auth.uid()>/<uuid>-<filename>
-- Keyed on user id rather than organizer id to match the convention already
-- used by profile-images and fundraiser-media, and so this phase carries no
-- dependency on verification tables that do not exist yet.
--
-- Every policy below is scoped with `bucket_id = 'verification-documents'`.
-- Every pre-existing storage policy is likewise bucket-scoped and there is no
-- catch-all, so these cannot widen or alter access to any other bucket.
--
-- NOTE: there is deliberately NO SELECT POLICY.
-- With none, neither anon nor authenticated can read or even list an object —
-- including its owner. Reads go through a service-role server action
-- (/api/verification/document-url) that authorises owner-or-admin in
-- application code and returns a 60-second signed URL. One read path, so there
-- is no second route that bypasses that authorisation or any later auditing.
-- ---------------------------------------------------------------------------

-- 1. Upload into your own folder only.
DROP POLICY IF EXISTS "Users upload own verification documents" ON storage.objects;
CREATE POLICY "Users upload own verification documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 2. Overwrite your own only (supports upsert on re-upload).
DROP POLICY IF EXISTS "Users update own verification documents" ON storage.objects;
CREATE POLICY "Users update own verification documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- 3. Delete: admins only.
--
-- Owners deliberately cannot delete. Once a document has been submitted for
-- review it is evidence, and letting the subject of a review remove it is the
-- wrong default. Owner-initiated replacement belongs in the review workflow
-- (a later phase), not in storage permissions.
--
-- Mirrors the admin predicate used by 16 existing policies, including its
-- `status = 'active'` clause — so a suspended or purged admin loses this
-- access automatically.
DROP POLICY IF EXISTS "Admins delete verification documents" ON storage.objects;
CREATE POLICY "Admins delete verification documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.status = 'active'
    )
  );

COMMIT;
