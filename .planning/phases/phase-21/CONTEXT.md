# Phase 21 Context — Most Popular Cards Page

**Source:** `.planning/todos/pending/most-popular-page.md` (explore seed)  
**Phase number:** 21  
**Milestone:** v1.4 (new)

---

## Scope

Public-facing `/cards/popular` page ranked by order history. Split-panel UI with stacked card list on the left and sticky hover-reveal detail panel on the right. Admin client used server-side for aggregate query (bypasses RLS). No PII exposed.

---

## Design Decisions (locked)

| Decision | Value |
|---|---|
| Route | `/cards/popular` |
| Audience | Public (no auth required) |
| Order status filter | Exclude `cancelled` only |
| Ranking metric | Both: `SUM(quantity)` AND `COUNT(DISTINCT order_id)` — toggle client-side |
| Finish grouping | Combined — aggregate by `card_name` across all `card_type` variants |
| Top N | Fixed tabs: 20 / 50 / 100 / 200 |
| Card images | Scryfall (`cards.scryfall_id` → `getScryfallImageUrl`) |
| Market price | Scryfall API `prices.usd` / `usd_foil` — fetched lazily on hover |
| Oracle text | Scryfall API `oracle_text` — fetched lazily on hover |
| Group buy filter | Single-select dropdown; 🟢 active GB pinned first; "All Time" default |
| Navigation | Header `Cards` becomes hover dropdown: Browse All → `/`, Most Popular → `/cards/popular` |
| Detail panel persistence | Stays on last-hovered card; only updates on new hover |

---

## Key Codebase Patterns to Follow

- **Admin client**: `import { createAdminClient } from '$lib/server/admin'` — bypasses RLS
- **Scryfall image URL**: `getScryfallImageUrl(scryfallId, 'normal')` from `$lib/utils`
- **Add to cart**: `cartStore.addItem(card, quantity)` from `$lib/stores/cart.svelte`
- **StacksView hover timers**: 75ms enter debounce + 50ms leave grace (see `StacksView.svelte` lines 109–180 for the exact timer pattern to adapt)
- **getFinishLabel / getFinishBadgeClasses**: from `$lib/utils` — reuse for finish badges
- **getCardPrice / formatPrice**: from `$lib/utils` — reuse for pricing display
- **Scryfall API header**: `'User-Agent': 'RonGroupBuy/1.0'` (already used in sets page)
- **Module-scope cache pattern**: `let cache: { data: T; timestamp: number } | null = null` with `CACHE_TTL_MS` (see `sets/[setCode]/+page.server.ts`)

---

## Out of Scope

- Admin-only analytics view (this is public only)
- Per-finish breakdown (combined only)
- Infinite scroll (tabs only)
- Custom date range filter (group buy filter only)
