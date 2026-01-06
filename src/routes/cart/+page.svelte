<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { getCardImageUrl, getCardPrice, formatPrice } from '$lib/utils';
  import { Trash2, Minus, Plus, ShoppingCart, ArrowRight } from 'lucide-svelte';

  let { data } = $props();

  const isGroupBuyOpen = $derived(() => {
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
    <div class="grid gap-8 lg:grid-cols-3">
      <!-- Cart Items -->
      <div class="lg:col-span-2">
        <div class="space-y-4">
          {#each cartStore.items as item (item.card.serial)}
            {@const price = getCardPrice(item.card.card_type)}
            {@const imageUrl = getCardImageUrl(item.card.ron_image_url, item.card.scryfall_id, 'small')}
            
            <div class="flex gap-4 rounded-lg border bg-card p-4">
              <!-- Card Image -->
              <a href="/cards/{item.card.serial}" class="shrink-0">
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
                    <a href="/cards/{item.card.serial}" class="font-medium hover:underline">
                      {item.card.card_name}
                    </a>
                    <p class="text-sm text-muted-foreground">{item.card.set_name}</p>
                    <div class="mt-1 flex gap-2">
                      <Badge variant="secondary" class="text-xs">{item.card.card_type}</Badge>
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
                      onclick={() => cartStore.updateQuantity(item.card.serial, item.quantity - 1)}
                    >
                      <Minus class="h-3 w-3" />
                    </Button>
                    <span class="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      class="h-8 w-8"
                      onclick={() => cartStore.updateQuantity(item.card.serial, item.quantity + 1)}
                    >
                      <Plus class="h-3 w-3" />
                    </Button>
                  </div>

                  <!-- Remove Button -->
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive"
                    onclick={() => cartStore.removeItem(item.card.serial)}
                  >
                    <Trash2 class="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="mt-4 flex justify-between">
          <Button variant="outline" href="/">
            Continue Shopping
          </Button>
          <Button variant="ghost" onclick={() => cartStore.clear()}>
            Clear Cart
          </Button>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="lg:col-span-1">
        <div class="sticky top-24 rounded-lg border bg-card p-6">
          <h2 class="mb-4 text-lg font-semibold">Order Summary</h2>
          
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

          <div class="my-4 border-t"></div>

          <div class="flex justify-between text-lg font-bold">
            <span>Subtotal</span>
            <span>{formatPrice(cartStore.total)}</span>
          </div>

          <Button 
            class="mt-6 w-full" 
            size="lg"
            href="/checkout"
            disabled={!isGroupBuyOpen()}
          >
            {#if isGroupBuyOpen()}
              Proceed to Checkout
              <ArrowRight class="ml-2 h-4 w-4" />
            {:else}
              Group Buy Closed
            {/if}
          </Button>

          {#if !isGroupBuyOpen()}
            <p class="mt-2 text-center text-sm text-muted-foreground">
              Checkout is disabled while the group buy is closed.
            </p>
          {/if}

          {#if !data.user}
            <p class="mt-4 text-center text-sm text-muted-foreground">
              You'll need to sign in to complete your order.
            </p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
