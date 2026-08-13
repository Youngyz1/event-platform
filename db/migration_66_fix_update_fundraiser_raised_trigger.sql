-- SUPERSEDED by db/migration_67c_diagnose_and_fix_all_triggers.sql — do not run, kept for history.
-- migration_66_fix_update_fundraiser_raised_trigger.sql
-- Fix update_fundraiser_raised() trigger function to sum donations with
-- status IN ('succeeded', 'completed') to match app-level logic, ensuring
-- imported donations (status='completed') are included whenever the DB trigger fires.
-- Updated to support external_raised_baseline (see migration_67).

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

NOTIFY pgrst, 'reload schema';

