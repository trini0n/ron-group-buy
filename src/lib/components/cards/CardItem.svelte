<script lang="ts">
  import type { Card } from '$lib/server/types';
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as CardUI from '$components/ui/card';
  import { Input } from '$components/ui/input';
  import * as Tooltip from '$components/ui/tooltip';
  import { getRonImageUrl, getScryfallImageUrl, getCardPrice, formatPrice, getCardUrl, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { Plus, Minus, ShoppingCart } from 'lucide-svelte';
  import { cartStore } from '$lib/stores/cart.svelte';

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  // Quantity state
  let quantity = $state(1);

  // Get both image URLs
  const ronImageUrl = $derived(getRonImageUrl(card.ron_image_url));
  const scryfallImageUrl = $derived(
    card.scryfall_id ? getScryfallImageUrl(card.scryfall_id, 'normal') : '/images/card-placeholder.png'
  );

  // Track if Ron's image has failed for this specific card
  let ronImageFailed = $state(false);

  // Reset failed state when card changes
  $effect(() => {
    // When card.serial changes, reset the failed state
    const _ = card.serial;
    ronImageFailed = false;
  });

  // Use Ron's image first (if available and not failed), otherwise Scryfall
  const currentImageUrl = $derived(ronImageUrl && !ronImageFailed ? ronImageUrl : scryfallImageUrl);

  const price = $derived(getCardPrice(card.card_type));

  // Format card identifier: SET_CODE #COLLECTOR_NUMBER (LANG if not 'en')
  const cardIdentifier = $derived.by(() => {
    const parts: string[] = [];
    if (card.set_code) {
      parts.push(card.set_code.toUpperCase());
    }
    if (card.collector_number) {
      parts.push(`#${card.collector_number}`);
    }
    if (card.language && card.language.toLowerCase() !== 'en') {
      parts.push(`(${card.language.toUpperCase()})`);
    }
    return parts.join(' ') || card.set_name || '';
  });

  // Get display label for card finish (Normal, Holo, Foil, or Surge Foil)
  const finishLabel = $derived(getFinishLabel(card));
  const finishClasses = $derived(getFinishBadgeClasses(finishLabel));

  function addToCart(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    cartStore.addItem(card, quantity);
    quantity = 1; // Reset after adding
  }

  function incrementQuantity(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (quantity < 99) quantity++;
  }

  function decrementQuantity(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (quantity > 1) quantity--;
  }

  function handleQuantityInput(e: Event) {
    e.stopPropagation();
  }

  function handleImageError() {
    // If we're currently showing Ron's image, mark it as failed to switch to Scryfall
    if (ronImageUrl && !ronImageFailed) {
      ronImageFailed = true;
    }
  }
</script>

<a href={getCardUrl(card)} class="card-hover group block">
  <CardUI.Root class="overflow-hidden">
    <!-- Card Image -->
    <div class="relative aspect-[2.5/3.5] overflow-hidden bg-muted">
      <img
        src={currentImageUrl}
        alt={card.card_name}
        class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror={() => handleImageError()}
      />

      <!-- Out of stock overlay -->
      {#if !card.is_in_stock}
        <div class="absolute inset-0 flex items-center justify-center bg-black/60">
          <Badge variant="destructive" class="text-sm">Out of Stock</Badge>
        </div>
      {/if}

      <!-- New badge -->
      {#if card.is_new}
        <Badge class="absolute right-2 top-2 bg-green-600/65 backdrop-blur-sm">New</Badge>
      {/if}
    </div>

    <!-- Card Info -->
    <CardUI.Content class="p-3">
      <h3 class="line-clamp-2 text-sm font-medium leading-tight">
        {card.card_name}
      </h3>
      <p class="mt-1 text-xs text-muted-foreground">
        {cardIdentifier}
      </p>
      <div class="mt-2 flex items-center justify-between">
        <span class="font-bold">{formatPrice(price)}</span>
        <Badge class="text-xs {finishClasses}">{finishLabel}</Badge>
      </div>

      <!-- Quantity & Add to Cart -->
      {#if card.is_in_stock}
        <div class="mt-3 flex items-center justify-between gap-2" role="group">
          <div class="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 rounded-r-none"
              onclick={decrementQuantity}
              disabled={quantity <= 1}
            >
              <Minus class="h-3 w-3" />
            </Button>
            <Input
              type="number"
              min="1"
              max="99"
              class="h-7 w-10 rounded-none border-x border-y-0 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              bind:value={quantity}
              onclick={handleQuantityInput}
            />
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7 rounded-l-none"
              onclick={incrementQuantity}
              disabled={quantity >= 99}
            >
              <Plus class="h-3 w-3" />
            </Button>
          </div>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <Button size="icon" class="h-8 w-8" onclick={addToCart}>
                <ShoppingCart class="h-4 w-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Add to Cart</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
      {/if}
    </CardUI.Content>
  </CardUI.Root>
</a>
