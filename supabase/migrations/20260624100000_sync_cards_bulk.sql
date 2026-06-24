-- Migration: sync_cards_bulk RPC
--
-- Replaces the per-row UPDATE pattern in the sync handler with a single
-- server-side bulk upsert.  The function accepts the full card list as a
-- JSONB array and executes one INSERT … ON CONFLICT (serial) DO UPDATE
-- statement, which is far more efficient than issuing one query per card.
--
-- Preservation rules baked into the SQL (previously handled in JS):
--   • Google Photos URLs: if the existing ron_image_url already starts with
--     'https://lh3.googleusercontent.com/', keep it — don't overwrite with
--     the raw sheet URL.
--   • OOS priority: if the existing row has is_in_stock = false, keep it
--     false regardless of what the incoming data says.
--
-- Returns: JSON object { inserted: bigint, updated: bigint }
--
-- Security: SECURITY DEFINER so the function can bypass RLS and write to
-- the cards table regardless of the caller's auth context.  Access is
-- restricted to the 'service_role' only — this function must never be
-- called from the client.
--
-- Pattern mirrors the existing atomic_order_functions migration.

CREATE OR REPLACE FUNCTION sync_cards_bulk(p_cards JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted  BIGINT := 0;
  v_updated   BIGINT := 0;
  v_card      JSONB;
  v_serial    TEXT;
  v_existing  RECORD;
BEGIN
  -- Iterate once to count inserts vs updates before the upsert so we can
  -- return accurate stats without a second query.
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_cards)
  LOOP
    v_serial := v_card->>'serial';

    SELECT ron_image_url, is_in_stock
      INTO v_existing
      FROM cards
     WHERE serial = v_serial;

    IF NOT FOUND THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  -- Single bulk upsert — one round-trip for all rows.
  INSERT INTO cards (
    serial,
    naming,
    card_name,
    set_name,
    set_code,
    collector_number,
    card_type,
    foil_type,
    is_retro,
    is_extended,
    is_showcase,
    is_borderless,
    is_etched,
    is_foil,
    language,
    flavor_name,
    scryfall_link,
    scryfall_id,
    moxfield_syntax,
    color,
    color_identity,
    type_line,
    mana_cost,
    ron_image_url,
    is_in_stock,
    is_new,
    is_misprint
  )
  SELECT
    c->>'serial',
    NULLIF(c->>'naming', ''),
    c->>'card_name',
    NULLIF(c->>'set_name', ''),
    NULLIF(c->>'set_code', ''),
    NULLIF(c->>'collector_number', ''),
    c->>'card_type',
    NULLIF(c->>'foil_type', ''),
    COALESCE((c->>'is_retro')::boolean,      false),
    COALESCE((c->>'is_extended')::boolean,   false),
    COALESCE((c->>'is_showcase')::boolean,   false),
    COALESCE((c->>'is_borderless')::boolean, false),
    COALESCE((c->>'is_etched')::boolean,     false),
    COALESCE((c->>'is_foil')::boolean,       false),
    COALESCE(c->>'language', 'en'),
    NULLIF(c->>'flavor_name', ''),
    NULLIF(c->>'scryfall_link', ''),
    NULLIF(c->>'scryfall_id', ''),
    NULLIF(c->>'moxfield_syntax', ''),
    NULLIF(c->>'color', ''),
    NULLIF(c->>'color_identity', ''),
    NULLIF(c->>'type_line', ''),
    NULLIF(c->>'mana_cost', ''),
    NULLIF(c->>'ron_image_url', ''),
    COALESCE((c->>'is_in_stock')::boolean, true),
    COALESCE((c->>'is_new')::boolean,      false),
    COALESCE((c->>'is_misprint')::boolean, false)
  FROM jsonb_array_elements(p_cards) AS c
  ON CONFLICT (serial) DO UPDATE SET
    naming           = EXCLUDED.naming,
    card_name        = EXCLUDED.card_name,
    set_name         = EXCLUDED.set_name,
    set_code         = EXCLUDED.set_code,
    collector_number = EXCLUDED.collector_number,
    card_type        = EXCLUDED.card_type,
    foil_type        = EXCLUDED.foil_type,
    is_retro         = EXCLUDED.is_retro,
    is_extended      = EXCLUDED.is_extended,
    is_showcase      = EXCLUDED.is_showcase,
    is_borderless    = EXCLUDED.is_borderless,
    is_etched        = EXCLUDED.is_etched,
    is_foil          = EXCLUDED.is_foil,
    language         = EXCLUDED.language,
    flavor_name      = EXCLUDED.flavor_name,
    scryfall_link    = EXCLUDED.scryfall_link,
    scryfall_id      = EXCLUDED.scryfall_id,
    moxfield_syntax  = EXCLUDED.moxfield_syntax,
    color            = EXCLUDED.color,
    color_identity   = EXCLUDED.color_identity,
    type_line        = EXCLUDED.type_line,
    mana_cost        = EXCLUDED.mana_cost,
    -- Google Photos URL preservation: keep converted lh3 URL if already stored
    ron_image_url    = CASE
                         WHEN cards.ron_image_url LIKE 'https://lh3.googleusercontent.com/%'
                         THEN cards.ron_image_url
                         ELSE EXCLUDED.ron_image_url
                       END,
    -- OOS priority: a card marked OOS in the DB stays OOS
    is_in_stock      = CASE
                         WHEN cards.is_in_stock = false THEN false
                         ELSE EXCLUDED.is_in_stock
                       END,
    is_new           = EXCLUDED.is_new,
    is_misprint      = EXCLUDED.is_misprint,
    updated_at       = now();

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated',  v_updated
  );
END;
$$;

-- Restrict execution to service_role only (admin server-side calls).
-- Revoke from public and authenticated to prevent client-side invocation.
REVOKE ALL ON FUNCTION sync_cards_bulk(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_cards_bulk(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION sync_cards_bulk(JSONB) TO service_role;

COMMENT ON FUNCTION sync_cards_bulk(JSONB) IS
  'Bulk upserts cards from the Google Sheet CSV sync. Accepts a JSONB array of card records. '
  'Preserves converted Google Photos URLs and enforces OOS priority. '
  'Returns { inserted, updated } counts. Callable by service_role only.';
