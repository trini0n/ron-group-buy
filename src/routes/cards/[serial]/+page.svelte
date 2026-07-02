<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import { Separator } from '$components/ui/separator';
  import { Input } from '$components/ui/input';
  import { getCardImages, getCardPrice, formatPrice, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { ShoppingCart, ExternalLink, ArrowLeft, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-svelte';
  import { cartStore } from '$lib/stores/cart.svelte';

  let { data } = $props();

  // ── Quantity state ───────────────────────────────────────────────────────────
  let quantity = $state(1);

  // ── Images ───────────────────────────────────────────────────────────────────
  const images = $derived.by(() => {
    const cardData = data.card;
    if (!cardData) return [{ url: '/images/card-placeholder.png', label: 'Placeholder' }];
    return getCardImages(cardData.ron_image_url, cardData.scryfall_id, 'large');
  });

  let currentImageIndex = $state(0);

  const price = $derived.by(() => {
    const cardData = data.card;
    if (!cardData) return 0;
    return getCardPrice(getFinishLabel(cardData));
  });

  $effect(() => {
    if (currentImageIndex >= images.length) {
      currentImageIndex = 0;
    }
  });

  function nextImage() {
    if (images.length <= 1) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
  }

  function prevImage() {
    if (images.length <= 1) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
  }

  function addToCart() {
    cartStore.addItem(data.card, quantity);
    quantity = 1;
  }

  function incrementQuantity() {
    if (quantity < 99) quantity++;
  }

  function decrementQuantity() {
    if (quantity > 1) quantity--;
  }

  const currentImage = $derived(images[currentImageIndex] ?? images[0]);

  // ── Card identifier line ─────────────────────────────────────────────────────
  const cardIdentifier = $derived.by(() => {
    const c = data.card;
    const parts: string[] = [];
    if (c.set_code) parts.push(c.set_code.toUpperCase());
    if (c.collector_number) parts.push(`#${c.collector_number}`);
    if (c.language && c.language.toLowerCase() !== 'en') parts.push(`(${c.language.toUpperCase()})`);
    return parts.join(' ') || c.set_name || '';
  });

  // ── Scryfall enrichment ──────────────────────────────────────────────────────
  // Fetch oracle text, market price, rarity, and a verified image from Scryfall.
  // Uses the card's scryfall_id for the initial lookup, then verifies the returned
  // name matches — same pattern as the popular page detail panel.

  const EUR_TO_USD = 1.08;

  interface ScryfallPrices {
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
    eur: string | null;
    eur_foil: string | null;
  }
  interface ScryfallEnrichment {
    oracle_text: string | null;
    prices: ScryfallPrices | null;
    rarity: string | null;
    // Verified correct image URI from Scryfall (may differ from DB scryfall_id if stale)
    scryfall_image_uri: string | null;
  }

  let enrichment = $state<ScryfallEnrichment | null>(null);
  let enrichmentLoading = $state(true);

  // Mana symbol map fetched client-side (same endpoint as popular page server-side)
  let symbolMap = $state<Record<string, string>>({});

  // ── On mount: fetch symbol map + Scryfall enrichment in parallel ─────────────
  $effect(() => {
    const scryfallId = data.card.scryfall_id;
    const cardName   = data.card.card_name;

    // Fetch symbol map and card enrichment in parallel
    Promise.all([
      fetch('https://api.scryfall.com/symbology', { headers: { 'User-Agent': 'RonGroupBuy/1.0' } })
        .then(r => r.ok ? r.json() : { data: [] })
        .then((json: { data?: Array<{ symbol: string; svg_uri: string }> }) => {
          const map: Record<string, string> = {};
          for (const sym of json.data ?? []) {
            if (sym.symbol && sym.svg_uri) map[sym.symbol] = sym.svg_uri;
          }
          symbolMap = map;
        })
        .catch(() => {}),

      (async () => {
        try {
          let json: Record<string, unknown> | null = null;

          // Step 1: fetch by scryfall_id (specific to this printing)
          if (scryfallId) {
            const res = await fetch(`https://api.scryfall.com/cards/${scryfallId}`, {
              headers: { 'User-Agent': 'RonGroupBuy/1.0' }
            });
            if (res.ok) json = await res.json();
          }

          // Step 2: verify name — if stale scryfall_id returns wrong card, re-fetch by name
          const returnedName = (json?.name as string | undefined) ?? '';
          if (!json || returnedName.toLowerCase() !== cardName.toLowerCase()) {
            const nameRes = await fetch(
              `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`,
              { headers: { 'User-Agent': 'RonGroupBuy/1.0' } }
            );
            if (nameRes.ok) json = await nameRes.json();
          }

          if (!json) { enrichment = null; return; }

          const imageUris = json.image_uris as Record<string, string> | undefined;
          enrichment = {
            oracle_text:        (json.oracle_text as string | null) ?? null,
            prices:             (json.prices as ScryfallPrices | null) ?? null,
            rarity:             (json.rarity as string | null) ?? null,
            scryfall_image_uri: imageUris?.large ?? imageUris?.normal ?? null
          };
        } catch {
          enrichment = null;
        } finally {
          enrichmentLoading = false;
        }
      })()
    ]);
  });

  // ── Mana symbol rendering ────────────────────────────────────────────────────
  interface ManaPart { sym: string; url: string | null; }

  function parseManaCost(manaCost: string): ManaPart[] {
    const parts: ManaPart[] = [];
    const re = /\{[^}]+\}/g;
    let match;
    while ((match = re.exec(manaCost)) !== null) {
      const sym = match[0];
      parts.push({ sym, url: symbolMap[sym] ?? null });
    }
    return parts;
  }

  function renderOracleText(text: string): string {
    return text.replace(/\{[^}]+\}/g, (sym) => {
      const url = symbolMap[sym];
      if (url) return `<img src="${url}" alt="${sym}" class="inline-block h-4 w-4 align-middle" />`;
      return sym;
    });
  }

  // ── Market price: USD preferred, EUR fallback ────────────────────────────────
  function getMarketPrice(): string | null {
    if (!enrichment?.prices) return null;
    const p = enrichment.prices;
    const finishLabel = getFinishLabel(data.card).toLowerCase();
    const isEtched = finishLabel.includes('etched');
    const isFoil   = isEtched || finishLabel.includes('foil');

    let usd: string | null = null;
    if (isEtched)     usd = p.usd_etched ?? p.usd_foil ?? p.usd;
    else if (isFoil)  usd = p.usd_foil ?? p.usd;
    else              usd = p.usd;

    if (usd) return parseFloat(usd).toFixed(2);

    // EUR fallback
    const eur = isFoil ? (p.eur_foil ?? p.eur) : p.eur;
    if (eur) return (parseFloat(eur) * EUR_TO_USD).toFixed(2);

    return null;
  }

  function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
</script>

<svelte:head>
  <title>{data.card.card_name} - Group Buy</title>
  <meta name="description" content="{data.card.card_name} — {cardIdentifier}. {data.card.type_line ?? ''}." />
</svelte:head>

<div class="container py-8">
  <a href="/" class="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <ArrowLeft class="h-4 w-4" />
    Back to catalog
  </a>

  <div class="grid gap-8 lg:grid-cols-2">

    <!-- ── Card Image Carousel ──────────────────────────────────────────────── -->
    <div class="flex flex-col items-center gap-4">
      <div class="relative">
        {#if currentImage}
          <img
            src={enrichment?.scryfall_image_uri ?? currentImage.url}
            alt={data.card.card_name}
            class="max-w-sm rounded-lg shadow-lg"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.src = '/images/card-placeholder.png';
            }}
          />
        {/if}

        <!-- Navigation arrows (only show if multiple images) -->
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

      <!-- Image indicator dots and label -->
      {#if images.length > 1}
        <div class="flex flex-col items-center gap-2">
          <div class="flex gap-2">
            {#each images as image, i}
              <button
                onclick={() => currentImageIndex = i}
                class="h-3 w-3 rounded-full transition-colors {i === currentImageIndex ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}"
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
            <Card.Title class="text-3xl">{data.card.card_name}</Card.Title>
            <Card.Description class="text-base">
              {cardIdentifier}
              {#if enrichment?.rarity}
                · {capitalize(enrichment.rarity)}
              {:else if enrichmentLoading}
                <span class="animate-pulse">·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              {/if}
            </Card.Description>
          </div>

          <!-- Mana cost symbols (top-right) -->
          {#if data.card.mana_cost}
            {@const parts = parseManaCost(data.card.mana_cost)}
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

        <!-- Badges row -->
        <div class="flex flex-wrap gap-2">
          <Badge variant={data.card.is_in_stock ? 'default' : 'destructive'}>
            {data.card.is_in_stock ? 'In Stock' : 'Out of Stock'}
          </Badge>
          <Badge class={getFinishBadgeClasses(getFinishLabel(data.card))}>{getFinishLabel(data.card)}</Badge>
          {#if data.card.is_new}
            <Badge variant="outline" class="border-green-500 text-green-500">New</Badge>
          {/if}
          {#if data.card.is_borderless}
            <Badge variant="outline">Borderless</Badge>
          {/if}
          {#if data.card.is_showcase}
            <Badge variant="outline">Showcase</Badge>
          {/if}
          {#if data.card.is_extended}
            <Badge variant="outline">Extended Art</Badge>
          {/if}
          {#if data.card.is_retro}
            <Badge variant="outline">Retro</Badge>
          {/if}
        </div>

        <!-- Price row: our price + market price -->
        <div class="flex items-baseline gap-3">
          <p class="text-3xl font-bold">{formatPrice(price)}</p>
          {#if enrichmentLoading}
            <span class="text-sm text-muted-foreground animate-pulse">mkt …</span>
          {:else}
            {@const mktPrice = getMarketPrice()}
            {#if mktPrice}
              <span class="text-sm text-muted-foreground">mkt ${mktPrice}</span>
            {/if}
          {/if}
        </div>
        <p class="text-sm text-muted-foreground -mt-3">Serial: {data.card.serial}</p>

        <Separator />

        <!-- Type line -->
        {#if data.card.type_line}
          <div>
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Type</h3>
            <p>{data.card.type_line}</p>
          </div>
        {/if}

        <!-- Oracle text (Scryfall enrichment, with mana symbols) -->
        {#if enrichmentLoading}
          <div>
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Oracle Text</h3>
            <div class="space-y-1.5">
              <div class="h-3.5 w-full animate-pulse rounded bg-muted"></div>
              <div class="h-3.5 w-5/6 animate-pulse rounded bg-muted"></div>
              <div class="h-3.5 w-4/6 animate-pulse rounded bg-muted"></div>
            </div>
          </div>
        {:else if enrichment?.oracle_text}
          <div>
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Oracle Text</h3>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <p class="whitespace-pre-line text-sm leading-relaxed">
              {@html renderOracleText(enrichment.oracle_text)}
            </p>
          </div>
        {/if}

        <!-- Color identity (kept from original) -->
        {#if data.card.color_identity}
          <div>
            <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Color Identity</h3>
            <p class="text-muted-foreground">{data.card.color_identity}</p>
          </div>
        {/if}

      </Card.Content>

      <Card.Footer class="flex flex-wrap items-center gap-4">
        <!-- Quantity Controls -->
        {#if data.card.is_in_stock}
          <div class="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              class="h-10 w-10 rounded-r-none"
              onclick={decrementQuantity}
              disabled={quantity <= 1}
            >
              <Minus class="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min="1"
              max="99"
              class="h-10 w-14 rounded-none border-x border-y-0 text-center text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              bind:value={quantity}
            />
            <Button
              variant="ghost"
              size="icon"
              class="h-10 w-10 rounded-l-none"
              onclick={incrementQuantity}
              disabled={quantity >= 99}
            >
              <Plus class="h-4 w-4" />
            </Button>
          </div>
        {/if}

        <Button size="lg" onclick={addToCart} disabled={!data.card.is_in_stock} id="add-to-cart-detail">
          <ShoppingCart class="mr-2 h-4 w-4" />
          Add to Cart
        </Button>

        {#if data.card.scryfall_link}
          <Button variant="outline" size="lg" href={data.card.scryfall_link} target="_blank">
            <ExternalLink class="mr-2 h-4 w-4" />
            View on Scryfall
          </Button>
        {/if}
      </Card.Footer>
    </Card.Root>
  </div>
</div>
