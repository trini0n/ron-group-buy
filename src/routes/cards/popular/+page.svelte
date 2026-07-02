<script lang="ts">
  import { goto } from '$app/navigation'
  import { Badge } from '$components/ui/badge'
  import { Button } from '$components/ui/button'
  import * as Select from '$components/ui/select'
  import { cartStore } from '$lib/stores/cart.svelte'
  import {
    getScryfallImageUrl,
    getFinishLabel,
    getFinishBadgeClasses,
    getCardPrice,
    formatPrice
  } from '$lib/utils'
  import { TrendingUp, Minus, Plus, ShoppingCart, BarChart2, Hash } from 'lucide-svelte'
  import type { PopularCard } from './+page.server'
  import type { Card } from '$lib/server/types'

  let { data } = $props()

  // EUR → USD conversion rate (reasonable static estimate; no need for live API on a public page)
  const EUR_TO_USD = 1.08

  // ── Filter state ────────────────────────────────────────────────────────────
  let metricMode = $state<'copies' | 'orders'>('orders')
  let topN = $state<20 | 50 | 100 | 200>(20)

  // ── Hover / detail state ────────────────────────────────────────────────────
  let selectedCard = $state<PopularCard | null>(null)
  let detailLoading = $state(false)
  let quantity = $state(1)

  // ── Scryfall detail types + cache ───────────────────────────────────────────
  interface ScryfallPrices {
    usd: string | null
    usd_foil: string | null
    usd_etched: string | null
    eur: string | null
    eur_foil: string | null
  }
  interface ScryfallDetail {
    oracle_text: string | null
    prices: ScryfallPrices | null
    rarity: string | null
    // Verified-correct Scryfall image URI (normal size). Populated by fetchScryfallDetail
    // which checks the API response name matches the catalog name — if not, it does a
    // secondary /cards/named lookup to get the right image regardless of DB scryfall_id.
    image_uri: string | null
  }

  // Module-scope cache (key = card_name lowercase for name-verified entries)
  const scryfallCache = new Map<string, ScryfallDetail>()
  let detailData = $state<ScryfallDetail | null>(null)

  // Reactive map: card_name (lowercase) → verified correct image URI.
  // Updated after each hover fetch so the left stack column also shows correct images.
  let correctImageUriMap = $state<Record<string, string>>({})

  // ── Symbol map from server (symbol → svg_uri) ───────────────────────────────
  const symbolMap = $derived((data.symbolMap ?? {}) as Record<string, string>)

  // ── Hover debounce timers (same pattern as StacksView) ─────────────────────
  let enterTimer: ReturnType<typeof setTimeout> | null = null
  let leaveTimer: ReturnType<typeof setTimeout> | null = null

  // ── Derived: sorted + sliced card list ─────────────────────────────────────
  const filteredCards = $derived.by(() => {
    const sorted = [...data.popularCards].sort((a, b) =>
      metricMode === 'copies'
        ? b.total_copies - a.total_copies
        : b.distinct_orders - a.distinct_orders
    )
    return sorted.slice(0, topN).map((c, i) => ({ ...c, rank: i + 1 }))
  })

  // ── Group buy select value ───────────────────────────────────────────────────
  const groupBuySelectValue = $derived(data.groupBuyFilter ?? 'all')
  const activeGroupBuy = $derived(data.groupBuys.find((gb) => gb.is_active) ?? null)
  const inactiveGroupBuys = $derived(data.groupBuys.filter((gb) => !gb.is_active))

  function onGroupBuyChange(value: string | undefined) {
    if (!value || value === 'all') {
      goto('/cards/popular')
    } else {
      goto(`/cards/popular?groupBuy=${value}`)
    }
  }

  // ── Hover handlers (StacksView grace-period pattern) ───────────────────────
  function onCardEnter(card: PopularCard) {
    if (enterTimer !== null) { clearTimeout(enterTimer); enterTimer = null }
    if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null }

    // Already selected — don't re-trigger Scryfall fetch
    if (selectedCard?.card_name === card.card_name) return

    enterTimer = setTimeout(() => {
      selectedCard = card
      quantity = 1
      fetchScryfallDetail(card.scryfall_id, card.card_name)
      enterTimer = null
    }, 75)
  }

  function onCardLeave() {
    if (enterTimer !== null) { clearTimeout(enterTimer); enterTimer = null }
    // Grace period: keep selectedCard visible so user can move to detail panel
    leaveTimer = setTimeout(() => {
      leaveTimer = null
    }, 50)
  }

  // ── Scryfall lazy fetch ─────────────────────────────────────────────────────
  // Fetches by scryfall_id first (fast), then verifies the returned card name
  // matches `expectedCardName`. If not (DB data corruption — card_id links to
  // a different card than ordered), falls back to /cards/named for correct data.
  // Cache key = card_name (lowercase) so name-verified entries are always reused.
  async function fetchScryfallDetail(scryfallId: string | null, expectedCardName: string) {
    const cacheKey = expectedCardName.toLowerCase()

    // Cache hit — instant
    if (scryfallCache.has(cacheKey)) {
      detailData = scryfallCache.get(cacheKey)!
      return
    }

    detailLoading = true
    detailData = null
    try {
      // Step 1: fetch by scryfall_id (fastest, most specific)
      let json: Record<string, unknown> | null = null
      if (scryfallId) {
        const res = await fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
          headers: { 'User-Agent': 'RonGroupBuy/1.0' }
        })
        if (res.ok) json = await res.json()
      }

      // Step 2: verify the returned card name matches what we expect.
      // If the DB scryfall_id is stale/wrong (e.g., card was replaced in catalog),
      // the API will return the wrong card. Detect this and re-fetch by name.
      const returnedName = (json?.name as string | undefined) ?? ''
      const nameMatches = returnedName.toLowerCase() === expectedCardName.toLowerCase()

      if (!json || !nameMatches) {
        // Fall back to name-based lookup — always returns the correct card
        const nameRes = await fetch(
          `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(expectedCardName)}`,
          { headers: { 'User-Agent': 'RonGroupBuy/1.0' } }
        )
        if (nameRes.ok) json = await nameRes.json()
      }

      if (!json) { detailData = null; return }

      // Extract verified image URI (normal size)
      const imageUris = json.image_uris as Record<string, string> | undefined
      const imageUri = imageUris?.normal ?? null

      const detail: ScryfallDetail = {
        oracle_text: (json.oracle_text as string | null) ?? null,
        prices: (json.prices as ScryfallPrices | null) ?? null,
        rarity: (json.rarity as string | null) ?? null,
        image_uri: imageUri
      }
      scryfallCache.set(cacheKey, detail)
      detailData = detail

      // Update reactive image map so the left stack column also corrects itself
      if (imageUri) {
        correctImageUriMap = { ...correctImageUriMap, [cacheKey]: imageUri }
      }
    } catch {
      detailData = null
    } finally {
      detailLoading = false
    }
  }

  // ── Mana cost rendering ─────────────────────────────────────────────────────
  // Converts "{2}{W}{U}" → array of [{sym: '{2}', url: '...'}, ...]
  interface ManaPart {
    sym: string
    url: string | null
  }
  function parseManaCost(manaCost: string): ManaPart[] {
    const parts: ManaPart[] = []
    const re = /\{[^}]+\}/g
    let match
    while ((match = re.exec(manaCost)) !== null) {
      const sym = match[0]
      parts.push({ sym, url: symbolMap[sym] ?? null })
    }
    return parts
  }

  // ── Oracle text: replace {sym} tokens with <img> tags ──────────────────────
  function renderOracleText(text: string): string {
    return text.replace(/\{[^}]+\}/g, (sym) => {
      const url = symbolMap[sym]
      if (url) {
        return `<img src="${url}" alt="${sym}" class="inline-block h-4 w-4 align-middle" />`
      }
      return sym
    })
  }

  // ── Market price: USD preferred, fallback EUR × rate ───────────────────────
  function getMarketPrice(card: PopularCard, detail: ScryfallDetail | null): string | null {
    if (!detail?.prices) return null
    const isFoil = !!(card.foil_type || card.card_type?.toLowerCase().includes('foil'))
    const isEtched = card.foil_type?.toLowerCase() === 'etched' || card.card_type?.toLowerCase() === 'etched'
    const p = detail.prices

    // Priority: USD finish-specific → USD base → EUR finish × rate → EUR base × rate
    let usd: string | null = null
    if (isEtched) {
      usd = p.usd_etched ?? p.usd_foil ?? p.usd
    } else if (isFoil) {
      usd = p.usd_foil ?? p.usd
    } else {
      usd = p.usd
    }
    if (usd) return parseFloat(usd).toFixed(2)

    // EUR fallback
    let eur: string | null = isFoil ? (p.eur_foil ?? p.eur) : p.eur
    if (eur) return (parseFloat(eur) * EUR_TO_USD).toFixed(2)

    return null
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  // ── Rank medal colors ───────────────────────────────────────────────────────
  function rankClass(rank: number): string {
    if (rank === 1) return 'text-yellow-500 font-bold'
    if (rank === 2) return 'text-slate-400 font-bold'
    if (rank === 3) return 'text-amber-600 font-bold'
    return 'text-muted-foreground'
  }

  // ── Stacking geometry (mirrors StacksView) ──────────────────────────────────
  // 13% of card height = peek strip showing the card name banner.
  // card_height = 1.4 × width  (2.5:3.5 aspect ratio)
  // peek_height = 0.13 × 1.4w = 0.182w
  // overlap     = 1.4w − 0.182w = 1.218w  →  121.8% of column width
  const OVERLAP = '121.8%'

  function marginTop(i: number, hoveredIdx: number | null): string {
    if (i === 0) return '0'
    if (hoveredIdx !== null && i === hoveredIdx + 1) return '0'
    return `-${OVERLAP}`
  }

  let hoveredIdx = $state<number | null>(null)

  function onStackEnter(idx: number, card: PopularCard) {
    if (enterTimer !== null) { clearTimeout(enterTimer); enterTimer = null }
    if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null }

    enterTimer = setTimeout(() => {
      hoveredIdx = idx
      selectedCard = card
      quantity = 1
      fetchScryfallDetail(card.scryfall_id, card.card_name)
      enterTimer = null
    }, 75)
  }

  function onStackLeave() {
    if (enterTimer !== null) { clearTimeout(enterTimer); enterTimer = null }
    leaveTimer = setTimeout(() => {
      hoveredIdx = null
      leaveTimer = null
      // selectedCard intentionally kept — detail persists
    }, 50)
  }

  // ── Add to cart ─────────────────────────────────────────────────────────────
  function handleAddToCart() {
    if (!selectedCard?.card_id || !selectedCard.is_in_stock) return
    const cardForCart = {
      id: selectedCard.card_id,
      card_name: selectedCard.card_name,
      card_type: selectedCard.card_type ?? 'Normal',
      foil_type: selectedCard.foil_type ?? null,
      serial: '',
      naming: null,
      set_name: selectedCard.set_name ?? null,
      set_code: selectedCard.set_code ?? null,
      collector_number: selectedCard.collector_number ?? null,
      mana_cost: selectedCard.mana_cost ?? null,
      type_line: selectedCard.type_line ?? null,
      color: null,
      color_identity: null,
      is_retro: null,
      is_extended: null,
      is_showcase: null,
      is_borderless: null,
      is_etched: null,
      is_foil: null,
      is_misprint: null,
      is_in_stock: selectedCard.is_in_stock,
      is_new: null,
      language: null,
      flavor_name: null,
      scryfall_link: null,
      scryfall_id: selectedCard.scryfall_id ?? null,
      moxfield_syntax: null,
      ron_image_url: null,
      market_price_usd: null,
      market_price_updated_at: null,
      created_at: null,
      updated_at: null
    } satisfies Card
    cartStore.addItem(cardForCart, quantity)
    quantity = 1
  }
</script>

<style>
  /* Immediate amber glow on hover (no debounce delay) — same as StacksView */
  .stack-card {
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
  }
  .stack-card:hover {
    box-shadow:
      0 16px 36px rgba(0, 0, 0, 0.6),
      0 0 0 2px rgba(245, 145, 5, 0.8);
  }
</style>

<svelte:head>
  <title>Most Popular Cards | Group Buy</title>
  <meta name="description" content="The top ordered Magic: The Gathering proxy cards across all group buys, ranked by order history." />
</svelte:head>

<div class="container mx-auto px-4 py-8">

  <!-- ── Page header ───────────────────────────────────────────────────────── -->
  <div class="mb-6">
    <div class="flex items-center gap-2 mb-1">
      <TrendingUp class="h-6 w-6 text-primary" />
      <h1 class="text-3xl font-bold">Most Popular Cards</h1>
    </div>
    <p class="text-muted-foreground">
      Ranked by order history across
      {#if data.groupBuyFilter}
        the selected group buy
      {:else}
        all group buys
      {/if}
      · {data.popularCards.length} unique cards tracked
    </p>
  </div>

  <!-- ── Filters bar ────────────────────────────────────────────────────────── -->
  <div class="mb-6 flex flex-wrap items-center gap-4">

    <!-- Group buy select -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground whitespace-nowrap">Group Buy:</span>
      <Select.Root
        type="single"
        value={groupBuySelectValue}
        onValueChange={(v) => onGroupBuyChange(v)}
      >
        <Select.Trigger class="w-52 h-9 text-sm">
          {#if groupBuySelectValue === 'all'}
            🌐 All Time
          {:else if activeGroupBuy && groupBuySelectValue === activeGroupBuy.id}
            🟢 {activeGroupBuy.name}
          {:else}
            {data.groupBuys.find(g => g.id === groupBuySelectValue)?.name ?? 'Selected'}
          {/if}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all">🌐 All Time</Select.Item>
          {#if activeGroupBuy}
            <Select.Separator />
            <Select.Item value={activeGroupBuy.id}>
              🟢 {activeGroupBuy.name}
            </Select.Item>
          {/if}
          {#if inactiveGroupBuys.length > 0}
            <Select.Separator />
            {#each inactiveGroupBuys as gb (gb.id)}
              <Select.Item value={gb.id}>{gb.name}</Select.Item>
            {/each}
          {/if}
        </Select.Content>
      </Select.Root>
    </div>

    <!-- Metric toggle: By Orders first (default), By Copies second -->
    <div class="flex items-center gap-1 rounded-lg border p-1">
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {metricMode === 'orders' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
        onclick={() => metricMode = 'orders'}
        id="metric-orders"
      >
        <BarChart2 class="h-3.5 w-3.5" />
        By Orders
      </button>
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {metricMode === 'copies' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
        onclick={() => metricMode = 'copies'}
        id="metric-copies"
      >
        <Hash class="h-3.5 w-3.5" />
        By Copies
      </button>
    </div>

    <!-- Top N tabs -->
    <div class="flex items-center gap-1 rounded-lg border p-1">
      {#each [20, 50, 100, 200] as n (n)}
        <button
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                 {topN === n ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
          onclick={() => topN = n as 20 | 50 | 100 | 200}
          id="top-n-{n}"
        >
          Top {n}
        </button>
      {/each}
    </div>
  </div>

  <!-- ── Split panel ────────────────────────────────────────────────────────── -->
  <div class="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">

    <!-- ── Left: Stacked card column (StacksView pattern) ─────────────────── -->
    <div class="w-full flex-none md:w-56 lg:w-64">
      {#if filteredCards.length === 0}
        <div class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-muted-foreground">
          <TrendingUp class="mb-3 h-10 w-10 opacity-30" />
          <p class="text-sm font-medium">No order data yet</p>
          <p class="mt-1 text-xs">Check back after the first group buy</p>
        </div>
      {:else}
        <!-- Stack: card images overlapping with 13% peek strip, same as StacksView -->
        <div class="relative">
          {#each filteredCards as card, i (card.card_name)}
            {@const mt = marginTop(i, hoveredIdx)}
            {@const isHovered = hoveredIdx === i}
            {@const isActive = selectedCard?.card_name === card.card_name}

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="stack-card relative block w-full cursor-pointer overflow-hidden rounded-[10px]"
              style="
                aspect-ratio: 2.5/3.5;
                margin-top: {mt};
                z-index: {isHovered ? filteredCards.length + 50 : i + 1};
                transition: margin-top 250ms cubic-bezier(0.4, 0, 0.2, 1);
                outline: {isActive ? '2px solid rgba(245, 145, 5, 0.9)' : 'none'};
              "
              onmouseenter={() => onStackEnter(i, card)}
              onmouseleave={onStackLeave}
              role="button"
              tabindex="0"
              aria-label="View details for {card.card_name} (rank #{card.rank})"
              aria-pressed={isActive}
              id="popular-card-{card.rank}"
            >
              <!-- Card image: prefer Scryfall-verified URI from correctImageUriMap -->
              <img
                src={correctImageUriMap[card.card_name.toLowerCase()]
                  ?? (card.scryfall_id ? getScryfallImageUrl(card.scryfall_id, 'normal') : '/images/card-placeholder.png')}
                alt={card.card_name}
                class="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                draggable="false"
              />

              <!-- Rank badge (top-left, amber pill) -->
              <div
                class="absolute left-1 top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center
                       rounded-full px-1 text-[10px] font-extrabold leading-none text-white shadow-lg tabular-nums"
                style="background-color: #f59105; border: 1.5px solid rgba(255,255,255,0.35);"
              >
                {card.rank}
              </div>

              <!-- Metric badge (top-right) -->
              <div
                class="absolute right-1 top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center
                       rounded-full bg-black/60 px-1 text-[9px] font-bold leading-none text-white shadow tabular-nums"
              >
                {metricMode === 'copies' ? card.total_copies : card.distinct_orders}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- ── Right: Detail panel ────────────────────────────────────────────── -->
    <div class="flex-1 md:sticky md:top-24">
      {#if !selectedCard}
        <!-- Empty state -->
        <div class="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground md:h-96">
          <TrendingUp class="mb-3 h-12 w-12 opacity-20" />
          <p class="text-sm font-medium">Hover a card to see details</p>
          <p class="mt-1 text-xs">Click "Add to Cart" to add it to your order</p>
        </div>
      {:else}
        <div class="overflow-hidden rounded-lg border bg-card shadow-md">

          <!-- Top section: image + card info -->
          <div class="flex gap-4 p-5">

            <!-- Card image: prefer Scryfall-verified URI (corrects DB scryfall_id mismatches) -->
            <div class="w-36 flex-none sm:w-44">
              <img
                src={detailData?.image_uri
                  ?? (selectedCard.scryfall_id ? getScryfallImageUrl(selectedCard.scryfall_id, 'normal') : '/images/card-placeholder.png')}
                alt={selectedCard.card_name}
                class="aspect-[2.5/3.5] w-full rounded-lg object-cover shadow-lg"
                referrerpolicy="no-referrer"
              />
            </div>

            <!-- Card metadata -->
            <div class="min-w-0 flex-1">

              <!-- Name + mana cost on the same row (cost floats top-right) -->
              <div class="mb-1 flex items-start justify-between gap-2">
                <h2 class="text-lg font-bold leading-tight sm:text-xl">
                  {selectedCard.card_name}
                </h2>
                <!-- Mana cost as symbols (top-right) -->
                {#if selectedCard.mana_cost}
                  {@const parts = parseManaCost(selectedCard.mana_cost)}
                  <div class="flex flex-shrink-0 flex-wrap items-center justify-end gap-0.5 pt-1">
                    {#each parts as part (part.sym)}
                      {#if part.url}
                        <img
                          src={part.url}
                          alt={part.sym}
                          title={part.sym}
                          class="h-4 w-4 object-contain"
                        />
                      {:else}
                        <span class="rounded bg-muted px-1 font-mono text-xs">{part.sym}</span>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Set info line -->
              <p class="mb-2 text-sm text-muted-foreground">
                {selectedCard.set_name ?? ''}<!--
                -->{#if selectedCard.collector_number} · #{selectedCard.collector_number}{/if}<!--
                -->{#if detailData?.rarity} · {capitalize(detailData.rarity)}{/if}
              </p>

              <!-- Finish badge -->
              {#if selectedCard.card_type}
                {@const finishLabel = getFinishLabel({ card_type: selectedCard.card_type, foil_type: selectedCard.foil_type })}
                {@const finishClass = getFinishBadgeClasses(finishLabel)}
                <Badge class="{finishClass} mb-2">{finishLabel}</Badge>
              {/if}

              <!-- Type line -->
              {#if selectedCard.type_line}
                <p class="mb-2 text-sm">{selectedCard.type_line}</p>
              {/if}

              <hr class="my-3" />

              <!-- Oracle text with symbol rendering -->
              {#if detailLoading}
                <div class="h-16 animate-pulse rounded bg-muted"></div>
              {:else if detailData?.oracle_text}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                <p class="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {@html renderOracleText(detailData.oracle_text)}
                </p>
              {:else if selectedCard.scryfall_id}
                <p class="text-xs text-muted-foreground/60 italic">Loading oracle text…</p>
              {/if}
            </div>
          </div>

          <!-- Bottom section: price + cart -->
          <div class="border-t bg-card px-5 py-4">

            <!-- Price row -->
            <div class="mb-4 flex items-baseline gap-3">
              <!-- Our price -->
              <span class="text-2xl font-bold text-primary">
                {formatPrice(getCardPrice(selectedCard.foil_type ?? selectedCard.card_type ?? 'Normal'))}
              </span>
              <!-- Market price (Scryfall) -->
              {#if detailLoading}
                <span class="text-sm text-muted-foreground animate-pulse">mkt …</span>
              {:else}
                {@const mktPrice = getMarketPrice(selectedCard, detailData)}
                {#if mktPrice}
                  <span class="text-sm text-muted-foreground">mkt ${mktPrice}</span>
                {:else if selectedCard.scryfall_id && detailData}
                  <span class="text-sm text-muted-foreground/50 italic">no market price</span>
                {/if}
              {/if}
            </div>

            <!-- Quantity + Add to Cart -->
            {#if selectedCard.is_in_stock && selectedCard.card_id}
              <div class="flex items-center gap-3">
                <!-- Quantity stepper -->
                <div class="flex items-center rounded-md border">
                  <button
                    class="rounded-l-md px-3 py-2 transition-colors hover:bg-accent"
                    onclick={() => { if (quantity > 1) quantity-- }}
                    aria-label="Decrease quantity"
                    id="qty-decrease"
                  >
                    <Minus class="h-4 w-4" />
                  </button>
                  <span class="min-w-[3rem] px-2 py-2 text-center text-sm font-medium tabular-nums">
                    {quantity}
                  </span>
                  <button
                    class="rounded-r-md px-3 py-2 transition-colors hover:bg-accent"
                    onclick={() => { if (quantity < 99) quantity++ }}
                    aria-label="Increase quantity"
                    id="qty-increase"
                  >
                    <Plus class="h-4 w-4" />
                  </button>
                </div>

                <!-- Add to Cart -->
                <Button
                  class="flex-1 bg-orange-500 font-semibold text-white hover:bg-orange-400"
                  onclick={handleAddToCart}
                  id="add-to-cart-popular"
                >
                  <ShoppingCart class="mr-2 h-4 w-4" />
                  ADD TO CART
                </Button>
              </div>
            {:else}
              <Button disabled class="w-full">
                {selectedCard.card_id ? 'Out of Stock' : 'No Longer Available'}
              </Button>
            {/if}

            <!-- Popularity footnote -->
            <p class="mt-3 text-center text-xs text-muted-foreground">
              Ordered
              <span class="font-medium text-foreground">{selectedCard.total_copies.toLocaleString()}</span>
              {selectedCard.total_copies === 1 ? 'copy' : 'copies'}
              across
              <span class="font-medium text-foreground">{selectedCard.distinct_orders.toLocaleString()}</span>
              {selectedCard.distinct_orders === 1 ? 'order' : 'orders'}
            </p>
          </div>
        </div>
      {/if}
    </div>

  </div>
</div>
