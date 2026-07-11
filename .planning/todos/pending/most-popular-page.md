# 🌱 Seed: Most Popular Cards Page

**Captured:** 2026-07-01  
**Source:** /gsd-explore session  
**Status:** Ready for `/gsd-plan-phase`

---

## What It Is

A public-facing `/cards/popular` page that ranks the top N cards across all historical orders, using aggregated `order_items` data. No PII exposed — just card name, type, and order counts. Includes a rich split-panel UI with hover-reveal card details, quantity control, and add-to-cart.

---

## Answers to Design Questions

| # | Question | Decision |
|---|----------|----------|
| A | Route | `/cards/popular` — nested under Cards section in header hover dropdown |
| B | Status filter | Exclude `cancelled` orders only |
| C | Image source | Scryfall image via `cards.scryfall_id` (fallback, no ron cache requirement) |
| D | Active GB label | Pin active group buy at top of filter dropdown with 🟢 indicator |
| 1 | Audience | Public-facing, zero PII |
| 2 | Ranking metric | Toggle: **By Copies** (`SUM(quantity)`) vs **By Orders** (`COUNT(DISTINCT order_id)`) |
| 3 | Group buy filter | Single-select dropdown |
| 4 | Finish grouping | Combined — aggregate by `card_name` across all finishes |
| 5 | Top N selector | Fixed tabs: **20 \| 50 \| 100 \| 200** |
| 6 | Card display | Card image included (Scryfall) |

---

## UI Layout

### Split-Panel Design

```
┌────────────────┬────────────────────────────────────────────┐
│  LEFT COLUMN   │         RIGHT PANEL (detail)               │
│  (card list)   │                                            │
│                │  [Card Image]   Card Name              CMC │
│  #1 Card Name  │  Set · #Num · Rarity                       │
│  #2 Card Name  │  [Finish badges]                           │
│  #3 Card Name  │  Type line                                 │
│  #4 Card Name  │  ─────────────────────────────────         │
│  #5 Card Name  │  Oracle text                               │
│  ...           │                                            │
│                │  $2.50  mkt $104.05                        │
│                │  ─────────────────────────────────         │
│                │  [−] 1 [+]  [  ADD TO CART  ]              │
└────────────────┴────────────────────────────────────────────┘
```

### Left Column (card list)
- Narrow, scrollable list of ranked cards
- Each row: `#N  Card Name  [count badge]`
- Active/hovered row highlighted
- **Hover triggers right panel update**
- Right panel **stays on last hovered card** even when mouse drifts off — only updates on new hover

### Right Panel (detail, sticky)
- Card image (Scryfall, via `scryfall_id`)
- Card name + CMC (mana cost icon/number, top-right like screenshot)
- Set name · Collector # · Rarity
- Finish badges (Foil, Borderless, etc. — derived from card_type)
- Type line (Creature — Human Wizard, etc.)
- Horizontal rule divider
- Oracle text
- Our price (bold, large) + mkt price (dimmed, inline) — mkt from Scryfall `prices.usd`
- Quantity selector: `[−] N [+]`
- `ADD TO CART` button (full-width, warm accent color matching reference screenshot)
- Reference screenshot style: dark background, card info on left, CMC on right, orange/warm CTA

### Filters Bar (above list)
- **Group Buy dropdown** — "All Time" default, then 🟢 Active GB pinned at top, then historical GBs sorted by date desc
- **Metric toggle** — "By Copies Ordered" / "By Distinct Orders"
- **Top N tabs** — `20 | 50 | 100 | 200`

---

## Data Architecture

### Query (server-side, admin client to bypass RLS)

```sql
SELECT
  oi.card_name,
  SUM(oi.quantity)                    AS total_copies,
  COUNT(DISTINCT oi.order_id)         AS distinct_orders,
  -- Join to cards for image/display data
  c.scryfall_id,
  c.card_type,
  c.set_name,
  c.set_code,
  c.collector_number,
  c.mana_cost,
  c.type_line,
  c.color_identity,
  c.unit_price                        -- our price
FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  LEFT JOIN cards c ON c.id = oi.card_id   -- may be null if card deleted
WHERE
  o.status != 'cancelled'
  AND (? IS NULL OR o.group_buy_id = ?)    -- group buy filter
GROUP BY
  oi.card_name,
  c.scryfall_id, c.card_type, c.set_name, c.set_code,
  c.collector_number, c.mana_cost, c.type_line, c.color_identity, c.unit_price
ORDER BY
  total_copies DESC   -- or distinct_orders DESC based on toggle (client-side re-sort)
LIMIT 200             -- always fetch max, slice client-side for tab changes
```

### Scryfall market price + oracle text
- Fetch via `https://api.scryfall.com/cards/{scryfall_id}` — has `prices.usd` (or `usd_foil`), `oracle_text`
- **Cache in server load** — fetch in parallel for top cards, batch with ≤75ms delay between bursts
- Gracefully handle missing prices (show `—` not crash)
- Rate limit: Scryfall is 10 req/s max

### RLS Concern
- `order_items` RLS currently blocks public access
- Solution: use **service role / admin client** in `+page.server.ts` (pattern-matched via `createAdminClient()`)
- No user data returned — only aggregate counts and card info

---

## Navigation Change

**Header.svelte** — convert `Cards` plain link into a hover dropdown:

```
Cards ▾
├── Browse All Cards   →  /
└── Most Popular       →  /cards/popular
```

Mobile hamburger: add "Most Popular" as a flat item.

---

## Files Affected

| File | Change |
|------|--------|
| `src/routes/cards/popular/+page.server.ts` | NEW — aggregation query, group buy list, Scryfall price/oracle fetch |
| `src/routes/cards/popular/+page.svelte` | NEW — split panel UI with filters |
| `src/lib/components/layout/Header.svelte` | MODIFY — Cards link → hover dropdown |

---

## Open Implementation Notes

1. **Scryfall API calls at load time** — top 200 cards means up to 200 Scryfall calls on first load.
   - Preferred: fetch all server-side during SSR (warm cache on repeated visits)
   - Or: fetch lazily on hover (right panel loads details on-demand via client-side API call)
   - Lazy hover-fetch is probably better UX — page loads fast, detail loads in <100ms per card
2. **card_id may be NULL** in older order_items if card was deleted from catalog. Show card_name only, disable "Add to Cart", show "No longer available" in detail panel.
3. **Market price currency** — Scryfall prices are USD. Label clearly.
4. **Add to cart** — needs current card's `card_id`. If card is OOS (`is_in_stock = false`) or deleted, disable button with tooltip.
5. **`/cards` route note** — homepage `/` is the card browse. Header "Cards" dropdown: `Browse All → /` and `Most Popular → /cards/popular`.
6. **Metric toggle is client-side** — server always returns both `total_copies` and `distinct_orders`; toggle just changes sort key + label in-browser without a new request.
