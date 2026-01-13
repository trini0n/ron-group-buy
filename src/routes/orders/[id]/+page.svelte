<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import * as Tooltip from '$components/ui/tooltip';
  import { formatPrice, getTrackingUrl, getCardImageUrl, getCardPrice, getFinishLabel, getFrameEffectLabel } from '$lib/utils';
  import { ArrowLeft, Check, ExternalLink, Package, Truck } from 'lucide-svelte';
  import { Separator } from '$components/ui/separator';

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

  // Shipping pricing constants
  const SHIPPING_RATES = {
    us: { regular: 6.00, express: 40.00, tariff: 9.00 },
    international: { regular: 6.00, express: 25.00, tariff: 0 }
  };

  const order = $derived(data.order);

  // Calculate subtotal (cards only)
  const subtotal = $derived.by(() => order.order_items.reduce(
    (sum: number, item: any) => sum + item.unit_price * (item.quantity ?? 1),
    0
  ));

  // Calculate foil/non-foil breakdown
  const foilItems = $derived(
    order.order_items.filter((item: any) => item.card_type === 'Foil')
  );
  const nonFoilItems = $derived(
    order.order_items.filter((item: any) => item.card_type !== 'Foil')
  );
  const foilCount = $derived(
    foilItems.reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0)
  );
  const nonFoilCount = $derived(
    nonFoilItems.reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0)
  );
  const foilTotal = $derived(
    foilItems.reduce((sum: number, item: any) => sum + item.unit_price * (item.quantity ?? 1), 0)
  );
  const nonFoilTotal = $derived(
    nonFoilItems.reduce((sum: number, item: any) => sum + item.unit_price * (item.quantity ?? 1), 0)
  );
  const itemCount = $derived(
    order.order_items.reduce((sum: number, item: any) => sum + (item.quantity ?? 1), 0)
  );

  // Calculate shipping costs
  const isUSShipping = $derived(
    order.shipping_country?.toUpperCase() === 'US' ||
    order.shipping_country?.toUpperCase() === 'USA' ||
    order.shipping_country?.toUpperCase() === 'UNITED STATES'
  );
  const rates = $derived(isUSShipping ? SHIPPING_RATES.us : SHIPPING_RATES.international);
  const shippingCost = $derived(order.shipping_type === 'express' ? rates.express : rates.regular);
  const tariffCost = $derived(rates.tariff);
  const grandTotal = $derived(subtotal + shippingCost + tariffCost);
</script>

<svelte:head>
  <title>Order {data.order.order_number} - Group Buy</title>
</svelte:head>

<div class="container py-8">
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
        You'll receive an email with your PayPal invoice once the Group Buy has concluded.
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
        <Card.Header class="border-b py-3">
          <Card.Title>Order Items</Card.Title>
        </Card.Header>
        <Card.Content class="p-0">
          <div class="divide-y">
            {#each data.order.order_items as item (item.id)}
              {@const frameEffect = getFrameEffectLabel(item.card)}
              {@const finishLabel = getFinishLabel(item.card || { card_type: item.card_type })}
              <div class="flex items-center justify-between px-4 py-3">
                <div>
                  <Tooltip.Root delayDuration={100}>
                    <Tooltip.Trigger>
                      <span class="font-medium cursor-pointer hover:underline">{item.card_name}</span>
                    </Tooltip.Trigger>
                    <Tooltip.Content class="w-auto p-1 bg-transparent border-0 shadow-none" side="right">
                      <img 
                        src={getCardImageUrl(item.card?.ron_image_url ?? null, item.card?.scryfall_id ?? null, 'normal')}
                        alt={item.card_name}
                        class="w-48 rounded-lg shadow-xl"
                      />
                    </Tooltip.Content>
                  </Tooltip.Root>
                  <p class="text-sm text-muted-foreground">
                    {item.card?.set_code?.toUpperCase() || '???'} #{item.card?.collector_number || '?'}
                    {#if frameEffect}
                      • {frameEffect}
                    {/if}
                    • {finishLabel}
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
        <Card.Footer class="flex-col items-stretch border-t bg-muted/50 py-4">
          <div class="w-full space-y-2">
            <div class="flex justify-between text-sm font-medium">
              <span>Subtotal ({itemCount} cards)</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div class="ml-4 space-y-1">
              {#if nonFoilCount > 0}
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>Normal/Holo ({nonFoilCount} × $1.25)</span>
                  <span>{formatPrice(nonFoilTotal)}</span>
                </div>
              {/if}
              {#if foilCount > 0}
                <div class="flex justify-between text-xs text-muted-foreground">
                  <span>Foil ({foilCount} × $1.50)</span>
                  <span>{formatPrice(foilTotal)}</span>
                </div>
              {/if}
            </div>
            <div class="flex justify-between text-sm">
              <span class="flex items-center gap-1">
                {#if order.shipping_type === 'express'}
                  <Truck class="h-3.5 w-3.5" /> Express Shipping
                {:else}
                  <Package class="h-3.5 w-3.5" /> Regular Shipping
                {/if}
              </span>
              <span>{formatPrice(shippingCost)}</span>
            </div>
            {#if tariffCost > 0}
              <div class="flex justify-between text-sm">
                <span>Tariff (US)</span>
                <span>{formatPrice(tariffCost)}</span>
              </div>
            {/if}
            <Separator class="my-2" />
            <div class="flex justify-between font-bold">
              <span>Total</span>
              <span class="text-lg">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </Card.Footer>
      </Card.Root>
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Shipping Address -->
      <Card.Root>
        <Card.Header class="pb-3">
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
