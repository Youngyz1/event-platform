-- migration_73_ticket_inventory.sql
--
-- Obj2: atomic ticket-inventory protection.
--
-- Problem: `tickets.quantity` was checked (soft gate in lib/ticket-pricing.ts)
-- but never decremented, so concurrent purchases could oversell. A
-- SELECT-then-UPDATE in application code would still race; the consume-and-
-- record steps must happen in a single database transaction.
--
-- Design (Option B — decrement at fulfillment, after payment confirmed):
--   * Stripe: payment_intent.succeeded / checkout.session.completed webhooks
--     call create_ticket_order_with_inventory(), which idempotency-checks,
--     consumes, and inserts in ONE transaction. Failed/abandoned payments never
--     reach fulfillment, so no reservation-expiry machinery is needed.
--   * Crypto: create-payment inserts a `pending` row without consuming;
--     the IPN webhook calls activate_ticket_order_with_inventory(), which flips
--     pending->valid and consumes atomically. The pending->valid UPDATE itself
--     is the idempotency guard (only one caller flips the row).
--   * Seats keep their existing atomic status machine (available->reserved->
--     sold); seat orders still consume the ticket pool once via the same path
--     (no double decrement: exactly one consume call per fulfillment).
--   * `tickets.quantity IS NULL` means an unlimited legacy pool: fulfillment
--     succeeds without decrementing.
--   * Quantity never goes negative: the consuming UPDATE requires
--     `quantity >= requested`. A post-payment shortfall (possible only when a
--     pending crypto invoice outlives concurrent sales) returns 'shortfall' so
--     the caller can reconcile/refund instead of silently overselling.
--
-- Concurrency: each function takes a transaction-scoped advisory lock on its
-- idempotency key first, so duplicate webhook deliveries serialize and the
-- check-then-act sequence inside is airtight on a single database.
--
-- SCOPE: ticketing tables were dropped by migration_65; these functions are
-- no-ops-by-absence there (creation succeeds regardless — plpgsql bodies are
-- checked at execution, and callers handle missing relations with 410).
--
-- Rollback: db/migration_73_ticket_inventory_rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Low-level atomic consume. Returns remaining stock, NULL for unlimited/no
-- pool, or -1 when the ticket is missing or stock is insufficient.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION try_consume_ticket_inventory(p_ticket_id UUID, p_qty INT)
RETURNS INTEGER AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  IF p_ticket_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'try_consume_ticket_inventory: invalid quantity %', p_qty;
  END IF;

  UPDATE tickets
  SET quantity = quantity - p_qty
  WHERE id = p_ticket_id
    AND quantity IS NOT NULL
    AND quantity >= p_qty
  RETURNING quantity INTO v_remaining;

  IF FOUND THEN
    RETURN v_remaining;
  END IF;

  PERFORM 1 FROM tickets WHERE id = p_ticket_id AND quantity IS NULL;
  IF FOUND THEN
    RETURN NULL; -- unlimited legacy pool
  END IF;

  RETURN -1; -- missing ticket or insufficient stock (never negative)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- Stripe fulfillment: idempotent create + atomic consume in one transaction.
-- Returns jsonb {status: created|exists|sold_out, order_id?, remaining?}.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_ticket_order_with_inventory(
  p_event_id UUID,
  p_ticket_id UUID,
  p_seat_id UUID,
  p_seat_label TEXT,
  p_buyer_email TEXT,
  p_buyer_name TEXT,
  p_quantity INT,
  p_total_amount NUMERIC,
  p_currency TEXT,
  p_qr_code TEXT,
  p_payment_intent_id TEXT,
  p_stripe_session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_remaining INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'create_ticket_order_with_inventory: invalid quantity %', p_quantity;
  END IF;

  -- Serialize duplicate deliveries of the same payment.
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_payment_intent_id, p_qr_code, ''))::bigint);

  SELECT id INTO v_order_id FROM ticket_orders
  WHERE stripe_payment_intent_id = p_payment_intent_id
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'exists', 'order_id', v_order_id);
  END IF;

  SELECT id INTO v_order_id FROM ticket_orders
  WHERE qr_code = p_qr_code
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'exists', 'order_id', v_order_id);
  END IF;

  IF p_ticket_id IS NOT NULL THEN
    v_remaining := try_consume_ticket_inventory(p_ticket_id, p_quantity);
    IF v_remaining = -1 THEN
      RETURN jsonb_build_object('status', 'sold_out');
    END IF;
  END IF;

  INSERT INTO ticket_orders (
    event_id, ticket_id, seat_id, seat_label, buyer_email, buyer_name,
    quantity, total_amount, currency, qr_code, status,
    stripe_payment_intent_id, stripe_session_id
  ) VALUES (
    p_event_id, p_ticket_id, p_seat_id, p_seat_label, p_buyer_email, p_buyer_name,
    p_quantity, p_total_amount, p_currency, p_qr_code, 'valid',
    p_payment_intent_id, p_stripe_session_id
  )
  RETURNING id INTO v_order_id;

  IF p_seat_id IS NOT NULL THEN
    UPDATE seats SET status = 'sold', reserved_until = NULL WHERE id = p_seat_id;
  END IF;

  RETURN jsonb_build_object('status', 'created', 'order_id', v_order_id, 'remaining', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- Crypto activation: pending->valid flip + atomic consume in one transaction.
-- Returns jsonb {status: activated|already|missing|shortfall, ...}.
-- 'shortfall' means payment succeeded but stock ran out after the invoice was
-- issued: the order stays valid (paid is paid) and the caller must reconcile
-- (refund / contact buyer) — inventory is NOT driven negative.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_ticket_order_with_inventory(
  p_order_id UUID,
  p_payment_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ticket_id UUID;
  v_seat_id UUID;
  v_quantity INT;
  v_remaining INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text)::bigint);

  UPDATE ticket_orders
  SET status = 'valid',
      stripe_payment_intent_id = COALESCE(p_payment_id, stripe_payment_intent_id)
  WHERE id = p_order_id
    AND status = 'pending'
  RETURNING ticket_id, seat_id, quantity INTO v_ticket_id, v_seat_id, v_quantity;

  IF NOT FOUND THEN
    PERFORM 1 FROM ticket_orders WHERE id = p_order_id AND status = 'valid';
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'already', 'order_id', p_order_id);
    END IF;
    RETURN jsonb_build_object('status', 'missing', 'order_id', p_order_id);
  END IF;

  IF v_ticket_id IS NOT NULL THEN
    v_remaining := try_consume_ticket_inventory(v_ticket_id, COALESCE(v_quantity, 1));
    IF v_remaining = -1 THEN
      RETURN jsonb_build_object('status', 'shortfall', 'order_id', p_order_id);
    END IF;
  END IF;

  IF v_seat_id IS NOT NULL THEN
    UPDATE seats SET status = 'sold', reserved_until = NULL WHERE id = v_seat_id;
  END IF;

  RETURN jsonb_build_object('status', 'activated', 'order_id', p_order_id, 'remaining', v_remaining);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Webhooks call these through the service-role client only (mirrors the
-- migration_54 rate-limit function convention: revoke from PUBLIC as well,
-- since the default PUBLIC grant is a separate entry that survives revoking
-- the named roles).
REVOKE ALL ON FUNCTION try_consume_ticket_inventory(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION try_consume_ticket_inventory(UUID, INT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION create_ticket_order_with_inventory(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_ticket_order_with_inventory(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION activate_ticket_order_with_inventory(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION activate_ticket_order_with_inventory(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION try_consume_ticket_inventory(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION create_ticket_order_with_inventory(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION activate_ticket_order_with_inventory(UUID, TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
