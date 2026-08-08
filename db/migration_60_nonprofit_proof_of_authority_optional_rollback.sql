-- migration_60_nonprofit_proof_of_authority_optional_rollback.sql
--
-- Restores `proof_of_authority` to REQUIRED for the nonprofit base tier.
--
-- Same narrow key as the forward migration: business keeps its own separate
-- proof_of_authority row and must not be touched here either.
--
-- Note this affects only what the requirement engine ASKS FOR in future. Any
-- nonprofit that submitted while the document was optional will not
-- retroactively become incomplete in the database — evaluateSubmission scores
-- against the requirement set at read time, so a previously-submitted
-- verification will simply start reporting the document as missing on next
-- evaluation. Consider whether in-flight submissions need re-requesting.

BEGIN;

UPDATE verification_requirements
SET is_required = true
WHERE organizer_type = 'nonprofit'
  AND subcategory IS NULL
  AND country IS NULL
  AND document_type = 'proof_of_authority';

COMMIT;

NOTIFY pgrst, 'reload schema';
