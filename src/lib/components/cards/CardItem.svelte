<script lang="ts">
  import type { Card } from '$lib/server/types';
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as CardUI from '$components/ui/card';
  import { getRonImageUrl, getScryfallImageUrl, getCardPrice, formatPrice, getCardUrl } from '$lib/utils';
  import { Plus } from 'lucide-svelte';
  import { cartStore } from '$lib/stores/cart.svelte';

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

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

  function addToCart(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    cartStore.addItem(card);
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
        <Badge class="absolute left-2 top-2 bg-green-600">New</Badge>
      {/if}

      <!-- Quick add button -->
      {#if card.is_in_stock}
        <Button
          size="icon"
          class="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
          onclick={addToCart}
        >
          <Plus class="h-4 w-4" />
        </Button>
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
        <Badge variant="secondary" class="text-xs">{card.card_type}</Badge>
      </div>
    </CardUI.Content>
  </CardUI.Root>
</a>
