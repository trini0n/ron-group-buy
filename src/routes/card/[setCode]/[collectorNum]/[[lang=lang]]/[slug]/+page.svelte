<script lang="ts">
  import type { Card as CardType } from '$lib/server/types'
  import { Button } from '$components/ui/button'
  import { Badge } from '$components/ui/badge'
  import * as Card from '$components/ui/card'
  import * as Breadcrumb from '$components/ui/breadcrumb'
  import { Separator } from '$components/ui/separator'
  import {
    getCardImages,
    getCardPrice,
    formatPrice,
    getFinishLabel,
    getMispriceKey,
    getFinishBadgeClasses,
    isDefaultLanguage
  } from '$lib/utils'
  import { ShoppingCart, ExternalLink, ChevronLeft, ChevronRight, Home, Globe } from 'lucide-svelte'
  import { cartStore } from '$lib/stores/cart.svelte'
  import { untrack } from 'svelte'

  // Language code to display name mapping
  const LANGUAGE_NAMES: Record<string, string> = {
    ja: 'Japanese',
    de: 'German',
    fr: 'French',
    it: 'Italian',
    es: 'Spanish',
    pt: 'Portuguese',
    ko: 'Korean',
    ru: 'Russian',
    zhs: 'Simplified Chinese',
    zht: 'Traditional Chinese'
  }

  let { data } = $props()

  // Get finish variants from server data
  const finishVariants = $derived((data.finishVariants as CardType[]) || [data.card])

  // Track selected finish variant - use untrack to explicitly capture initial value
  let selectedCard = $state<CardType>(untrack(() => data.card))

  // Reset selectedCard when page data changes (navigation)
  $effect(() => {
    const newCard = data.card
    selectedCard = newCard
  })

  // Extract the primary card type from type_line (exclude supertypes)
  const primaryCardType = $derived.by(() => {
    const typeLine = selectedCard?.type_line || ''
    const cardTypes = [
      'Creature', 'Instant', 'Sorcery', 'Enchantment',
      'Artifact', 'Land', 'Planeswalker', 'Battle', 'Kindred', 'Tribal'
    ]
    const mainTypes = typeLine.split(' — ')[0] || typeLine
    for (const type of cardTypes) {
      if (mainTypes.includes(type)) return type
    }
    return null
  })

  // Build breadcrumb URLs
  const setFilterUrl  = $derived(`/?set=${selectedCard?.set_code?.toLowerCase() || ''}`)
  const typeFilterUrl = $derived.by(() => {
    if (!primaryCardType) return setFilterUrl
    return `${setFilterUrl}&types=${primaryCardType}`
  })

  // Images
  const images = $derived.by(() => {
    if (!selectedCard) return [{ url: '/images/card-placeholder.png', label: 'Placeholder' }]
    return getCardImages(selectedCard.ron_image_url, selectedCard.scryfall_id, 'large')
  })

  let currentImageIndex = $state(0)

  const price = $derived.by(() => {
    if (!selectedCard) return 0
    return getCardPrice(getMispriceKey(selectedCard))
  })

  $effect(() => {
    if (currentImageIndex >= images.length) currentImageIndex = 0
  })

  function nextImage() {
    if (images.length <= 1) return
    currentImageIndex = (currentImageIndex + 1) % images.length
  }
  function prevImage() {
    if (images.length <= 1) return
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length
  }

  function addToCart() {
    cartStore.addItem(selectedCard)
  }

  const currentImage = $derived(images[currentImageIndex] ?? images[0])

  const languageDisplay = $derived.by(() => {
    const lang = selectedCard?.language?.toLowerCase()
    if (!lang || isDefaultLanguage(lang)) return null
    return LANGUAGE_NAMES[lang] || lang.toUpperCase()
  })

  // ── Scryfall enrichment ──────────────────────────────────────────────────────
  const EUR_TO_USD = 1.08

  interface ScryfallPrices {
    usd: string | null
    usd_foil: string | null
    usd_etched: string | null
    eur: string | null
    eur_foil: string | null
  }
  interface ScryfallEnrichment {
    oracle_text: string | null
    prices: ScryfallPrices | null
    rarity: string | null
    scryfall_image_uri: string | null   // verified correct large image
  }

  let enrichment     = $state<ScryfallEnrichment | null>(null)
  let enrichmentLoading = $state(true)
  let symbolMap      = $state<Record<string, string>>({})

  // Re-fetch when selectedCard changes (finish switch or navigation)
  $effect(() => {
    const scryfallId = selectedCard?.scryfall_id
    const cardName   = selectedCard?.card_name
    if (!cardName) return

    enrichment = null
    enrichmentLoading = true

    Promise.all([
      // Symbol map (cached by browser after first fetch)
      fetch('https://api.scryfall.com/symbology', { headers: { 'User-Agent': 'RonGroupBuy/1.0' } })
        .then(r => r.ok ? r.json() : { data: [] })
        .then((json: { data?: Array<{ symbol: string; svg_uri: string }> }) => {
          const map: Record<string, string> = {}
          for (const sym of json.data ?? []) {
            if (sym.symbol && sym.svg_uri) map[sym.symbol] = sym.svg_uri
          }
          symbolMap = map
        })
        .catch(() => {}),

      (async () => {
        try {
          let json: Record<string, unknown> | null = null

          // Step 1: fetch by scryfall_id (specific to this printing)
          if (scryfallId) {
            const res = await fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
              headers: { 'User-Agent': 'RonGroupBuy/1.0' }
            })
            if (res.ok) json = await res.json()
          }

          // Step 2: verify returned card name — re-fetch by name if stale scryfall_id
          const returnedName = (json?.name as string | undefined) ?? ''
          if (!json || returnedName.toLowerCase() !== cardName.toLowerCase()) {
            const nameRes = await fetch(
              `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`,
              { headers: { 'User-Agent': 'RonGroupBuy/1.0' } }
            )
            if (nameRes.ok) json = await nameRes.json()
          }

          if (!json) { enrichment = null; return }

          const imageUris = json.image_uris as Record<string, string> | undefined
          enrichment = {
            oracle_text:        (json.oracle_text as string | null) ?? null,
            prices:             (json.prices as ScryfallPrices | null) ?? null,
            rarity:             (json.rarity as string | null) ?? null,
            scryfall_image_uri: imageUris?.large ?? imageUris?.normal ?? null
          }
        } catch {
          enrichment = null
        } finally {
          enrichmentLoading = false
        }
      })()
    ])
  })

  // ── Mana symbol rendering ────────────────────────────────────────────────────
  interface ManaPart { sym: string; url: string | null }

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

  function renderOracleText(text: string): string {
    return text.replace(/\{[^}]+\}/g, (sym) => {
      const url = symbolMap[sym]
      if (url) return `<img src="${url}" alt="${sym}" class="inline-block h-4 w-4 align-middle" />`
      return sym
    })
  }

  // ── Market price: USD preferred, EUR fallback ────────────────────────────────
  function getMarketPrice(): string | null {
    if (!enrichment?.prices) return null
    const p = enrichment.prices
    const finishLabel = getFinishLabel(selectedCard).toLowerCase()
    const isEtched = finishLabel.includes('etched')
    const isFoil   = isEtched || finishLabel.includes('foil')

    let usd: string | null = null
    if (isEtched)     usd = p.usd_etched ?? p.usd_foil ?? p.usd
    else if (isFoil)  usd = p.usd_foil ?? p.usd
    else              usd = p.usd

    if (usd) return parseFloat(usd).toFixed(2)

    const eur = isFoil ? (p.eur_foil ?? p.eur) : p.eur
    if (eur)  return (parseFloat(eur) * EUR_TO_USD).toFixed(2)

    return null
  }

  function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
  }
</script>

<svelte:head>
  <title>{data.card.card_name} - Group Buy</title>
  <meta name="description" content="{data.card.card_name} — {data.card.set_name}. {data.card.type_line ?? ''}." />
</svelte:head>

<div class="container py-8">
  <!-- Breadcrumbs -->
  <Breadcrumb.Root class="mb-6">
    <Breadcrumb.List>
      <Breadcrumb.Item>
        <Breadcrumb.Link href="/">
          <Home class="h-4 w-4" />
          <span class="sr-only">Home</span>
        </Breadcrumb.Link>
      </Breadcrumb.Item>

      <Breadcrumb.Separator />

      <Breadcrumb.Item>
        <Breadcrumb.Link href={setFilterUrl}>
          {selectedCard.set_name} ({selectedCard.set_code?.toUpperCase()})
        </Breadcrumb.Link>
      </Breadcrumb.Item>

      {#if primaryCardType}
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href={typeFilterUrl}>{primaryCardType}</Breadcrumb.Link>
        </Breadcrumb.Item>
      {/if}

      <Breadcrumb.Separator />

      <Breadcrumb.Item>
        <Breadcrumb.Page>{selectedCard.card_name}</Breadcrumb.Page>
      </Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>

  <div class="grid gap-8 lg:grid-cols-2">

    <!-- ── Card Image Carousel ──────────────────────────────────────────────── -->
    <div class="flex flex-col items-center gap-4">
      <div class="relative">
        {#if currentImage}
          <img
            src={currentImage.url.includes('lh3.googleusercontent.com')
                  ? currentImage.url
                  : (enrichment?.scryfall_image_uri ?? currentImage.url)}
            alt={selectedCard.card_name}
            class="max-w-sm rounded-lg shadow-lg"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror={(e) => {
              const img = e.currentTarget as HTMLImageElement
              img.src = '/images/card-placeholder.png'
            }}
          />
        {/if}

        {#if images.length > 1}
          <button
            onclick={prevImage}
            class="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            aria-label="Previous image"
          >
            <ChevronLeft class="h-6 w-6" />
          </button>
          <button
            onclick={nextImage}
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            aria-label="Next image"
          >
            <ChevronRight class="h-6 w-6" />
          </button>
        {/if}
      </div>

      {#if images.length > 1}
        <div class="flex flex-col items-center gap-2">
          <div class="flex gap-2">
            {#each images as image, i}
              <button
                onclick={() => (currentImageIndex = i)}
                class="h-3 w-3 rounded-full transition-colors {i === currentImageIndex
                  ? 'bg-primary'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}"
                aria-label="Go to {image.label}"
              ></button>
            {/each}
          </div>
          <span class="text-sm text-muted-foreground">{currentImage?.label ?? ''}</span>
        </div>
      {/if}
    </div>

    <!-- ── Card Details ──────────────────────────────────────────────────────── -->
    <Card.Root>
      <Card.Header>

        <!-- Name row + mana cost at top-right -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <Card.Title class="text-3xl">{selectedCard.card_name}</Card.Title>
            <Card.Description class="text-base">
              {selectedCard.set_name}
              {#if enrichment?.rarity}
                · {capitalize(enrichment.rarity)}
              {:else if enrichmentLoading && selectedCard.scryfall_id}
                <span class="animate-pulse">·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              {/if}
            </Card.Description>
          </div>

          <!-- Mana cost as symbol images (top-right) -->
          {#if selectedCard.mana_cost}
            {@const parts = parseManaCost(selectedCard.mana_cost)}
            <div class="flex flex-shrink-0 flex-wrap items-center justify-end gap-1 pt-1">
              {#each parts as part (part.sym)}
                {#if part.url}
                  <img src={part.url} alt={part.sym} title={part.sym} class="h-5 w-5 object-contain" />
                {:else}
                  <span class="rounded bg-muted px-1 font-mono text-sm">{part.sym}</span>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      </Card.Header>

      <Card.Content class="space-y-5">

        <!-- Badges -->
        <div class="flex flex-wrap gap-2">
          <Badge variant={selectedCard.is_in_stock === false ? 'destructive' : 'default'}>
            {selectedCard.is_in_stock ? 'In Stock' : 'Out of Stock'}
          </Badge>
          <Badge class={getFinishBadgeClasses(getFinishLabel(selectedCard))}>{getFinishLabel(selectedCard)}</Badge>
          {#if languageDisplay}
            <Badge variant="secondary" class="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <Globe class="mr-1 h-3 w-3" />
              {languageDisplay}
            </Badge>
          {/if}
          {#if selectedCard.is_new}
            <Badge variant="outline" class="border-green-500 text-green-500">New</Badge>
          {/if}
          {#if selectedCard.is_borderless}
            <Badge variant="outline">Borderless</Badge>
          {/if}
          {#if selectedCard.is_showcase}
            <Badge variant="outline">Showcase</Badge>
          {/if}
          {#if selectedCard.is_extended}
            <Badge variant="outline">Extended Art</Badge>
          {/if}
          {#if selectedCard.is_retro}
            <Badge variant="outline">Retro</Badge>
          {/if}
        </div>

        <!-- Finish Variant Toggle -->
        {#if finishVariants.length > 1}
          <div>
            <h3 class="mb-2 font-semibold">Finish</h3>
            <div class="flex max-w-xs overflow-hidden rounded-md border">
              {#each finishVariants as variant}
                {@const isActive = selectedCard.serial === variant.serial}
                <button
                  onclick={() => (selectedCard = variant)}
                  disabled={!variant.is_in_stock}
                  class="flex-1 px-3 py-2 text-center text-sm transition-all
                    {isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground'}
                    {!variant.is_in_stock ? 'cursor-not-allowed opacity-50 line-through' : 'cursor-pointer'}"
                >
                  <div>{getFinishLabel(variant)}</div>
                  <div class="font-semibold">{formatPrice(getCardPrice(getMispriceKey(variant)))}</div>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Price row: our price + market price -->
        <div class="flex items-baseline gap-3">
          <p class="text-3xl font-bold">{formatPrice(price)}</p>
          {#if enrichmentLoading && selectedCard.scryfall_id}
            <span class="animate-pulse text-sm text-muted-foreground">mkt …</span>
          {:else}
            {@const mktPrice = getMarketPrice()}
            {#if mktPrice}
              <span class="text-sm text-muted-foreground">mkt ${mktPrice}</span>
            {/if}
          {/if}
        </div>
        <p class="text-sm text-muted-foreground -mt-3">Serial: {selectedCard.serial}</p>

        <Separator />

        <!-- Type line -->
        {#if selectedCard.type_line}
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Type</h3>
            <p>{selectedCard.type_line}</p>
          </div>
        {/if}

        <!-- Oracle text with mana symbols -->
        {#if enrichmentLoading && selectedCard.scryfall_id}
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Oracle Text</h3>
            <div class="space-y-1.5">
              <div class="h-3.5 w-full animate-pulse rounded bg-muted"></div>
              <div class="h-3.5 w-5/6 animate-pulse rounded bg-muted"></div>
              <div class="h-3.5 w-4/6 animate-pulse rounded bg-muted"></div>
            </div>
          </div>
        {:else if enrichment?.oracle_text}
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Oracle Text</h3>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <p class="whitespace-pre-line text-sm leading-relaxed">
              {@html renderOracleText(enrichment.oracle_text)}
            </p>
          </div>
        {/if}

        <!-- Color identity -->
        {#if selectedCard.color_identity}
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Color Identity</h3>
            <p class="text-muted-foreground">{selectedCard.color_identity}</p>
          </div>
        {/if}

      </Card.Content>

      <Card.Footer class="flex gap-4">
        <Button size="lg" onclick={addToCart} disabled={selectedCard.is_in_stock !== true} id="add-to-cart-detail">
          <ShoppingCart class="mr-2 h-4 w-4" />
          Add to Cart
        </Button>

        {#if selectedCard.scryfall_link}
          <Button variant="outline" size="lg" href={selectedCard.scryfall_link} target="_blank">
            <ExternalLink class="mr-2 h-4 w-4" />
            View on Scryfall
          </Button>
        {/if}
      </Card.Footer>
    </Card.Root>
  </div>
</div>
