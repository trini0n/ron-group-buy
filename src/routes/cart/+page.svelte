<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { getCardImageUrl, getCardPrice, formatPrice, getCardUrl, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, Loader2, AlertTriangle } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let { data } = $props();

  // Sync cart from server on mount
  onMount(() => {
    cartStore.syncFromServer();
  });

  const isGroupBuyOpen = $derived.by(() => {
    if (!data.groupBuyConfig) return false;
    const now = new Date();
    const opens = data.groupBuyConfig.opens_at ? new Date(data.groupBuyConfig.opens_at) : null;
    const closes = data.groupBuyConfig.closes_at ? new Date(data.groupBuyConfig.closes_at) : null;

    if (opens && now < opens) return false;
    if (closes && now > closes) return false;
    return data.groupBuyConfig.is_active;
  });
</script>

<svelte:head>
  <title>Shopping Cart - Group Buy</title>
</svelte:head>

<div class="container py-8">
  <h1 class="mb-8 text-3xl font-bold">Shopping Cart</h1>

  {#if cartStore.items.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <ShoppingCart class="mb-4 h-16 w-16 text-muted-foreground" />
      <h2 class="text-xl font-medium">Your cart is empty</h2>
      <p class="mt-2 text-muted-foreground">
        Start browsing cards to add them to your cart.
      </p>
      <Button href="/" class="mt-4">
        Browse Cards
      </Button>
    </div>
  {:else}
    <!-- Loading/Syncing indicator -->
    {#if cartStore.isSyncing}
      <div class="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 class="h-4 w-4 animate-spin" />
        Syncing cart...
      </div>
    {/if}

    <!-- Validation warnings -->
    {#if cartStore.validation?.invalid_items?.length || cartStore.validation?.price_changes?.length}
      <div class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <div class="flex items-start gap-3">
          <AlertTriangle class="mt-0.5 h-5 w-5 text-amber-600" />
          <div class="flex-1">
            <h3 class="font-medium text-amber-800 dark:text-amber-200">Cart Changes Detected</h3>
            <ul class="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
              {#each cartStore.validation?.invalid_items || [] as item}
                <li>
                  <strong>{item.card_name}</strong>: {item.reason === 'sold_out' ? 'Sold out' : item.reason === 'listing_removed' ? 'No longer available' : 'Quantity reduced'}
                </li>
              {/each}
              {#each cartStore.validation?.price_changes || [] as change}
                <li>
                  <strong>{change.card_name}</strong>: Price changed from {formatPrice(change.old_price)} to {formatPrice(change.new_price)}
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    {/if}

    <div class="grid gap-8 lg:grid-cols-3">
      <!-- Cart Items -->
      <div class="lg:col-span-2">
        <div class="space-y-4">
          {#each cartStore.items as item (item.id)}
            {@const price = getCardPrice(item.card.card_type)}
            {@const imageUrl = getCardImageUrl(item.card.ron_image_url, item.card.scryfall_id, 'small')}

            <Card.Root>
              <Card.Content class="flex gap-4 p-4">
                <!-- Card Image -->
                <a href={getCardUrl(item.card)} class="shrink-0">
                  <img
                    src={imageUrl}
                    alt={item.card.card_name}
                    class="h-24 w-auto rounded"
                    loading="lazy"
                  />
                </a>

                <!-- Card Details -->
                <div class="flex flex-1 flex-col">
                  <div class="flex items-start justify-between">
                    <div>
                      <a href={getCardUrl(item.card)} class="font-medium hover:underline">
                        {item.card.card_name}
                      </a>
                      <p class="text-sm text-muted-foreground">{item.card.set_name}</p>
                      <div class="mt-1 flex gap-2">
                        <Badge class="text-xs {getFinishBadgeClasses(getFinishLabel(item.card))}">{getFinishLabel(item.card)}</Badge>
                        {#if !item.card.is_in_stock}
                          <Badge variant="destructive" class="text-xs">Out of Stock</Badge>
                        {/if}
                      </div>
                    </div>
                    <span class="font-bold">{formatPrice(price * item.quantity)}</span>
                  </div>

                  <div class="mt-auto flex items-center justify-between pt-2">
                    <!-- Quantity Controls -->
                    <div class="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8"
                        onclick={() => cartStore.updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus class="h-3 w-3" />
                      </Button>
                      <span class="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8"
                        onclick={() => cartStore.updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus class="h-3 w-3" />
                      </Button>
                    </div>

                    <!-- Remove Button -->
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:text-destructive"
                      onclick={() => cartStore.removeItem(item.id)}
                    >
                      <Trash2 class="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>

        <div class="mt-4 flex justify-between">
          <Button variant="outline" href="/">Continue Shopping</Button>
          <Button variant="ghost" onclick={() => cartStore.clear()}>Clear Cart</Button>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="lg:col-span-1">
        <Card.Root class="sticky top-24">
          <Card.Header>
            <Card.Title>Order Summary</Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Items ({cartStore.itemCount})</span>
                <span>{formatPrice(cartStore.total)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">Shipping</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div class="border-t pt-4">
              <div class="flex justify-between text-lg font-bold">
                <span>Subtotal</span>
                <span>{formatPrice(cartStore.total)}</span>
              </div>
            </div>

            <Button
              class="w-full"
              size="lg"
              href="/checkout"
              disabled={!isGroupBuyOpen}
            >
              {#if isGroupBuyOpen}
                Proceed to Checkout
                <ArrowRight class="ml-2 h-4 w-4" />
              {:else}
                Group Buy Closed
              {/if}
            </Button>

            {#if !isGroupBuyOpen}
              <p class="text-center text-sm text-muted-foreground">
                Checkout is disabled while the group buy is closed.
              </p>
            {/if}

            {#if !data.user}
              <p class="text-center text-sm text-muted-foreground">
                You'll need to sign in to complete your order.
              </p>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>
