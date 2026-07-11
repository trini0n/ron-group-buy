# Phase 21 Plan — Most Popular Cards Page

**Phase:** 21  
**Status:** 🟡 Ready to Execute  
**Plans:** 3

---

## Goal

Build the public `/cards/popular` page: aggregate order history into a top-N card ranking, render it as a split-panel UI (stacked list left, hover-reveal detail right), and update the `Cards` header nav item to a hover dropdown.

---

## Plan 21-01: Server — Aggregate Query + Page Load

**What:** `+page.server.ts` that aggregates `order_items` → top-200 ranked cards using the admin client, fetches group buy list, and returns all data needed for both ranking metric modes and all Top-N tabs.

**Tasks:**

1. **Create `src/routes/cards/popular/+page.server.ts`**

   a. Import `createAdminClient` from `$lib/server/admin`

   b. Fetch group buy list — all `group_buy_config` rows ordered by `created_at DESC`:
   ```ts
   const { data: groupBuys } = await adminClient
     .from('group_buy_config')
     .select('id, name, is_active, created_at, opens_at, closes_at')
     .order('created_at', { ascending: false })
   ```
   The active group buy (`is_active = true`) should surface first in the frontend filter.

   c. Parse URL param `groupBuy` (UUID string or null for "all time").

   d. **Aggregate query** — use Supabase's `rpc` with a raw SQL function OR chain JS-side:
   
   Strategy: Fetch `order_items` joined to `orders` and `cards` using admin client. Supabase JS client doesn't support raw GROUP BY aggregates easily — use a **Postgres function** via `rpc()`.
   
   Create a helper SQL function (inline, called from server load — NOT a migration, just the RPC call):
   
   Actually — prefer the simpler approach: **fetch order_items in bulk and aggregate in JS** to avoid adding a migration just for this page. Top 200 aggregated cards is a small dataset.
   
   ```ts
   // Step 1: fetch all non-cancelled order_items with their order's group_buy_id
   let itemQuery = adminClient
     .from('order_items')
     .select(`
       card_name,
       quantity,
       card_id,
       order_id,
       orders!inner(group_buy_id, status)
     `)
     .neq('orders.status', 'cancelled')
   
   if (groupBuyFilter) {
     itemQuery = itemQuery.eq('orders.group_buy_id', groupBuyFilter)
   }
   
   const { data: rawItems } = await itemQuery
   
   // Step 2: aggregate in JS — group by card_name
   const aggregateMap = new Map<string, {
     card_name: string
     total_copies: number
     order_ids: Set<string>
     card_id: string | null
   }>()
   
   for (const item of rawItems ?? []) {
     const key = item.card_name
     const existing = aggregateMap.get(key)
     if (existing) {
       existing.total_copies += item.quantity ?? 1
       existing.order_ids.add(item.order_id)
     } else {
       aggregateMap.set(key, {
         card_name: item.card_name,
         total_copies: item.quantity ?? 1,
         order_ids: new Set([item.order_id]),
         card_id: item.card_id
       })
     }
   }
   
   // Step 3: convert to array with distinct_orders count, sort by total_copies desc, take top 200
   const ranked = [...aggregateMap.values()]
     .map(e => ({
       card_name: e.card_name,
       total_copies: e.total_copies,
       distinct_orders: e.order_ids.size,
       card_id: e.card_id
     }))
     .sort((a, b) => b.total_copies - a.total_copies)
     .slice(0, 200)
   ```

   e. **Fetch card display data** for the top 200 unique `card_id`s in one query:
   ```ts
   const cardIds = ranked
     .map(r => r.card_id)
     .filter((id): id is string => id !== null)
   
   const { data: cardDetails } = await adminClient
     .from('cards')
     .select('id, card_name, scryfall_id, card_type, set_name, set_code, collector_number, mana_cost, type_line, is_in_stock, unit_price')
     .in('id', cardIds)
   
   const cardMap = new Map(cardDetails?.map(c => [c.id, c]) ?? [])
   ```

   f. **Merge card details into ranked list**:
   ```ts
   const popularCards = ranked.map((r, i) => ({
     rank: i + 1,
     card_name: r.card_name,
     total_copies: r.total_copies,
     distinct_orders: r.distinct_orders,
     card_id: r.card_id,
     // card display fields (may be null if card deleted)
     scryfall_id: r.card_id ? cardMap.get(r.card_id)?.scryfall_id ?? null : null,
     card_type: r.card_id ? cardMap.get(r.card_id)?.card_type ?? null : null,
     set_name: r.card_id ? cardMap.get(r.card_id)?.set_name ?? null : null,
     set_code: r.card_id ? cardMap.get(r.card_id)?.set_code ?? null : null,
     collector_number: r.card_id ? cardMap.get(r.card_id)?.collector_number ?? null : null,
     mana_cost: r.card_id ? cardMap.get(r.card_id)?.mana_cost ?? null : null,
     type_line: r.card_id ? cardMap.get(r.card_id)?.type_line ?? null : null,
     is_in_stock: r.card_id ? (cardMap.get(r.card_id)?.is_in_stock ?? false) : false,
     unit_price: r.card_id ? (cardMap.get(r.card_id)?.unit_price ?? null) : null
   }))
   ```

   g. Set cache headers: `Cache-Control: public, max-age=300, stale-while-revalidate=60`

   h. Return: `{ popularCards, groupBuys, groupBuyFilter }`

2. **TypeScript interface** for `PopularCard`:
   ```ts
   export interface PopularCard {
     rank: number
     card_name: string
     total_copies: number
     distinct_orders: number
     card_id: string | null
     scryfall_id: string | null
     card_type: string | null
     set_name: string | null
     set_code: string | null
     collector_number: string | null
     mana_cost: string | null
     type_line: string | null
     is_in_stock: boolean
     unit_price: number | null
   }
   ```

**Success criteria:**
- Page loads without auth
- `popularCards` has up to 200 entries, sorted by `total_copies` desc by default
- Both `total_copies` and `distinct_orders` are present on every entry
- `groupBuys` includes all group buys; active one has `is_active: true`
- When `groupBuyFilter` UUID is passed, results are scoped to that group buy's orders
- Cards deleted from catalog still appear by `card_name` (card_id fields null)
- No user PII in any returned data (no names, emails, discord IDs)

---

## Plan 21-02: UI — Page Layout + Filters + List Panel

**What:** The main `+page.svelte` — filters bar, left stacked list, and the split-panel shell. The detail panel data fetching (Scryfall) is in Plan 21-03.

**Tasks:**

1. **Create `src/routes/cards/popular/+page.svelte`**

   **Page metadata:**
   ```svelte
   <svelte:head>
     <title>Most Popular Cards | Group Buy</title>
     <meta name="description" content="The top ordered Magic: The Gathering proxy cards across all group buys." />
   </svelte:head>
   ```

   **Script block — state:**
   ```ts
   let { data } = $props()
   
   // Filter state
   let groupBuyFilter = $state<string>('all')  // 'all' or UUID
   let metricMode = $state<'copies' | 'orders'>('copies')
   let topN = $state<20 | 50 | 100 | 200>(20)
   
   // Hover/detail state
   let selectedCard = $state<PopularCard | null>(null)
   let detailData = $state<ScryfallDetail | null>(null)  // oracle_text, prices
   let detailLoading = $state(false)
   let quantity = $state(1)
   
   // Hover timer refs (mirror StacksView pattern)
   let hoverTimer: ReturnType<typeof setTimeout> | null = null
   ```

   **Derived — sorted + sliced card list:**
   ```ts
   const filteredCards = $derived.by(() => {
     const sorted = [...data.popularCards].sort((a, b) =>
       metricMode === 'copies'
         ? b.total_copies - a.total_copies
         : b.distinct_orders - a.distinct_orders
     )
     // Re-rank after sort (metric change may reorder)
     return sorted.slice(0, topN).map((c, i) => ({ ...c, rank: i + 1 }))
   })
   ```

   **Note:** Client-side sort works because server always returns top 200 by `total_copies`. Switching to `distinct_orders` may reorder within that 200 but will always include the true top-N for that metric (since a card with many distinct orders will also have high total copies). This is an acceptable approximation — avoids a round trip.

   **Group buy filter URL sync:** When `groupBuyFilter` changes, reload the page with `?groupBuy=UUID` (or remove param for "all") using `goto()` from `$app/navigation`. Server handles the filtering.

   **Hover handler:**
   ```ts
   function onCardHover(card: PopularCard) {
     if (selectedCard?.card_name === card.card_name) return  // already selected
     if (hoverTimer) clearTimeout(hoverTimer)
     hoverTimer = setTimeout(() => {
       selectedCard = card
       quantity = 1
       fetchScryfallDetail(card.scryfall_id)
     }, 75)  // same 75ms debounce as StacksView
   }
   
   function onCardLeave() {
     // Do NOT clear selectedCard on leave — it persists
     if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
   }
   ```

2. **Layout structure:**

   ```svelte
   <div class="container mx-auto px-4 py-8">
     <!-- Page header -->
     <div class="mb-6">
       <h1 class="text-3xl font-bold">Most Popular Cards</h1>
       <p class="text-muted-foreground">Based on {totalOrders} orders across all group buys</p>
     </div>

     <!-- Filters bar -->
     <div class="mb-6 flex flex-wrap items-center gap-4">
       <!-- Group buy select -->
       <!-- Metric toggle -->
       <!-- Top N tabs -->
     </div>

     <!-- Split panel -->
     <div class="flex gap-8 items-start">
       <!-- Left: ranked card list (w-72 flex-none) -->
       <!-- Right: detail panel (flex-1 sticky top-24) -->
     </div>
   </div>
   ```

3. **Filters bar components:**

   a. **Group buy dropdown** — shadcn-svelte `Select`:
   - Default option: "🌐 All Time"
   - Active GB option (if any): "🟢 [GB Name]" pinned at top
   - Remaining GBs sorted by `created_at desc`
   - On change: `goto('?groupBuy=UUID')` or `goto('/cards/popular')` for "all"
   - Derives active/inactive split from `data.groupBuys`

   b. **Metric toggle** — shadcn-svelte `Tabs` or simple styled button pair:
   - "By Copies" / "By Orders"
   - Changes `metricMode`, triggers re-sort (client-side, no server round trip)

   c. **Top N tabs** — plain styled button row `20 | 50 | 100 | 200`:
   - Active tab highlighted
   - Changes `topN`, slices `filteredCards` differently

4. **Left panel — ranked card list:**

   ```svelte
   <div class="w-72 flex-none">
     <div class="rounded-lg border overflow-hidden">
       {#each filteredCards as card (card.card_name)}
         <button
           class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                  hover:bg-accent border-b last:border-b-0
                  {selectedCard?.card_name === card.card_name ? 'bg-accent' : ''}"
           onmouseenter={() => onCardHover(card)}
           onmouseleave={onCardLeave}
         >
           <!-- Rank number -->
           <span class="w-8 text-right text-sm font-mono text-muted-foreground flex-none">
             #{card.rank}
           </span>
           <!-- Card name -->
           <span class="flex-1 text-sm font-medium truncate">{card.card_name}</span>
           <!-- Count badge -->
           <span class="text-xs bg-primary/15 text-primary rounded-full px-2 py-0.5 flex-none">
             {metricMode === 'copies' ? card.total_copies : card.distinct_orders}
           </span>
         </button>
       {/each}
     </div>
   </div>
   ```

   - Top-3 ranks get special treatment: gold/silver/bronze accent on rank number
   - Scrollable if list overflows viewport (`max-h-[calc(100vh-12rem)] overflow-y-auto`)
   - Mobile: list is full-width, detail panel below it (stacked, not side-by-side)

5. **Empty states:**
   - No orders yet: "No order data available yet. Check back after the first group buy!"
   - Group buy filter with 0 orders: "No orders found for this group buy."
   - Both show a card icon illustration

**Success criteria:**
- Filter bar renders with all group buys; active GB shown first with 🟢
- Metric toggle switches sort order without page reload (instant)
- Top N tabs slice the list (20/50/100/200) without page reload
- Group buy filter change triggers page reload with correct `?groupBuy` param
- Hovering a card highlights it in the list
- Hovered card's detail remains visible after mouse leaves list row
- List is scrollable for 100/200 tabs
- Mobile layout: list full-width, detail below

---

## Plan 21-03: UI — Detail Panel + Scryfall Fetch + Cart Integration

**What:** The right-side sticky detail panel: Scryfall data fetch on hover, display of card image, oracle text, prices, and add-to-cart with quantity selector.

**Tasks:**

1. **Scryfall detail fetch function** (inside `+page.svelte` script):

   ```ts
   interface ScryfallDetail {
     oracle_text: string | null
     prices: { usd: string | null; usd_foil: string | null } | null
     rarity: string | null
   }
   
   // Module-scope cache: scryfall_id → detail
   const scryfallCache = new Map<string, ScryfallDetail>()
   
   async function fetchScryfallDetail(scryfallId: string | null) {
     if (!scryfallId) { detailData = null; return }
     
     // Check cache first
     if (scryfallCache.has(scryfallId)) {
       detailData = scryfallCache.get(scryfallId)!
       return
     }
     
     detailLoading = true
     try {
       const res = await fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
         headers: { 'User-Agent': 'RonGroupBuy/1.0' }
       })
       if (!res.ok) { detailData = null; return }
       const json = await res.json()
       const detail: ScryfallDetail = {
         oracle_text: json.oracle_text ?? null,
         prices: json.prices ?? null,
         rarity: json.rarity ?? null
       }
       scryfallCache.set(scryfallId, detail)
       detailData = detail
     } catch {
       detailData = null
     } finally {
       detailLoading = false
     }
   }
   ```

   **Note:** Scryfall public API allows up to 10 req/s without a key. Lazy per-hover fetching with client-side cache means we only ever call Scryfall for cards the user actually views. Subsequent hovers on the same card are instant.

2. **Detail panel markup** (right column, `flex-1`):

   ```svelte
   <div class="flex-1 sticky top-24">
     {#if !selectedCard}
       <!-- Empty state — no card hovered yet -->
       <div class="flex flex-col items-center justify-center h-96 rounded-lg border border-dashed text-muted-foreground">
         <TrendingUp class="w-12 h-12 mb-3 opacity-30" />
         <p class="text-sm">Hover a card to see details</p>
       </div>
     {:else}
       <div class="rounded-lg border bg-card overflow-hidden">
         <!-- Two-column layout inside panel: image left, info right -->
         <div class="flex gap-4 p-4">
           <!-- Card image -->
           <div class="w-40 flex-none">
             <img
               src={selectedCard.scryfall_id
                 ? getScryfallImageUrl(selectedCard.scryfall_id, 'normal')
                 : '/images/card-placeholder.png'}
               alt={selectedCard.card_name}
               class="w-full rounded-lg shadow-lg aspect-[2.5/3.5] object-cover"
             />
           </div>
           
           <!-- Card info -->
           <div class="flex-1 min-w-0">
             <!-- Header: name + CMC -->
             <div class="flex items-start justify-between gap-2 mb-1">
               <h2 class="text-xl font-bold leading-tight">{selectedCard.card_name}</h2>
               <!-- CMC extracted from mana_cost: count {W}{U} etc. -->
               {#if selectedCard.mana_cost}
                 <span class="text-lg font-mono font-bold flex-none">{parseCmc(selectedCard.mana_cost)}</span>
               {/if}
             </div>
             
             <!-- Set info line -->
             <p class="text-sm text-muted-foreground mb-2">
               {selectedCard.set_name ?? ''}
               {#if selectedCard.collector_number} · #{selectedCard.collector_number}{/if}
               {#if detailData?.rarity} · {capitalize(detailData.rarity)}{/if}
             </p>
             
             <!-- Finish badge -->
             {#if selectedCard.card_type}
               {@const finishClass = getFinishBadgeClasses(getFinishLabel({ card_type: selectedCard.card_type }))}
               <Badge class={finishClass}>{getFinishLabel({ card_type: selectedCard.card_type })}</Badge>
             {/if}
             
             <!-- Type line -->
             {#if selectedCard.type_line}
               <p class="text-sm mt-2">{selectedCard.type_line}</p>
             {/if}
             
             <hr class="my-3" />
             
             <!-- Oracle text -->
             {#if detailLoading}
               <div class="h-16 animate-pulse bg-muted rounded" />
             {:else if detailData?.oracle_text}
               <p class="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                 {detailData.oracle_text}
               </p>
             {/if}
           </div>
         </div>
         
         <!-- Price + Cart section -->
         <div class="border-t p-4">
           <!-- Price row: our price + mkt price -->
           <div class="flex items-baseline gap-3 mb-4">
             <span class="text-2xl font-bold text-primary">
               {selectedCard.unit_price
                 ? formatPrice(selectedCard.unit_price)
                 : formatPrice(getCardPrice(selectedCard.card_type ?? 'Normal'))}
             </span>
             {#if detailData?.prices}
               {@const mktPrice = selectedCard.card_type?.toLowerCase().includes('foil')
                 ? detailData.prices.usd_foil
                 : detailData.prices.usd}
               {#if mktPrice}
                 <span class="text-sm text-muted-foreground">mkt ${mktPrice}</span>
               {/if}
             {/if}
           </div>
           
           <!-- Quantity + Add to Cart -->
           {#if selectedCard.is_in_stock && selectedCard.card_id}
             <div class="flex items-center gap-3">
               <!-- Quantity stepper -->
               <div class="flex items-center border rounded-md">
                 <button
                   class="px-3 py-2 hover:bg-accent transition-colors"
                   onclick={() => { if (quantity > 1) quantity-- }}
                   aria-label="Decrease quantity"
                 >
                   <Minus class="w-4 h-4" />
                 </button>
                 <span class="px-4 py-2 text-sm font-medium min-w-[3rem] text-center">{quantity}</span>
                 <button
                   class="px-3 py-2 hover:bg-accent transition-colors"
                   onclick={() => { if (quantity < 99) quantity++ }}
                   aria-label="Increase quantity"
                 >
                   <Plus class="w-4 h-4" />
                 </button>
               </div>
               
               <!-- Add to Cart button -->
               <Button
                 class="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-semibold"
                 onclick={handleAddToCart}
               >
                 <ShoppingCart class="w-4 h-4 mr-2" />
                 ADD TO CART
               </Button>
             </div>
           {:else}
             <Button disabled class="w-full">
               {selectedCard.card_id ? 'Out of Stock' : 'No Longer Available'}
             </Button>
           {/if}
           
           <!-- Popularity stats -->
           <p class="text-xs text-muted-foreground mt-3 text-center">
             Ordered {selectedCard.total_copies} {selectedCard.total_copies === 1 ? 'copy' : 'copies'}
             across {selectedCard.distinct_orders} {selectedCard.distinct_orders === 1 ? 'order' : 'orders'}
           </p>
         </div>
       </div>
     {/if}
   </div>
   ```

3. **Helper functions in script block:**

   ```ts
   // Parse CMC from mana_cost string like "{2}{W}{U}" → "4"
   function parseCmc(manaCost: string): string {
     let cmc = 0
     const generics = manaCost.match(/\{(\d+)\}/g)
     if (generics) cmc += generics.reduce((s, m) => s + parseInt(m.slice(1, -1), 10), 0)
     const symbols = manaCost.match(/\{[WUBRG]\}/g)
     if (symbols) cmc += symbols.length
     return cmc > 0 ? String(cmc) : ''
   }
   
   function capitalize(s: string): string {
     return s.charAt(0).toUpperCase() + s.slice(1)
   }
   
   function handleAddToCart() {
     if (!selectedCard?.card_id) return
     // Build minimal card object matching cartStore.addItem signature
     const cardForCart = {
       id: selectedCard.card_id,
       card_name: selectedCard.card_name,
       card_type: selectedCard.card_type ?? 'Normal',
       serial: selectedCard.set_code ?? '',  // best we have; cart uses id
       is_in_stock: selectedCard.is_in_stock,
       scryfall_id: selectedCard.scryfall_id
       // other fields optional — cartStore only requires id
     }
     cartStore.addItem(cardForCart as any, quantity)
     quantity = 1
   }
   ```

4. **Mobile responsive:**
   - On `< md`: detail panel moves below list; list is scrollable and full-width
   - Use `flex-col md:flex-row` on the outer split container

5. **Imports needed in +page.svelte:**
   ```ts
   import { getScryfallImageUrl, getFinishLabel, getFinishBadgeClasses,
            getCardPrice, formatPrice } from '$lib/utils'
   import { cartStore } from '$lib/stores/cart.svelte'
   import { Badge } from '$components/ui/badge'
   import { Button } from '$components/ui/button'
   import { TrendingUp, Minus, Plus, ShoppingCart } from 'lucide-svelte'
   import type { PopularCard } from './+page.server'
   import { goto } from '$app/navigation'
   import * as Select from '$components/ui/select'
   ```

**Success criteria:**
- Hovering a list row triggers Scryfall fetch (visible loading skeleton for oracle text)
- Oracle text and rarity render correctly after fetch
- Market price shows correctly (`mkt $X.XX`), or is omitted gracefully if unavailable
- Our price shown from `unit_price` (DB) or fallback `getCardPrice(card_type)`
- Quantity stepper works: min 1, max 99
- "ADD TO CART" adds to cart store, resets quantity to 1
- Subsequent hovers on same `scryfall_id` use cache (no additional network requests)
- "Out of Stock" / "No Longer Available" button shown correctly
- Popularity stats line shows both total copies and distinct orders
- Detail panel stays visible when mouse moves between list and detail panel

---

## Plan 21-04: Navigation — Cards Hover Dropdown in Header

**What:** Modify `Header.svelte` to convert the plain `Cards` nav link into a hover-triggered dropdown containing "Browse All Cards" and "Most Popular."

**Tasks:**

1. **Modify `src/lib/components/layout/Header.svelte`**

   Replace the current `<a href="/">Cards</a>` nav item with a hover dropdown group:

   **Desktop nav approach** — use a CSS group + absolute positioned dropdown (no shadcn DropdownMenu — that's click-triggered):

   ```svelte
   <!-- Cards nav with hover dropdown -->
   <div class="relative group">
     <button class="flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary py-2">
       Cards
       <ChevronDown class="h-3 w-3 transition-transform group-hover:rotate-180" />
     </button>
     <!-- Dropdown panel — visible on group hover -->
     <div class="absolute left-0 top-full mt-1 w-48 rounded-md border bg-popover shadow-lg
                 opacity-0 invisible group-hover:opacity-100 group-hover:visible
                 transition-all duration-150 z-50 py-1">
       <a href="/"
          class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
         <LayoutGrid class="h-4 w-4 text-muted-foreground" />
         Browse All Cards
       </a>
       <a href="/cards/popular"
          class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
         <TrendingUp class="h-4 w-4 text-muted-foreground" />
         Most Popular
       </a>
     </div>
   </div>
   ```

   **Key:** `group-hover:visible` + `group-hover:opacity-100` — pure CSS hover, no JS needed. The `invisible` / `opacity-0` on closed state prevents clicks and hides it.

2. **Mobile hamburger menu** — add "Most Popular" flat item under the existing "Cards" item in the mobile `DropdownMenu.Content`:

   ```svelte
   <DropdownMenu.Item>
     <a href="/" class="flex w-full items-center">Browse All Cards</a>
   </DropdownMenu.Item>
   <DropdownMenu.Item>
     <a href="/cards/popular" class="flex w-full items-center gap-2">
       <TrendingUp class="h-4 w-4" />
       Most Popular
     </a>
   </DropdownMenu.Item>
   ```

3. **New imports needed in Header.svelte:**
   ```ts
   import { ChevronDown, LayoutGrid, TrendingUp } from 'lucide-svelte'
   ```

**Success criteria:**
- Desktop: hovering "Cards" in nav reveals dropdown with two items
- Dropdown dismisses when mouse leaves the group (pure CSS, no delay issues)
- "Browse All Cards" → `/` works
- "Most Popular" → `/cards/popular` works
- Mobile: hamburger now shows both Cards options as flat items
- No regression to existing nav items (Sets, Deck Import, Orders, user menu)
- `ChevronDown` rotates on hover

---

## Verification Plan

### Automated
- `npm run check` — TypeScript + Svelte compiler (no new type errors)
- `npm run build` — production build succeeds

### Manual UAT

1. **Navigate to `/cards/popular`** (unauthenticated tab)
   - Page loads with ranked list
   - No user data visible anywhere in page source

2. **Filters**
   - Switch metric toggle → list re-sorts instantly
   - Change Top N tabs → list truncates/extends correctly
   - Change group buy → URL updates, page reloads, list changes

3. **Hover interaction**
   - Hover a card → detail panel shows card name, image, type
   - Move mouse to detail panel → detail stays visible (doesn't collapse)
   - Hover different card → detail updates to new card
   - Hover same card again → instant (cache hit, no loading spinner)

4. **Add to cart**
   - Hover in-stock card → ADD TO CART button enabled
   - Adjust quantity, click → cart count increments, quantity resets to 1
   - Hover OOS card → disabled button

5. **Header nav**
   - Hover "Cards" → dropdown appears with 2 items
   - Move off → dropdown disappears
   - Click "Most Popular" → navigates to `/cards/popular`
   - Mobile: hamburger shows both options

6. **Edge cases**
   - Card with null `scryfall_id` → no image (placeholder shown)
   - Card deleted from catalog → "No Longer Available" button
   - Scryfall API down → market price/oracle text gracefully omitted
