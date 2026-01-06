<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import { Separator } from '$components/ui/separator';
  import { Input } from '$components/ui/input';
  import { getCardImages, getCardPrice, formatPrice } from '$lib/utils';
  import { ShoppingCart, ExternalLink, ArrowLeft, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-svelte';
  import { cartStore } from '$lib/stores/cart.svelte';

  let { data } = $props();

  // Quantity state
  let quantity = $state(1);

  // Compute images array - ensure it's always valid
  const images = $derived.by(() => {
    const cardData = data.card;
    if (!cardData) return [{ url: '/images/card-placeholder.png', label: 'Placeholder' }];
    return getCardImages(cardData.ron_image_url, cardData.scryfall_id, 'large');
  });

  let currentImageIndex = $state(0);
  
  const price = $derived.by(() => {
    const cardData = data.card;
    if (!cardData) return 0;
    return getCardPrice(cardData.card_type);
  });

  // Reset image index when card changes or if index is out of bounds
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
    quantity = 1; // Reset after adding
  }

  function incrementQuantity() {
    if (quantity < 99) quantity++;
  }

  function decrementQuantity() {
    if (quantity > 1) quantity--;
  }

  // Current image with safety check
  const currentImage = $derived(images[currentImageIndex] ?? images[0]);

  // Format card identifier: SET_CODE #COLLECTOR_NUMBER (LANG if not 'en')
  const cardIdentifier = $derived.by(() => {
    const c = data.card;
    const parts: string[] = [];
    if (c.set_code) {
      parts.push(c.set_code.toUpperCase());
    }
    if (c.collector_number) {
      parts.push(`#${c.collector_number}`);
    }
    if (c.language && c.language.toLowerCase() !== 'en') {
      parts.push(`(${c.language.toUpperCase()})`);
    }
    return parts.join(' ') || c.set_name || '';
  });
</script>

<svelte:head>
  <title>{data.card.card_name} - Group Buy</title>
</svelte:head>

<div class="container py-8">
  <a href="/" class="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <ArrowLeft class="h-4 w-4" />
    Back to catalog
  </a>

  <div class="grid gap-8 lg:grid-cols-2">
    <!-- Card Image Carousel -->
    <div class="flex flex-col items-center gap-4">
      <div class="relative">
        {#if currentImage}
          <img
            src={currentImage.url}
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

    <!-- Card Details -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="text-3xl">{data.card.card_name}</Card.Title>
        <Card.Description class="text-lg">{cardIdentifier}</Card.Description>
      </Card.Header>

      <Card.Content class="space-y-6">
        <div class="flex flex-wrap gap-2">
          <Badge variant={data.card.is_in_stock ? 'default' : 'destructive'}>
            {data.card.is_in_stock ? 'In Stock' : 'Out of Stock'}
          </Badge>
          <Badge variant="secondary">{data.card.card_type}</Badge>
          {#if data.card.is_new}
            <Badge variant="outline" class="border-green-500 text-green-500">New</Badge>
          {/if}
          {#if data.card.is_foil}
            <Badge variant="outline">Foil</Badge>
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

        <div class="space-y-2">
          <p class="text-3xl font-bold">{formatPrice(price)}</p>
          <p class="text-sm text-muted-foreground">Serial: {data.card.serial}</p>
        </div>

        <Separator />

        {#if data.card.type_line}
          <div>
            <h3 class="font-semibold">Type</h3>
            <p class="text-muted-foreground">{data.card.type_line}</p>
          </div>
        {/if}

        {#if data.card.mana_cost}
          <div>
            <h3 class="font-semibold">Mana Cost</h3>
            <p class="text-muted-foreground">{data.card.mana_cost}</p>
          </div>
        {/if}

        {#if data.card.color_identity}
          <div>
            <h3 class="font-semibold">Color Identity</h3>
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

        <Button size="lg" onclick={addToCart} disabled={!data.card.is_in_stock}>
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
