<script lang="ts">
  import type { Card } from '$lib/server/types';
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { getCardImageUrl, getCardPrice, formatPrice } from '$lib/utils';
  import { ShoppingCart, Plus } from 'lucide-svelte';
  import { cartStore } from '$lib/stores/cart.svelte';

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const imageUrl = getCardImageUrl(card.ron_image_url, card.scryfall_id, 'normal');
  const price = getCardPrice(card.card_type);

  function addToCart(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    cartStore.addItem(card);
  }
</script>

<a 
  href="/cards/{card.serial}" 
  class="card-hover group relative flex flex-col overflow-hidden rounded-lg border bg-card"
>
  <!-- Card Image -->
  <div class="relative aspect-[2.5/3.5] overflow-hidden bg-muted">
    <img
      src={imageUrl}
      alt={card.card_name}
      class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
      loading="lazy"
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
  <div class="flex flex-1 flex-col p-3">
    <h3 class="line-clamp-2 text-sm font-medium leading-tight">
      {card.card_name}
    </h3>
    <p class="mt-1 text-xs text-muted-foreground">
      {card.set_name}
    </p>
    <div class="mt-auto flex items-center justify-between pt-2">
      <span class="font-bold">{formatPrice(price)}</span>
      <Badge variant="secondary" class="text-xs">{card.card_type}</Badge>
    </div>
  </div>
</a>
