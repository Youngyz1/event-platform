-- migration_60_nonprofit_proof_of_authority_optional.sql
--
-- Data change, not schema: make `proof_of_authority` OPTIONAL for the nonprofit
-- base tier (organizer_type='nonprofit', subcategory IS NULL, country IS NULL).
--
-- Written as an UPDATE rather than a delete-and-reinsert so the row keeps its
-- id and created_at. Anything that later references a requirement row — a
-- document, an audit event — keeps pointing at the same record, and the seed
-- history stays readable.
--
-- SCOPE IS DELIBERATELY NARROW. `proof_of_authority` also exists as a separate
-- row under organizer_type='business' (required, sort_order 30). An UPDATE
-- keyed only on document_type would silently flip that one too, quietly
-- weakening business verification. Every part of the key is therefore pinned:
--
--   organizer_type = 'nonprofit'
--   subcategory IS NULL          -- base tier only, not the orphanage override
--   country IS NULL              -- the default rule, not a country-specific one
--   document_type = 'proof_of_authority'
--
-- The orphanage override is untouched and keeps working: resolveRequirements
-- unions across tiers and picks the most specific rule PER DOCUMENT, so an
-- orphanage still resolves to the nonprofit base documents (with
-- proof_of_authority now optional) plus its own required
-- facility_authorisation.
--
-- Rollback: db/migration_60_nonprofit_proof_of_authority_optional_rollback.sql

BEGIN;

UPDATE verification_requirements
SET is_required = false
WHERE organizer_type = 'nonprofit'
  AND subcategory IS NULL
  AND country IS NULL
  AND document_type = 'proof_of_authority';

-- Guard: exactly one row should have moved. Anything else means the key did
-- not pin what it was supposed to, and the transaction is abandoned rather
-- than leaving the requirement set in an unintended state.
DO $$
DECLARE
  optional_count integer;
  business_still_required integer;
BEGIN
  SELECT count(*) INTO optional_count
  FROM verification_requirements
  WHERE organizer_type = 'nonprofit' AND subcategory IS NULL AND country IS NULL
    AND document_type = 'proof_of_authority' AND is_required = false;

  IF optional_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 optional nonprofit proof_of_authority row, found %', optional_count;
  END IF;

  SELECT count(*) INTO business_still_required
  FROM verification_requirements
  WHERE organizer_type = 'business' AND document_type = 'proof_of_authority'
    AND is_required = true;

  IF business_still_required <> 1 THEN
    RAISE EXCEPTION 'Business proof_of_authority should still be required, found % required rows', business_still_required;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
