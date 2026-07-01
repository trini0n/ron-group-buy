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

  // ── Filter state ────────────────────────────────────────────────────────────
  let metricMode = $state<'copies' | 'orders'>('copies')
  let topN = $state<20 | 50 | 100 | 200>(20)

  // ── Hover / detail state ────────────────────────────────────────────────────
  let selectedCard = $state<PopularCard | null>(null)
  let detailLoading = $state(false)
  let quantity = $state(1)

  // ── Scryfall detail types + cache ───────────────────────────────────────────
  interface ScryfallDetail {
    oracle_text: string | null
    prices: { usd: string | null; usd_foil: string | null } | null
    rarity: string | null
  }

  // Module-scope cache persists across hover events in the same session
  const scryfallCache = new Map<string, ScryfallDetail>()
  let detailData = $state<ScryfallDetail | null>(null)

  // ── Hover debounce timer ────────────────────────────────────────────────────
  let hoverTimer: ReturnType<typeof setTimeout> | null = null

  // ── Derived: sorted + sliced card list ─────────────────────────────────────
  const filteredCards = $derived.by(() => {
    const sorted = [...data.popularCards].sort((a, b) =>
      metricMode === 'copies'
        ? b.total_copies - a.total_copies
        : b.distinct_orders - a.distinct_orders
    )
    return sorted.slice(0, topN).map((c, i) => ({ ...c, rank: i + 1 }))
  })

  // ── Group buy select value (shadcn Select uses string) ──────────────────────
  const groupBuySelectValue = $derived(data.groupBuyFilter ?? 'all')

  // Active group buy (is_active = true)
  const activeGroupBuy = $derived(data.groupBuys.find((gb) => gb.is_active) ?? null)

  // Inactive group buys (sorted by created_at desc — already sorted from server)
  const inactiveGroupBuys = $derived(data.groupBuys.filter((gb) => !gb.is_active))

  // ── Group buy filter handler ────────────────────────────────────────────────
  function onGroupBuyChange(value: string | undefined) {
    if (!value || value === 'all') {
      goto('/cards/popular')
    } else {
      goto(`/cards/popular?groupBuy=${value}`)
    }
  }

  // ── Hover handlers ──────────────────────────────────────────────────────────
  function onCardHover(card: PopularCard) {
    // Already selected — don't re-trigger
    if (selectedCard?.card_name === card.card_name) return
    if (hoverTimer) clearTimeout(hoverTimer)
    hoverTimer = setTimeout(() => {
      selectedCard = card
      quantity = 1
      fetchScryfallDetail(card.scryfall_id)
      hoverTimer = null
    }, 75)
  }

  function onCardLeave() {
    // Cancel enter debounce if user left before it fired
    // Do NOT clear selectedCard — the detail panel persists after mouse leaves
    if (hoverTimer) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
  }

  // ── Scryfall lazy fetch ─────────────────────────────────────────────────────
  async function fetchScryfallDetail(scryfallId: string | null) {
    if (!scryfallId) {
      detailData = null
      return
    }

    // Cache hit — instant
    if (scryfallCache.has(scryfallId)) {
      detailData = scryfallCache.get(scryfallId)!
      return
    }

    detailLoading = true
    detailData = null
    try {
      const res = await fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
        headers: { 'User-Agent': 'RonGroupBuy/1.0' }
      })
      if (!res.ok) {
        detailData = null
        return
      }
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

  // ── CMC parser: "{2}{W}{U}" → "4" ──────────────────────────────────────────
  function parseCmc(manaCost: string): string {
    let cmc = 0
    const generics = manaCost.match(/\{(\d+)\}/g)
    if (generics) cmc += generics.reduce((s, m) => s + parseInt(m.slice(1, -1), 10), 0)
    const colored = manaCost.match(/\{[WUBRGC]\}/gi)
    if (colored) cmc += colored.length
    return cmc > 0 ? String(cmc) : ''
  }

  function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  function handleAddToCart() {
    if (!selectedCard?.card_id || !selectedCard.is_in_stock) return
    // Build a Card Row-compatible object for cartStore.addItem
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
      created_at: null,
      updated_at: null
    } satisfies Card
    cartStore.addItem(cardForCart, quantity)
    quantity = 1
  }


  // ── Rank medal colors ───────────────────────────────────────────────────────
  function rankClass(rank: number): string {
    if (rank === 1) return 'text-yellow-500 font-bold'
    if (rank === 2) return 'text-slate-400 font-bold'
    if (rank === 3) return 'text-amber-600 font-bold'
    return 'text-muted-foreground'
  }

  // ── Market price display ────────────────────────────────────────────────────
  function getMarketPrice(card: PopularCard, detail: ScryfallDetail | null): string | null {
    if (!detail?.prices) return null
    const isFoil = card.card_type?.toLowerCase().includes('foil') ?? false
    const price = isFoil ? detail.prices.usd_foil : detail.prices.usd
    return price ?? null
  }
</script>

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

    <!-- Metric toggle -->
    <div class="flex items-center gap-1 rounded-lg border p-1">
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {metricMode === 'copies' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
        onclick={() => metricMode = 'copies'}
        id="metric-copies"
      >
        <Hash class="h-3.5 w-3.5" />
        By Copies
      </button>
      <button
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
               {metricMode === 'orders' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
        onclick={() => metricMode = 'orders'}
        id="metric-orders"
      >
        <BarChart2 class="h-3.5 w-3.5" />
        By Orders
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

    <!-- ── Left: Ranked card list ─────────────────────────────────────────── -->
    <div class="w-full flex-none md:w-72">
      {#if filteredCards.length === 0}
        <div class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-muted-foreground">
          <TrendingUp class="mb-3 h-10 w-10 opacity-30" />
          <p class="text-sm font-medium">No order data yet</p>
          <p class="mt-1 text-xs">Check back after the first group buy</p>
        </div>
      {:else}
        <div class="max-h-[calc(100vh-14rem)] overflow-y-auto rounded-lg border">
          {#each filteredCards as card (card.card_name)}
            <button
              class="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors
                     last:border-b-0 hover:bg-accent
                     {selectedCard?.card_name === card.card_name ? 'bg-accent' : ''}"
              onmouseenter={() => onCardHover(card)}
              onmouseleave={onCardLeave}
              id="popular-card-{card.rank}"
              aria-label="View details for {card.card_name} (rank #{card.rank})"
            >
              <!-- Rank -->
              <span class="w-8 flex-none text-right text-sm font-mono {rankClass(card.rank)}">
                #{card.rank}
              </span>

              <!-- Card name -->
              <span class="min-w-0 flex-1 truncate text-sm font-medium">
                {card.card_name}
              </span>

              <!-- Count badge -->
              <span class="flex-none rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary tabular-nums">
                {metricMode === 'copies' ? card.total_copies : card.distinct_orders}
              </span>
            </button>
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

            <!-- Card image -->
            <div class="w-36 flex-none sm:w-44">
              <img
                src={selectedCard.scryfall_id
                  ? getScryfallImageUrl(selectedCard.scryfall_id, 'normal')
                  : '/images/card-placeholder.png'}
                alt={selectedCard.card_name}
                class="aspect-[2.5/3.5] w-full rounded-lg object-cover shadow-lg"
                referrerpolicy="no-referrer"
              />
            </div>

            <!-- Card metadata -->
            <div class="min-w-0 flex-1">

              <!-- Name + CMC -->
              <div class="mb-1 flex items-start justify-between gap-2">
                <h2 class="text-lg font-bold leading-tight sm:text-xl">
                  {selectedCard.card_name}
                </h2>
                {#if selectedCard.mana_cost}
                  {@const cmc = parseCmc(selectedCard.mana_cost)}
                  {#if cmc}
                    <span class="flex-none rounded-full bg-muted px-2 py-0.5 font-mono text-sm font-bold">
                      {cmc}
                    </span>
                  {/if}
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

              <!-- Oracle text -->
              {#if detailLoading}
                <div class="h-16 animate-pulse rounded bg-muted"></div>
              {:else if detailData?.oracle_text}
                <p class="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {detailData.oracle_text}
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
              <span class="text-2xl font-bold text-primary">
                {formatPrice(getCardPrice(selectedCard.foil_type ?? selectedCard.card_type ?? 'Normal'))}
              </span>
              {#if detailData}
                {@const mktPrice = getMarketPrice(selectedCard, detailData)}
                {#if mktPrice}
                  <span class="text-sm text-muted-foreground">mkt ${mktPrice}</span>
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
