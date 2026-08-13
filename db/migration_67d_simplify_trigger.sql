-- NOT APPLIED — REVERTED TO BASELINE MODEL IN db/migration_67c_diagnose_and_fix_all_triggers.sql — do not run, kept for history.
-- migration_67d_simplify_trigger.sql
-- PROBLEM DIAGNOSED: The trigger's SELECT on fundraisers to get external_raised_baseline
-- is reading a stale/unexpected value during the per-row execution, causing
-- raised = baseline + SUM to overshoot.
--
-- SOLUTION: Simplify the trigger to ONLY write raised = SUM(donations).
-- The baseline addition is handled exclusively by recalculateFundraiserRaised() in Node,
-- which correctly reads external_raised_baseline AFTER the full batch is committed.
--
-- The trigger still keeps raised in sync with live donations (Stripe webhooks, etc.).
-- recalculateFundraiserRaised() is called after every import and Stripe webhook,
-- so raised_amount will always include the baseline via the Node path.

-- Step 1: Drop ALL triggers on donations to start clean
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'donations'::regclass AND NOT tgisinternal
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON donations';
    RAISE NOTICE 'Dropped trigger: %', r.tgname;
  END LOOP;
END;
$$;

-- Step 2: Simple trigger function — writes only raised = SUM(valid donations)
-- Does NOT touch raised_amount or external_raised_baseline.
-- Node's recalculateFundraiserRaised() handles the full baseline + SUM write after import.
CREATE OR REPLACE FUNCTION update_fundraiser_raised()
RETURNS TRIGGER AS $$
DECLARE
    target_fundraiser_id UUID;
    total numeric;
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

    UPDATE fundraisers
    SET raised = total
    WHERE id = target_fundraiser_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Single clean trigger
CREATE TRIGGER trg_update_fundraiser_raised
AFTER INSERT OR UPDATE OF amount, status OR DELETE ON donations
FOR EACH ROW
EXECUTE FUNCTION update_fundraiser_raised();

-- Step 4: Verify exactly 1 trigger exists
SELECT tgname, tgenabled, proname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'donations'::regclass
  AND NOT t.tgisinternal
ORDER BY tgname;

-- Step 5: Show live function body
SELECT prosrc FROM pg_proc WHERE proname = 'update_fundraiser_raised';

-- Step 6: Re-sync raised_amount for Grandma and Beth using baseline + SUM
-- (since the trigger now only writes raised, not raised_amount)
UPDATE fundraisers f
SET raised_amount = COALESCE(f.external_raised_baseline, 0) + COALESCE((
    SELECT SUM(d.amount) FROM donations d
    WHERE d.fundraiser_id = f.id AND d.status IN ('succeeded', 'completed')
), 0)
WHERE f.id IN (
    '4a2f3283-3d0a-473f-af72-c65610138e79',  -- Grandma
    '71954eca-8beb-46dc-bf08-1bdd6cd8751d',  -- Beth
    'b01f8bac-b541-4c28-9675-04e1c76639e6'   -- Katie
);

-- Step 7: Verify Grandma, Beth, Katie
SELECT id, title, raised, raised_amount, external_raised_baseline
FROM fundraisers
WHERE id IN (
    '4a2f3283-3d0a-473f-af72-c65610138e79',
    '71954eca-8beb-46dc-bf08-1bdd6cd8751d',
    'b01f8bac-b541-4c28-9675-04e1c76639e6'
)
ORDER BY title;

NOTIFY pgrst, 'reload schema';
