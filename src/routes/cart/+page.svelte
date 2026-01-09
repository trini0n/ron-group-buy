<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import * as AlertDialog from '$components/ui/alert-dialog';
  import * as Dialog from '$components/ui/dialog';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { getCardImageUrl, getCardPrice, formatPrice, getCardUrl, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { Trash2, Minus, Plus, ShoppingCart, ArrowRight, Loader2, AlertTriangle, Info, Package, X, Merge } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';

  let clearCartDialogOpen = $state(false);
  let pendingOrderDialogOpen = $state(false);
  let isPendingOrderAction = $state(false);

  let { data } = $props();

  // Sync cart from server on mount
  onMount(() => {
    cartStore.syncFromServer();
  });

  const isGroupBuyOpen = $derived.by(() => {
    if (!data.groupBuyConfig) return false;
    // If not active, it's closed
    if (!data.groupBuyConfig.is_active) return false;
    
    const now = new Date();
    const opens = data.groupBuyConfig.opens_at ? new Date(data.groupBuyConfig.opens_at) : null;
    const closes = data.groupBuyConfig.closes_at ? new Date(data.groupBuyConfig.closes_at) : null;

    // If opens_at is set and we haven't reached it yet, it's not open
    if (opens && now < opens) return false;
    // If closes_at is set and we've passed it, it's not open
    if (closes && now > closes) return false;
    
    // Active and within date range (or no date constraints)
    return true;
  });

  async function handlePendingOrderAction(action: 'merge' | 'cancel') {
    if (!data.existingPendingOrder) return;
    
    isPendingOrderAction = true;
    try {
      const response = await fetch(`/api/orders/${data.existingPendingOrder.id}/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        pendingOrderDialogOpen = false;
        if (action === 'merge') {
          await cartStore.syncFromServer();
          toast.success('Order items added to your cart');
        } else {
          toast.success('Pending order cancelled');
        }
        // Force page reload to clear the pending order from data
        window.location.reload();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to process order');
      }
    } catch (err) {
      toast.error('Failed to process order');
    } finally {
      isPendingOrderAction = false;
    }
  }
</script>

<svelte:head>
  <title>Shopping Cart - Group Buy</title>
</svelte:head>

<div class="container py-8">
  <h1 class="mb-8 text-3xl font-bold">Shopping Cart</h1>

  <!-- Existing Pending Order Notice -->
  {#if data.existingPendingOrder}
    <div class="mb-6 rounded-lg border border-blue-400 bg-blue-50 p-4 dark:border-blue-600 dark:bg-blue-900/20">
      <div class="flex items-center gap-3">
        <Info class="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div class="flex-1 min-w-0">
          <h3 class="font-medium text-blue-800 dark:text-blue-300">You have a pending order</h3>
          <p class="mt-0.5 text-sm text-blue-700 dark:text-blue-400">
            Order <span class="font-mono font-medium">{data.existingPendingOrder.orderNumber}</span> has {data.existingPendingOrder.itemCount} 
            {data.existingPendingOrder.itemCount === 1 ? 'card' : 'cards'} totaling {formatPrice(data.existingPendingOrder.total)}.
          </p>
        </div>
        <Button 
          variant="outline"
          size="sm"
          class="shrink-0 border-blue-400 text-blue-700 hover:bg-blue-100 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-900/40"
          onclick={() => pendingOrderDialogOpen = true}
        >
          <Package class="mr-2 h-4 w-4" />
          Manage
        </Button>
      </div>
    </div>
  {/if}

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
          <AlertDialog.Root bind:open={clearCartDialogOpen}>
            <AlertDialog.Trigger>
              {#snippet child({ props })}
                <Button variant="ghost" {...props}>Clear Cart</Button>
              {/snippet}
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Clear Cart?</AlertDialog.Title>
                <AlertDialog.Description>
                  Are you sure you want to clear your cart completely? This will remove all {cartStore.itemCount} item{cartStore.itemCount === 1 ? '' : 's'} from your cart. This action cannot be undone.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action onclick={() => cartStore.clear()}>Clear Cart</AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
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

<!-- Pending Order Dialog -->
<Dialog.Root bind:open={pendingOrderDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Pending Order</Dialog.Title>
      <Dialog.Description>
        Order <span class="font-mono font-medium">{data.existingPendingOrder?.orderNumber}</span>
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="py-4">
      <div class="rounded-lg bg-muted/50 p-4">
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">Items</span>
          <span class="font-medium">{data.existingPendingOrder?.itemCount} cards</span>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-sm text-muted-foreground">Total</span>
          <span class="font-bold">{formatPrice(data.existingPendingOrder?.total ?? 0)}</span>
        </div>
      </div>
      
      <p class="mt-4 text-sm text-muted-foreground">
        What would you like to do with this order?
      </p>
    </div>
    
    <div class="space-y-2">
      <Button 
        class="w-full justify-start gap-3 h-auto py-4" 
        variant="outline"
        onclick={() => handlePendingOrderAction('merge')}
        disabled={isPendingOrderAction}
      >
        <Merge class="h-4 w-4 text-green-500" />
        <div class="text-left">
          <p class="font-medium">Add to cart</p>
          <p class="text-xs text-muted-foreground">Merge these items into your current cart</p>
        </div>
      </Button>
      
      <Button 
        class="w-full justify-start gap-3 h-auto py-4" 
        variant="outline"
        onclick={() => handlePendingOrderAction('cancel')}
        disabled={isPendingOrderAction}
      >
        <X class="h-4 w-4 text-red-500" />
        <div class="text-left">
          <p class="font-medium">Cancel order</p>
          <p class="text-xs text-muted-foreground">Delete this pending order</p>
        </div>
      </Button>
    </div>
    
    <Dialog.Footer class="mt-4">
      <Button variant="ghost" onclick={() => pendingOrderDialogOpen = false}>
        Close
      </Button>
      <Button variant="outline" href="/orders/{data.existingPendingOrder?.id}">
        View full order
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
