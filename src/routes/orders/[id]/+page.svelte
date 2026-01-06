<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { formatPrice, getTrackingUrl } from '$lib/utils';
  import { ArrowLeft, Check, ExternalLink, Package, Truck } from 'lucide-svelte';

  let { data } = $props();
  const { order, showSuccess } = data;

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    invoiced: 'bg-blue-500',
    paid: 'bg-green-500',
    processing: 'bg-purple-500',
    shipped: 'bg-indigo-500',
    delivered: 'bg-green-600',
    cancelled: 'bg-red-500'
  };

  const total = order.order_items.reduce(
    (sum: number, item: any) => sum + item.unit_price * item.quantity,
    0
  );
</script>

<svelte:head>
  <title>Order {order.order_number} - Group Buy</title>
</svelte:head>

<div class="container max-w-4xl py-8">
  <a href="/orders" class="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <ArrowLeft class="h-4 w-4" />
    Back to orders
  </a>

  {#if showSuccess}
    <div class="mb-6 rounded-lg border border-green-500 bg-green-50 p-4 dark:bg-green-900/20">
      <div class="flex items-center gap-2 text-green-700 dark:text-green-400">
        <Check class="h-5 w-5" />
        <span class="font-medium">Order placed successfully!</span>
      </div>
      <p class="mt-1 text-sm text-green-600 dark:text-green-500">
        You'll receive an email with your PayPal invoice shortly.
      </p>
    </div>
  {/if}

  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">{order.order_number}</h1>
      <p class="text-muted-foreground">
        Placed {new Date(order.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}
      </p>
    </div>
    <Badge class={statusColors[order.status]} variant="default">
      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
    </Badge>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Order Items -->
    <div class="lg:col-span-2">
      <div class="rounded-lg border">
        <div class="border-b p-4">
          <h2 class="font-semibold">Order Items</h2>
        </div>
        <div class="divide-y">
          {#each order.order_items as item (item.id)}
            <div class="flex items-center justify-between p-4">
              <div>
                <p class="font-medium">{item.card_name}</p>
                <p class="text-sm text-muted-foreground">
                  {item.card_serial} • {item.card_type}
                </p>
              </div>
              <div class="text-right">
                <p class="font-medium">{formatPrice(item.unit_price * item.quantity)}</p>
                <p class="text-sm text-muted-foreground">
                  {item.quantity} × {formatPrice(item.unit_price)}
                </p>
              </div>
            </div>
          {/each}
        </div>
        <div class="border-t bg-muted/50 p-4">
          <div class="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Shipping Address -->
      <div class="rounded-lg border p-4">
        <h3 class="mb-2 font-semibold">Shipping Address</h3>
        <address class="text-sm not-italic text-muted-foreground">
          {order.shipping_name}<br />
          {order.shipping_line1}<br />
          {#if order.shipping_line2}
            {order.shipping_line2}<br />
          {/if}
          {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}<br />
          {order.shipping_country}
        </address>
      </div>

      <!-- Payment -->
      {#if order.paypal_invoice_url}
        <div class="rounded-lg border p-4">
          <h3 class="mb-2 font-semibold">Payment</h3>
          {#if order.status === 'invoiced'}
            <Button href={order.paypal_invoice_url} target="_blank" class="w-full">
              <ExternalLink class="mr-2 h-4 w-4" />
              Pay Invoice
            </Button>
          {:else if order.paid_at}
            <div class="flex items-center gap-2 text-green-600">
              <Check class="h-4 w-4" />
              <span>Paid on {new Date(order.paid_at).toLocaleDateString()}</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Tracking -->
      {#if order.tracking_number}
        <div class="rounded-lg border p-4">
          <h3 class="mb-2 font-semibold">Tracking</h3>
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm">
              <Truck class="h-4 w-4" />
              <span>{order.tracking_carrier || 'Carrier'}</span>
            </div>
            <p class="font-mono text-sm">{order.tracking_number}</p>
            <Button
              variant="outline"
              href={getTrackingUrl(order.tracking_number)}
              target="_blank"
              class="w-full"
            >
              <ExternalLink class="mr-2 h-4 w-4" />
              Track Package
            </Button>
          </div>
        </div>
      {:else if order.status === 'processing' || order.status === 'paid'}
        <div class="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
          <Package class="mx-auto mb-2 h-8 w-8" />
          <p class="text-sm">Tracking info will appear here once shipped</p>
        </div>
      {/if}
    </div>
  </div>
</div>
