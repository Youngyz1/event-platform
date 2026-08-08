-- migration_58_verification_documents_bucket_rollback.sql
--
-- WARNING: this removes the ONLY private storage on the project. Any identity
-- or registration document already uploaded must be dealt with first — the
-- bucket delete below fails while objects remain, which is deliberate: it
-- forces a conscious decision about the documents rather than silently
-- destroying them.
--
-- To see what would be lost:
--   SELECT name, created_at FROM storage.objects
--   WHERE bucket_id = 'verification-documents';

BEGIN;

DROP POLICY IF EXISTS "Users upload own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users update own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete verification documents" ON storage.objects;

-- Fails if the bucket still holds objects. Remove them explicitly first if
-- that is genuinely what you intend.
DELETE FROM storage.buckets WHERE id = 'verification-documents';

COMMIT;
