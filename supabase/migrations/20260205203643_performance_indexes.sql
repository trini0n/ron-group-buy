-- Performance Indexes Migration
-- Adds indexes to optimize common query patterns

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_group_buy_id ON orders(group_buy_id);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at ON orders(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Cards table indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_cards_card_name_lower ON cards(LOWER(card_name));
CREATE INDEX IF NOT EXISTS idx_cards_set_collector ON cards(set_code, collector_number) WHERE is_in_stock = true;
CREATE INDEX IF NOT EXISTS idx_cards_in_stock ON cards(is_in_stock) WHERE is_in_stock = true;
CREATE INDEX IF NOT EXISTS idx_cards_scryfall_id ON cards(scryfall_id) WHERE scryfall_id IS NOT NULL;

-- Cart items indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_card ON cart_items(cart_id, card_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_card_id ON cart_items(card_id);

-- Checkout sessions indexes
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_cart_status ON checkout_sessions(cart_id, status);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires_at ON checkout_sessions(expires_at) WHERE status = 'active';

-- Carts indexes
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_guest_id ON carts(guest_id) WHERE guest_id IS NOT NULL;

-- Order items indexes (for export and order detail queries)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Comment explaining the indexes
COMMENT ON INDEX idx_orders_status_updated_at IS 'Composite index for filtering by status and sorting by update time';
COMMENT ON INDEX idx_cards_set_collector IS 'Partial index for identity-based card matching on in-stock items';
COMMENT ON INDEX idx_checkout_sessions_expires_at IS 'Partial index for cleanup queries on active sessions';
