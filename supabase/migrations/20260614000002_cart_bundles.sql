-- cart_bundles: one row per set per cart (quantity-based)
-- Separate from cart_items; references sets instead of cards
CREATE TABLE public.cart_bundles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID        NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  set_code   TEXT        NOT NULL REFERENCES public.sets(set_code) ON DELETE CASCADE,
  quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cart_id, set_code)
);

CREATE INDEX idx_cart_bundles_cart_id ON public.cart_bundles(cart_id);

-- RLS: users can access their own cart bundles (via cart ownership)
ALTER TABLE public.cart_bundles ENABLE ROW LEVEL SECURITY;

-- Authenticated users: access bundles in their own cart
CREATE POLICY "cart_bundles_user_access" ON public.cart_bundles
  USING (
    cart_id IN (
      SELECT id FROM public.carts WHERE user_id = auth.uid()
    )
  );

-- Service role (admin client) has full access for guest cart operations
-- (service role bypasses RLS by default in Supabase)

-- Auto-update updated_at
CREATE TRIGGER update_cart_bundles_updated_at
  BEFORE UPDATE ON public.cart_bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────

-- order_bundle_items: permanent record of set bundles purchased in an order
-- Mirrors order_items structure but references sets, not cards
CREATE TABLE public.order_bundle_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  set_code          TEXT        NOT NULL,              -- denormalized: set may be renamed/deleted
  set_name          TEXT        NOT NULL,              -- snapshot at checkout
  quantity          INTEGER     NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  price_at_purchase NUMERIC(10,2) NOT NULL,            -- snapshot of sets.price at checkout time
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_bundle_items_order_id ON public.order_bundle_items(order_id);

-- RLS: users can read their own order bundle items
ALTER TABLE public.order_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_bundle_items_user_read" ON public.order_bundle_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- Admins can read all order bundle items
CREATE POLICY "order_bundle_items_admin_read" ON public.order_bundle_items
  FOR SELECT USING (is_admin());

