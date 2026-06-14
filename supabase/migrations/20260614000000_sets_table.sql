-- Sets table: admin-managed set registry
CREATE TABLE sets (
  set_code TEXT PRIMARY KEY,
  set_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- set_cards join table: curated card list per set
CREATE TABLE set_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_code TEXT NOT NULL REFERENCES sets(set_code) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(set_code, card_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_set_cards_set_code ON set_cards(set_code);
CREATE INDEX idx_set_cards_card_id ON set_cards(card_id);
CREATE INDEX idx_sets_sort_order ON sets(sort_order, set_name);

-- RLS: publicly readable, write via service role only
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sets are viewable by everyone" ON sets FOR SELECT USING (true);

ALTER TABLE set_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Set cards are viewable by everyone" ON set_cards FOR SELECT USING (true);

-- Auto-update updated_at on sets
CREATE TRIGGER update_sets_updated_at BEFORE UPDATE ON sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
