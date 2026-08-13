-- AUTHORITATIVE — LIVE IN POSTGRES (Applied 2026-08-13)
-- migration_67c_diagnose_and_fix_all_triggers.sql
-- Step 1: DIAGNOSE — list every trigger on the donations table with its function body
SELECT
  t.tgname        AS trigger_name,
  t.tgenabled     AS enabled,
  p.proname       AS function_name,
  CASE t.tgtype & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END             AS timing,
  CASE t.tgtype & 28
    WHEN 4  THEN 'INSERT'
    WHEN 8  THEN 'DELETE'
    WHEN 16 THEN 'UPDATE'
    WHEN 20 THEN 'INSERT OR DELETE'
    WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
    ELSE t.tgtype::text
  END             AS events,
  p.prosrc        AS function_body
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'donations'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- Step 2: FIX — drop every trigger on donations (we'll recreate the single correct one)
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

-- Step 3: Replace function with the definitive baseline formula
CREATE OR REPLACE FUNCTION update_fundraiser_raised()
RETURNS TRIGGER AS $$
DECLARE
    target_fundraiser_id UUID;
    total    numeric;
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

-- Step 4: Create exactly ONE trigger
CREATE TRIGGER trg_update_fundraiser_raised
AFTER INSERT OR UPDATE OF amount, status OR DELETE ON donations
FOR EACH ROW
EXECUTE FUNCTION update_fundraiser_raised();

-- Step 5: Verify — MUST show exactly 1 row named trg_update_fundraiser_raised
SELECT tgname, tgenabled, proname
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'donations'::regclass
  AND NOT t.tgisinternal
ORDER BY tgname;

-- Step 6: Show live function body
SELECT prosrc FROM pg_proc WHERE proname = 'update_fundraiser_raised';

NOTIFY pgrst, 'reload schema';
