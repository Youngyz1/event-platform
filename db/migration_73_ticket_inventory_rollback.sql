-- migration_73_ticket_inventory_rollback.sql
-- Manual operator rollback for migration_73. Drops the inventory functions.
-- ticket_orders rows and tickets.quantity values are NOT modified.

BEGIN;

DROP FUNCTION IF EXISTS activate_ticket_order_with_inventory(UUID, TEXT);
DROP FUNCTION IF EXISTS create_ticket_order_with_inventory(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, NUMERIC, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS try_consume_ticket_inventory(UUID, INT);

COMMIT;

NOTIFY pgrst, 'reload schema';
