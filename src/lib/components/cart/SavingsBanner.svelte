<!-- SavingsBanner: DB-first, Scryfall fallback for null-price cards -->
<script lang="ts">
  /**
   * SavingsBanner
   *
   * DB-first: reads market_price_usd from each cart item's card object.
   * Only cards where market_price_usd IS NULL fall back to a Scryfall
   * /cards/collection batch fetch. After running "Sync Market Prices" from
   * /admin/inventory the component makes zero network calls.
   *
   * Hidden if:
   *  - Cart is empty
   *  - Market prices haven't loaded yet (no flash of $0)
   *  - Savings is $0 or negative (e.g. all market prices unavailable)
   */
  import { cartStore } from '$lib/stores/cart.svelte'
  import { getCardPrice, getFinishLabel, getMispriceKey } from '$lib/utils'
  import { Sparkles } from 'lucide-svelte'

  const EUR_TO_USD = 1.08

  // State
  let marketTotal = $state<number | null>(null)
  let loading = $state(false)

  // ── Derived: our cart total ──────────────────────────────────────────────────
  const ourTotal = $derived(
    cartStore.items.reduce((sum, item) => {
      return sum + getCardPrice(getMispriceKey(item.card)) * item.quantity
    }, 0)
  )

  // ── Savings derived from computed market total ───────────────────────────────
  const savings = $derived(marketTotal !== null ? marketTotal - ourTotal : null)
  const showBanner = $derived(
    savings !== null && savings > 0.005 && cartStore.items.length > 0
  )

  // ── Recompute whenever cart items (or their market_price_usd) change ─────────
  $effect(() => {
    const items = cartStore.items
    if (items.length === 0) {
      marketTotal = null
      return
    }

    // Cache key includes market_price_usd so a sync triggers a recompute
    const key = items
      .map((i) => `${i.card.scryfall_id ?? i.card.card_name}:${getFinishLabel(i.card)}:${i.quantity}:${i.card.market_price_usd ?? 'null'}`)
      .sort()
      .join('|')

    computeMarketTotal(items, key)
  })

  let lastKey = ''

  async function computeMarketTotal(items: typeof cartStore.items, key: string) {
    if (key === lastKey) return
    loading = true

    try {
      let total = 0
      let anyPriceFound = false

      // ── 1. Use DB prices where available ───────────────────────────────────
      const needsScryfall: typeof items = []

      for (const item of items) {
        const dbPrice = item.card.market_price_usd
        if (dbPrice !== null && dbPrice !== undefined) {
          total += dbPrice * item.quantity
          anyPriceFound = true
        } else {
          needsScryfall.push(item)
        }
      }

      // ── 2. Scryfall fallback only for cards missing a DB price ──────────────
      if (needsScryfall.length > 0) {
        const identifiers = needsScryfall.map((item) =>
          item.card.scryfall_id
            ? { id: item.card.scryfall_id }
            : { name: item.card.card_name }
        )

        const chunks: typeof identifiers[] = []
        for (let i = 0; i < identifiers.length; i += 75) {
          chunks.push(identifiers.slice(i, i + 75))
        }

        const results = await Promise.all(
          chunks.map((chunk) =>
            fetch('https://api.scryfall.com/cards/collection', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'RonGroupBuy/1.0'
              },
              body: JSON.stringify({ identifiers: chunk })
            }).then((r) => (r.ok ? r.json() : { data: [] }))
          )
        )

        // Build map: scryfall_id / lowercase name → prices
        type Prices = {
          usd: string | null
          usd_foil: string | null
          usd_etched: string | null
          eur: string | null
          eur_foil: string | null
        }
        const priceMap = new Map<string, Prices>()
        for (const result of results) {
          for (const card of (result.data ?? []) as Array<{
            id: string
            name: string
            prices: Prices
          }>) {
            priceMap.set(card.id, card.prices)
            priceMap.set(card.name.toLowerCase(), card.prices)
          }
        }

        for (const item of needsScryfall) {
          const prices =
            priceMap.get(item.card.scryfall_id ?? '') ??
            priceMap.get(item.card.card_name.toLowerCase())
          if (!prices) continue

          const finishLabel = getFinishLabel(item.card).toLowerCase()
          const isEtched = finishLabel.includes('etched')
          const isFoil = isEtched || finishLabel.includes('foil')

          let usdStr: string | null = null
          if (isEtched)    usdStr = prices.usd_etched ?? prices.usd_foil ?? prices.usd
          else if (isFoil) usdStr = prices.usd_foil ?? prices.usd
          else             usdStr = prices.usd

          let unitPrice: number | null = null
          if (usdStr) {
            unitPrice = parseFloat(usdStr)
          } else {
            const eurStr = isFoil ? (prices.eur_foil ?? prices.eur) : prices.eur
            if (eurStr) unitPrice = parseFloat(eurStr) * EUR_TO_USD
          }

          if (unitPrice !== null && !isNaN(unitPrice)) {
            total += unitPrice * item.quantity
            anyPriceFound = true
          }
        }
      }

      // Only update if this fetch is still the current one
      if (key !== lastKey) {
        lastKey = key
        marketTotal = anyPriceFound ? total : null
      }
    } catch {
      // Silently swallow — banner simply stays hidden
    } finally {
      loading = false
    }
  }

  function formatSavings(amount: number): string {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }
</script>

{#if showBanner}
  <div
    class="savings-banner"
    role="status"
    aria-label="Savings compared to market price"
    id="savings-banner"
  >
    <Sparkles class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
    <span>
      You're saving <strong>{formatSavings(savings!)}</strong> compared to buying real cards!
    </span>
  </div>
{:else if loading && cartStore.items.length > 0}
  <!-- Subtle loading placeholder — keeps layout stable while pricing -->
  <div class="savings-banner savings-banner--loading" aria-hidden="true">
    <Sparkles class="h-4 w-4 flex-shrink-0 opacity-40" aria-hidden="true" />
    <span class="animate-pulse opacity-40">Calculating savings…</span>
  </div>
{/if}

<style>
  .savings-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.1rem;
    border-radius: 0.5rem;
    /* Deep teal/dark-green gradient matching the screenshot */
    background: linear-gradient(135deg, #0d3d38 0%, #0a2e2c 100%);
    border: 1px solid rgba(45, 212, 191, 0.25);
    color: #2dd4bf;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 2px 12px rgba(45, 212, 191, 0.12);
    animation: fadeSlideIn 0.35s ease;
  }

  .savings-banner strong {
    color: #5eead4;
    font-weight: 700;
  }

  .savings-banner--loading {
    pointer-events: none;
  }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
