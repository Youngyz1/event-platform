-- migration_61_restore_proof_of_authority_required_rollback.sql
--
-- Re-relaxes `proof_of_authority` to optional for the nonprofit base tier,
-- putting the database back into migration_60's state.
--
-- READ THIS BEFORE RUNNING IT. Migration_61 restored this requirement as a
-- deliberate product decision, not a mechanical correction: the registration
-- documents prove an organisation exists, while proof_of_authority proves the
-- submitter may act for it. Making it optional again means someone can verify
-- an organisation they have no connection to using its publicly available
-- registration certificate alone.
--
-- Business is not touched here — it has required proof_of_authority
-- continuously since migration_59 and was never part of the relaxation.

BEGIN;

UPDATE verification_requirements
SET is_required = false
WHERE organizer_type = 'nonprofit'
  AND subcategory IS NULL
  AND country IS NULL
  AND document_type = 'proof_of_authority';

COMMIT;

NOTIFY pgrst, 'reload schema';
