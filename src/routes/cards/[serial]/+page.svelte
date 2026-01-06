<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { getCardImageUrl, getCardPrice, formatPrice } from '$lib/utils';
  import { ShoppingCart, ExternalLink, ArrowLeft } from 'lucide-svelte';
  import { cartStore } from '$lib/stores/cart.svelte';

  let { data } = $props();
  const card = data.card;

  const imageUrl = getCardImageUrl(card.ron_image_url, card.scryfall_id, 'large');
  const price = getCardPrice(card.card_type);

  function addToCart() {
    cartStore.addItem(card);
  }
</script>

<svelte:head>
  <title>{card.card_name} - Group Buy</title>
</svelte:head>

<div class="container py-8">
  <a href="/" class="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <ArrowLeft class="h-4 w-4" />
    Back to catalog
  </a>

  <div class="grid gap-8 lg:grid-cols-2">
    <!-- Card Image -->
    <div class="flex justify-center">
      <img
        src={imageUrl}
        alt={card.card_name}
        class="max-w-sm rounded-lg shadow-lg"
        loading="lazy"
      />
    </div>

    <!-- Card Details -->
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold">{card.card_name}</h1>
        <p class="text-lg text-muted-foreground">{card.set_name}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Badge variant={card.is_in_stock ? 'default' : 'destructive'}>
          {card.is_in_stock ? 'In Stock' : 'Out of Stock'}
        </Badge>
        <Badge variant="secondary">{card.card_type}</Badge>
        {#if card.is_new}
          <Badge variant="outline" class="border-green-500 text-green-500">New</Badge>
        {/if}
        {#if card.is_foil}
          <Badge variant="outline">Foil</Badge>
        {/if}
        {#if card.is_borderless}
          <Badge variant="outline">Borderless</Badge>
        {/if}
        {#if card.is_showcase}
          <Badge variant="outline">Showcase</Badge>
        {/if}
        {#if card.is_extended}
          <Badge variant="outline">Extended Art</Badge>
        {/if}
        {#if card.is_retro}
          <Badge variant="outline">Retro</Badge>
        {/if}
      </div>

      <div class="space-y-2">
        <p class="text-3xl font-bold">{formatPrice(price)}</p>
        <p class="text-sm text-muted-foreground">
          Serial: {card.serial}
        </p>
      </div>

      {#if card.type_line}
        <div>
          <h3 class="font-semibold">Type</h3>
          <p class="text-muted-foreground">{card.type_line}</p>
        </div>
      {/if}

      {#if card.mana_cost}
        <div>
          <h3 class="font-semibold">Mana Cost</h3>
          <p class="text-muted-foreground">{card.mana_cost}</p>
        </div>
      {/if}

      {#if card.color_identity}
        <div>
          <h3 class="font-semibold">Color Identity</h3>
          <p class="text-muted-foreground">{card.color_identity}</p>
        </div>
      {/if}

      <div class="flex gap-4 pt-4">
        <Button 
          size="lg" 
          onclick={addToCart}
          disabled={!card.is_in_stock}
        >
          <ShoppingCart class="mr-2 h-4 w-4" />
          Add to Cart
        </Button>

        {#if card.scryfall_link}
          <Button variant="outline" size="lg" href={card.scryfall_link} target="_blank">
            <ExternalLink class="mr-2 h-4 w-4" />
            View on Scryfall
          </Button>
        {/if}
      </div>
    </div>
  </div>
</div>
