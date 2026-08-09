-- migration_61_restore_proof_of_authority_required.sql
--
-- Restores `proof_of_authority` to REQUIRED for the nonprofit base tier,
-- reversing migration_60.
--
-- WHY: proof_of_authority is the meaningful check. The registration documents
-- establish that an organisation EXISTS; this one establishes that the person
-- submitting may act for it. With it optional, someone could verify an
-- organisation they have no connection to using nothing but its publicly
-- available registration certificate. Existence and authority are different
-- claims and the second is the one that actually gates fundraising on another
-- body's behalf.
--
-- SCOPE. Only nonprofit changes. Business's proof_of_authority was never
-- relaxed — a migration to do so was written and then discarded before it was
-- applied or committed, so business has been `is_required = true` continuously
-- since migration_59 and needs no statement here. Verified against the live
-- rows before writing this.
--
-- Written as a forward migration rather than by running migration_60's rollback
-- script, so the sequence stays a readable, replayable record: 60 relaxed it,
-- 61 restored it. Running the rollback instead would leave the database correct
-- but the history silent about the reversal.
--
-- ORDERING: migration_60's DO block asserts business's proof_of_authority is
-- still required. That assertion remains true forever now, because nothing in
-- the sequence ever changes it — so replaying 59 -> 60 -> 61 against a fresh
-- database works with no ordering trap.
--
-- Rollback: db/migration_61_restore_proof_of_authority_required_rollback.sql

BEGIN;

UPDATE verification_requirements
SET is_required = true
WHERE organizer_type = 'nonprofit'
  AND subcategory IS NULL
  AND country IS NULL
  AND document_type = 'proof_of_authority';

-- Guard: both organisation types must end up requiring proof_of_authority, and
-- the two personal/informal types must be untouched. Abort rather than
-- half-apply.
DO $$
DECLARE
  org_types_requiring_authority integer;
  nonprofit_required integer;
  business_required integer;
  individual_required integer;
  community_required integer;
BEGIN
  SELECT count(*) INTO org_types_requiring_authority
  FROM verification_requirements
  WHERE document_type = 'proof_of_authority'
    AND subcategory IS NULL AND country IS NULL
    AND is_required = true
    AND organizer_type IN ('nonprofit', 'business');

  IF org_types_requiring_authority <> 2 THEN
    RAISE EXCEPTION
      'Both nonprofit and business must require proof_of_authority, found % row(s)',
      org_types_requiring_authority;
  END IF;

  SELECT count(*) INTO nonprofit_required FROM verification_requirements
    WHERE organizer_type = 'nonprofit' AND subcategory IS NULL AND is_required = true;
  SELECT count(*) INTO business_required FROM verification_requirements
    WHERE organizer_type = 'business' AND is_required = true;
  SELECT count(*) INTO individual_required FROM verification_requirements
    WHERE organizer_type = 'individual' AND is_required = true;
  SELECT count(*) INTO community_required FROM verification_requirements
    WHERE organizer_type = 'community' AND is_required = true;

  IF nonprofit_required <> 3 THEN
    RAISE EXCEPTION 'nonprofit base should have 3 required documents, found %', nonprofit_required;
  END IF;
  IF business_required <> 3 THEN
    RAISE EXCEPTION 'business should have 3 required documents, found %', business_required;
  END IF;
  IF individual_required <> 1 THEN
    RAISE EXCEPTION 'individual should have 1 required document, found %', individual_required;
  END IF;
  IF community_required <> 2 THEN
    RAISE EXCEPTION 'community should have 2 required documents, found %', community_required;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
