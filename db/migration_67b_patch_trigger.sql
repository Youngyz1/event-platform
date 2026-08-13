-- SUPERSEDED by db/migration_67c_diagnose_and_fix_all_triggers.sql — do not run, kept for history.
-- migration_67b_patch_trigger.sql
-- Run this in the Supabase SQL Editor to verify and re-apply the trigger.
-- This diagnoses how many triggers exist and re-creates exactly one with the correct baseline formula.

-- Step 1: Show all current triggers on donations table
SELECT tgname, tgenabled, proname, prosrc
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'donations'::regclass
ORDER BY tgname;

-- Step 2: Drop ALL triggers on donations that call update_fundraiser_raised
-- (handles the case where multiple triggers existed from migration_14 and migration_66)
DROP TRIGGER IF EXISTS trg_update_fundraiser_raised ON donations;
DROP TRIGGER IF EXISTS update_fundraiser_raised ON donations;

-- Step 3: Replace the function cleanly (no ambiguity)
CREATE OR REPLACE FUNCTION update_fundraiser_raised()
RETURNS TRIGGER AS $$
DECLARE
    target_fundraiser_id UUID;
    total numeric;
    baseline numeric;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_fundraiser_id := OLD.fundraiser_id;
    ELSE
        target_fundraiser_id := NEW.fundraiser_id;
    END IF;

    SELECT COALESCE(SUM(d.amount), 0)
    INTO total
    FROM donations d
    WHERE d.fundraiser_id = target_fundraiser_id
      AND d.status IN ('succeeded', 'completed');

    SELECT COALESCE(f.external_raised_baseline, 0)
    INTO baseline
    FROM fundraisers f
    WHERE f.id = target_fundraiser_id;

    UPDATE fundraisers
    SET raised        = baseline + total,
        raised_amount = baseline + total
    WHERE id = target_fundraiser_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate trigger (single, statement-level via FOR EACH ROW)
CREATE TRIGGER trg_update_fundraiser_raised
AFTER INSERT OR UPDATE OF amount, status OR DELETE ON donations
FOR EACH ROW
EXECUTE FUNCTION update_fundraiser_raised();

-- Step 5: Verify — show triggers again
SELECT tgname, tgenabled, proname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'donations'::regclass
ORDER BY tgname;

-- Step 6: Show live function body to confirm
SELECT prosrc FROM pg_proc WHERE proname = 'update_fundraiser_raised';

NOTIFY pgrst, 'reload schema';
