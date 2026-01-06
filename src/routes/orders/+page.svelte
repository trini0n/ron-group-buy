<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { formatPrice, getTrackingUrl } from '$lib/utils';
  import { Package, ExternalLink } from 'lucide-svelte';

  let { data } = $props();

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    invoiced: 'bg-blue-500',
    paid: 'bg-green-500',
    processing: 'bg-purple-500',
    shipped: 'bg-indigo-500',
    delivered: 'bg-green-600',
    cancelled: 'bg-red-500'
  };

  function calculateOrderTotal(items: any[]): number {
    return items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }
</script>

<svelte:head>
  <title>Order History - Group Buy</title>
</svelte:head>

<div class="container py-8">
  <h1 class="mb-8 text-3xl font-bold">Order History</h1>

  {#if data.orders.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <Package class="mb-4 h-16 w-16 text-muted-foreground" />
      <h2 class="text-xl font-medium">No orders yet</h2>
      <p class="mt-2 text-muted-foreground">
        When you place an order, it will appear here.
      </p>
      <Button href="/" class="mt-4">
        Start Shopping
      </Button>
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.orders as order (order.id)}
        {@const total = calculateOrderTotal(order.order_items)}
        
        <div class="rounded-lg border bg-card">
          <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold">{order.order_number}</span>
                <Badge class={statusColors[order.status]}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                Placed {new Date(order.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            <div class="flex items-center gap-4">
              <span class="text-lg font-bold">{formatPrice(total)}</span>
              <Button variant="outline" href="/orders/{order.id}">
                View Details
              </Button>
            </div>
          </div>

          <!-- Order Items Preview -->
          <div class="border-t px-4 py-3">
            <p class="text-sm text-muted-foreground">
              {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}:
              {order.order_items.slice(0, 3).map((i) => i.card_name).join(', ')}
              {#if order.order_items.length > 3}
                and {order.order_items.length - 3} more
              {/if}
            </p>
          </div>

          <!-- Tracking Info -->
          {#if order.tracking_number}
            <div class="border-t bg-muted/50 px-4 py-3">
              <a
                href={getTrackingUrl(order.tracking_number)}
                target="_blank"
                class="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink class="h-4 w-4" />
                Track Package: {order.tracking_number}
              </a>
            </div>
          {/if}

          <!-- PayPal Invoice Link -->
          {#if order.paypal_invoice_url && order.status === 'invoiced'}
            <div class="border-t bg-yellow-50 px-4 py-3 dark:bg-yellow-900/20">
              <a
                href={order.paypal_invoice_url}
                target="_blank"
                class="inline-flex items-center gap-2 text-sm font-medium text-yellow-700 hover:underline dark:text-yellow-400"
              >
                <ExternalLink class="h-4 w-4" />
                Pay Invoice via PayPal
              </a>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
