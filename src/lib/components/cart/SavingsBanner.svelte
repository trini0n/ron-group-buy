<script lang="ts">
  /**
   * SavingsBanner
   *
   * Fetches market prices for all individual cards in the cart using the
   * Scryfall /cards/collection batch endpoint (up to 75 per request).
   * Displays the delta between market total and our-price total.
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

  // ── Derived: our cart total (individual cards only — bundles skipped as we
  //    can't reliably price them against Scryfall) ─────────────────────────────
  const ourTotal = $derived(
    cartStore.items.reduce((sum, item) => {
      return sum + getCardPrice(getMispriceKey(item.card)) * item.quantity
    }, 0)
  )

  // ── Savings derived from fetched market total ────────────────────────────────
  const savings = $derived(marketTotal !== null ? marketTotal - ourTotal : null)
  const showBanner = $derived(
    savings !== null && savings > 0.005 && cartStore.items.length > 0
  )

  // ── Fetch market prices whenever cart items change ───────────────────────────
  // Uses Scryfall /cards/collection (batch, up to 75 identifiers per request).
  // We identify by scryfall_id where available, falling back to card_name exact match.
  $effect(() => {
    const items = cartStore.items
    if (items.length === 0) {
      marketTotal = null
      return
    }

    // Build a stable cache key from (scryfall_id | card_name, finish, quantity) tuples
    const key = items
      .map((i) => `${i.card.scryfall_id ?? i.card.card_name}:${getFinishLabel(i.card)}:${i.quantity}`)
      .sort()
      .join('|')

    fetchMarketPrices(items, key)
  })

  // Track the key of the last completed fetch to avoid stale overwrites
  let lastFetchKey = ''

  async function fetchMarketPrices(
    items: typeof cartStore.items,
    key: string
  ) {
    if (key === lastFetchKey) return
    loading = true

    try {
      // De-duplicate by scryfall_id (same card, multiple finishes = multiple entries)
      // We'll price each unique (scryfall_id, finish) pair once then multiply by quantity.
      const identifiers = items.map((item) =>
        item.card.scryfall_id
          ? { id: item.card.scryfall_id }
          : { name: item.card.card_name }
      )

      // Scryfall collection endpoint accepts up to 75 identifiers per call
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
          }).then((r) => r.ok ? r.json() : { data: [] })
        )
      )

      // Build a map: scryfall_id (or lowercase name) → prices object
      const priceMap = new Map<string, { usd: string | null; usd_foil: string | null; usd_etched: string | null; eur: string | null; eur_foil: string | null }>()
      for (const result of results) {
        for (const card of (result.data ?? []) as Array<{ id: string; name: string; prices: { usd: string | null; usd_foil: string | null; usd_etched: string | null; eur: string | null; eur_foil: string | null } }>) {
          priceMap.set(card.id, card.prices)
          priceMap.set(card.name.toLowerCase(), card.prices)
        }
      }

      // Sum market prices for each cart item × quantity
      let total = 0
      let anyPriceFound = false
      for (const item of items) {
        const prices = priceMap.get(item.card.scryfall_id ?? '') ??
                       priceMap.get(item.card.card_name.toLowerCase())
        if (!prices) continue

        const finishLabel = getFinishLabel(item.card).toLowerCase()
        const isEtched = finishLabel.includes('etched')
        const isFoil   = isEtched || finishLabel.includes('foil')

        let usdStr: string | null = null
        if (isEtched)     usdStr = prices.usd_etched ?? prices.usd_foil ?? prices.usd
        else if (isFoil)  usdStr = prices.usd_foil ?? prices.usd
        else              usdStr = prices.usd

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

      // Only update if this fetch is still current
      if (key !== lastFetchKey) {
        lastFetchKey = key
        marketTotal = anyPriceFound ? total : null
      }
    } catch {
      // Silently swallow — banner simply stays hidden
    } finally {
      loading = false
    }
  }

  function formatSavings(amount: number): string {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
