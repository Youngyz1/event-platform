-- SUPERSEDED by db/migration_67c_diagnose_and_fix_all_triggers.sql — do not run, kept for history.
-- migration_67_external_raised_baseline.sql
-- Adds a one-time historical starting amount column so campaigns seeded from
-- external sources (e.g. scraped GoFundMe totals) can maintain their displayed
-- total correctly as new donations come in via import or Stripe.
--
-- Formula going forward:
--   raised = external_raised_baseline + SUM(donations WHERE status IN ('succeeded','completed'))
--   raised_amount = same
--
-- For all normal/new campaigns, external_raised_baseline = 0 (default) — no effect.

-- Step 1: Add column
ALTER TABLE fundraisers
  ADD COLUMN IF NOT EXISTS external_raised_baseline NUMERIC NOT NULL DEFAULT 0;

-- Step 2: Set one-time baselines for the two known external-origin campaigns.
-- Grandma: displayed $58,404 - imported SUM $24,718 = $33,686 baseline
UPDATE fundraisers
  SET external_raised_baseline = 33686
  WHERE id = '4a2f3283-3d0a-473f-af72-c65610138e79';

-- Beth: displayed $52,897 - imported SUM $27,764 = $25,133 baseline
UPDATE fundraisers
  SET external_raised_baseline = 25133
  WHERE id = '71954eca-8beb-46dc-bf08-1bdd6cd8751d';

-- Step 3: Replace trigger function to use baseline + SUM formula
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
    SET raised       = baseline + total,
        raised_amount = baseline + total
    WHERE id = target_fundraiser_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger still fires correctly (was already set in migration_66)
DROP TRIGGER IF EXISTS trg_update_fundraiser_raised ON donations;
CREATE TRIGGER trg_update_fundraiser_raised
AFTER INSERT OR UPDATE OF amount, status OR DELETE ON donations
FOR EACH ROW
EXECUTE FUNCTION update_fundraiser_raised();

NOTIFY pgrst, 'reload schema';
