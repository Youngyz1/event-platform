-- db/migration_69_profiles_show_donation_totals_rollback.sql
-- Rollback for Migration 69: drop show_donation_totals column from profiles table.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS show_donation_totals;

NOTIFY pgrst, 'reload schema';
