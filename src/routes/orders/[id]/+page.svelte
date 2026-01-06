<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import { formatPrice, getTrackingUrl } from '$lib/utils';
  import { ArrowLeft, Check, ExternalLink, Package, Truck } from 'lucide-svelte';

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

  const total = $derived.by(() => data.order.order_items.reduce(
    (sum: number, item: any) => sum + item.unit_price * (item.quantity ?? 1),
    0
  ));
</script>

<svelte:head>
  <title>Order {data.order.order_number} - Group Buy</title>
</svelte:head>

<div class="container max-w-4xl py-8">
  <a href="/orders" class="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <ArrowLeft class="h-4 w-4" />
    Back to orders
  </a>

  {#if data.showSuccess}
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
      <h1 class="text-2xl font-bold">{data.order.order_number}</h1>
      <p class="text-muted-foreground">
        Placed {new Date(data.order.created_at ?? Date.now()).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}
      </p>
    </div>
    <Badge class={statusColors[data.order.status ?? 'pending']} variant="default">
      {(data.order.status ?? 'pending').charAt(0).toUpperCase() + (data.order.status ?? 'pending').slice(1)}
    </Badge>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Order Items -->
    <div class="lg:col-span-2">
      <Card.Root>
        <Card.Header class="border-b">
          <Card.Title>Order Items</Card.Title>
        </Card.Header>
        <Card.Content class="p-0">
          <div class="divide-y">
            {#each data.order.order_items as item (item.id)}
              <div class="flex items-center justify-between p-4">
                <div>
                  <p class="font-medium">{item.card_name}</p>
                  <p class="text-sm text-muted-foreground">
                    {item.card_serial} • {item.card_type}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-medium">{formatPrice(item.unit_price * (item.quantity ?? 1))}</p>
                  <p class="text-sm text-muted-foreground">
                    {item.quantity ?? 1} × {formatPrice(item.unit_price)}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        </Card.Content>
        <Card.Footer class="border-t bg-muted/50">
          <div class="flex w-full justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </Card.Footer>
      </Card.Root>
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Shipping Address -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-base">Shipping Address</Card.Title>
        </Card.Header>
        <Card.Content>
          <address class="text-sm not-italic text-muted-foreground">
            {data.order.shipping_name}<br />
            {data.order.shipping_line1}<br />
            {#if data.order.shipping_line2}
              {data.order.shipping_line2}<br />
            {/if}
            {data.order.shipping_city}, {data.order.shipping_state} {data.order.shipping_postal_code}<br />
            {data.order.shipping_country}
          </address>
        </Card.Content>
      </Card.Root>

      <!-- Payment -->
      {#if data.order.paypal_invoice_url}
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">Payment</Card.Title>
          </Card.Header>
          <Card.Content>
            {#if data.order.status === 'invoiced'}
              <Button href={data.order.paypal_invoice_url} target="_blank" class="w-full">
                <ExternalLink class="mr-2 h-4 w-4" />
                Pay Invoice
              </Button>
            {:else if data.order.paid_at}
              <div class="flex items-center gap-2 text-green-600">
                <Check class="h-4 w-4" />
                <span>Paid on {new Date(data.order.paid_at).toLocaleDateString()}</span>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      {/if}

      <!-- Tracking -->
      {#if data.order.tracking_number}
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-base">Tracking</Card.Title>
          </Card.Header>
          <Card.Content class="space-y-2">
            <div class="flex items-center gap-2 text-sm">
              <Truck class="h-4 w-4" />
              <span>{data.order.tracking_carrier || 'Carrier'}</span>
            </div>
            <p class="font-mono text-sm">{data.order.tracking_number}</p>
            <Button
              variant="outline"
              href={getTrackingUrl(data.order.tracking_number)}
              target="_blank"
              class="w-full"
            >
              <ExternalLink class="mr-2 h-4 w-4" />
              Track Package
            </Button>
          </Card.Content>
        </Card.Root>
      {:else if data.order.status === 'processing' || data.order.status === 'paid'}
        <div class="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
          <Package class="mx-auto mb-2 h-8 w-8" />
          <p class="text-sm">Tracking info will appear here once shipped</p>
        </div>
      {/if}
    </div>
  </div>
</div>
