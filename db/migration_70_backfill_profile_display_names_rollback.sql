-- db/migration_70_backfill_profile_display_names_rollback.sql
-- Rollback for Migration 70: Restore previous display_name values for the 6 profile rows.

UPDATE public.profiles
SET display_name = NULL
WHERE id = 'b070cde1-4d58-4328-bb18-919df58ff11c';

UPDATE public.profiles
SET display_name = 'hello.payx'
WHERE id = 'b6413fac-8b28-4ec3-ac67-6dd521fac0e9';

UPDATE public.profiles
SET display_name = 'bankskyworld'
WHERE id = '8a4bfa7e-693a-4bd8-ba54-007cb9e021b0';

UPDATE public.profiles
SET display_name = 'ofiliyoungyz'
WHERE id = '21b8bbfc-95c6-4ea9-aa2e-51b3460a0865';

UPDATE public.profiles
SET display_name = 'uche2net'
WHERE id = 'd78362ce-acc7-45b4-afdd-9c53efbac71b';

UPDATE public.profiles
SET display_name = 'luciaeward213'
WHERE id = 'c496bd7a-3159-4d2a-91f8-d86738194292';

NOTIFY pgrst, 'reload schema';
