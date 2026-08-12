-- migration_65_remove_events_and_tickets.sql
--
-- Phase 4: Full Events and Ticketing Schema Removal
--
-- Fund4Good is an online fundraising platform. Events and ticketing features
-- have been deprecated and removed from application code.
--
-- This migration drops legacy event, ticket, seating, and Eventbrite import tables,
-- along with associated database functions.
--
-- PRE-DELETION SAFETY CHECK:
-- Run these queries prior to executing this migration to confirm row counts:
--   SELECT count(*) FROM events;
--   SELECT count(*) FROM tickets;
--   SELECT count(*) FROM ticket_orders;
--   SELECT count(*) FROM eventbrite_sources;
--   SELECT count(*) FROM seats;
--   SELECT count(*) FROM venue_layouts;
--
-- ROLLBACK NOTE:
-- Once dropped, historical ticket data cannot be restored automatically.
--

BEGIN;

-- ---------------------------------------------------------------------------
-- 65.1 Drop child tables with foreign keys into tickets / events
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS seats CASCADE;
DROP TABLE IF EXISTS ticket_orders CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS venue_layouts CASCADE;
DROP TABLE IF EXISTS eventbrite_sources CASCADE;

-- ---------------------------------------------------------------------------
-- 65.2 Drop primary events table
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS events CASCADE;

-- ---------------------------------------------------------------------------
-- 65.3 Drop event & seating functions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS recalculate_event_rating(uuid);
DROP FUNCTION IF EXISTS release_expired_seat_reservations();

COMMIT;

NOTIFY pgrst, 'reload schema';
