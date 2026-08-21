-- db/migration_69_profiles_show_donation_totals.sql
-- Migration 69: Add show_donation_totals column to profiles table for future public giving display configuration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_donation_totals BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
