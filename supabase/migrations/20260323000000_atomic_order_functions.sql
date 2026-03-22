-- Migration: Atomic order RPC functions
-- Eliminates CRITICAL-01 (non-atomic replace) and CRITICAL-02 (non-atomic create)
-- Both functions use SECURITY INVOKER so the caller's RLS context applies.
-- auth.uid() is checked explicitly for defense-in-depth on top of RLS.

-- ============================================================
-- Function 1: replace_order
-- Atomically: delete old order_items → delete old order →
--             insert new order → insert new order_items
-- All within a single plpgsql function call (implicit transaction).
-- ============================================================
CREATE OR REPLACE FUNCTION replace_order(
  p_user_id               uuid,
  p_old_order_id          uuid,
  p_order_number          text,
  p_group_buy_id          uuid,
  p_shipping_type         text,
  p_shipping_name         text,
  p_shipping_line1        text,
  p_shipping_line2        text,
  p_shipping_city         text,
  p_shipping_state        text,
  p_shipping_postal_code  text,
  p_shipping_country      text,
  p_shipping_phone_number text,
  p_notes                 text,
  p_items                 jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_new_order_id uuid;
BEGIN
  -- Defense-in-depth: caller's uid must match the supplied user_id.
  -- RLS also enforces this, but an explicit check provides a clear error.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'replace_order: caller uid does not match p_user_id';
  END IF;

  -- Verify that the order to be replaced belongs to this user and is pending.
  -- (The DELETE RLS policy also requires status = pending, so this gives a better error.)
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_old_order_id
      AND user_id = p_user_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'replace_order: old order % not found, not pending, or not owned by user', p_old_order_id;
  END IF;

  -- Step 1: delete old items (cascades would handle this too, but explicit is safer)
  DELETE FROM order_items WHERE order_id = p_old_order_id;

  -- Step 2: delete old order
  DELETE FROM orders WHERE id = p_old_order_id AND user_id = p_user_id;

  -- Step 3: insert new order
  INSERT INTO orders (
    user_id,
    order_number,
    status,
    group_buy_id,
    shipping_type,
    shipping_name,
    shipping_line1,
    shipping_line2,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_country,
    shipping_phone_number,
    notes
  ) VALUES (
    p_user_id,
    p_order_number,
    'pending',
    p_group_buy_id,
    p_shipping_type,
    p_shipping_name,
    p_shipping_line1,
    p_shipping_line2,
    p_shipping_city,
    p_shipping_state,
    p_shipping_postal_code,
    p_shipping_country,
    p_shipping_phone_number,
    p_notes
  )
  RETURNING id INTO v_new_order_id;

  -- Step 4: insert new order items from JSONB array
  -- Each element must have: card_id, card_serial, card_name, card_type,
  --   quantity, unit_price, set_code (nullable), collector_number (nullable),
  --   is_foil (boolean), is_etched (boolean), language (text)
  INSERT INTO order_items (
    order_id,
    card_id,
    card_serial,
    card_name,
    card_type,
    quantity,
    unit_price,
    set_code,
    collector_number,
    is_foil,
    is_etched,
    language
  )
  SELECT
    v_new_order_id,
    (item->>'card_id')::uuid,
    item->>'card_serial',
    item->>'card_name',
    item->>'card_type',
    (item->>'quantity')::integer,
    (item->>'unit_price')::numeric,
    item->>'set_code',
    item->>'collector_number',
    COALESCE((item->>'is_foil')::boolean, false),
    COALESCE((item->>'is_etched')::boolean, false),
    COALESCE(item->>'language', 'en')
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object(
    'order_id',     v_new_order_id,
    'order_number', p_order_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION replace_order TO authenticated;

-- ============================================================
-- Function 2: create_order_with_items
-- Atomically: insert order → insert order_items
-- Replaces the non-atomic INSERT order / INSERT items /
-- compensating DELETE pattern in the API.
-- ============================================================
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_user_id               uuid,
  p_order_number          text,
  p_group_buy_id          uuid,
  p_shipping_type         text,
  p_shipping_name         text,
  p_shipping_line1        text,
  p_shipping_line2        text,
  p_shipping_city         text,
  p_shipping_state        text,
  p_shipping_postal_code  text,
  p_shipping_country      text,
  p_shipping_phone_number text,
  p_notes                 text,
  p_items                 jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Defense-in-depth: caller's uid must match the supplied user_id.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'create_order_with_items: caller uid does not match p_user_id';
  END IF;

  -- Insert the order
  INSERT INTO orders (
    user_id,
    order_number,
    status,
    group_buy_id,
    shipping_type,
    shipping_name,
    shipping_line1,
    shipping_line2,
    shipping_city,
    shipping_state,
    shipping_postal_code,
    shipping_country,
    shipping_phone_number,
    notes
  ) VALUES (
    p_user_id,
    p_order_number,
    'pending',
    p_group_buy_id,
    p_shipping_type,
    p_shipping_name,
    p_shipping_line1,
    p_shipping_line2,
    p_shipping_city,
    p_shipping_state,
    p_shipping_postal_code,
    p_shipping_country,
    p_shipping_phone_number,
    p_notes
  )
  RETURNING id INTO v_order_id;

  -- Insert the order items from JSONB array
  INSERT INTO order_items (
    order_id,
    card_id,
    card_serial,
    card_name,
    card_type,
    quantity,
    unit_price,
    set_code,
    collector_number,
    is_foil,
    is_etched,
    language
  )
  SELECT
    v_order_id,
    (item->>'card_id')::uuid,
    item->>'card_serial',
    item->>'card_name',
    item->>'card_type',
    (item->>'quantity')::integer,
    (item->>'unit_price')::numeric,
    item->>'set_code',
    item->>'collector_number',
    COALESCE((item->>'is_foil')::boolean, false),
    COALESCE((item->>'is_etched')::boolean, false),
    COALESCE(item->>'language', 'en')
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', p_order_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_with_items TO authenticated;
