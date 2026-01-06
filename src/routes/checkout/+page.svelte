<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { formatPrice, getCardPrice } from '$lib/utils';
  import { ArrowLeft, Check } from 'lucide-svelte';

  let { data } = $props();

  // Form state
  let selectedAddressId = $state<string | null>(
    data.addresses.find((a) => a.is_default)?.id || data.addresses[0]?.id || null
  );
  let useNewAddress = $state(data.addresses.length === 0);
  let isSubmitting = $state(false);

  // New address form
  let newAddress = $state({
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US'
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isSubmitting = true;

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: useNewAddress ? null : selectedAddressId,
          newAddress: useNewAddress ? newAddress : null,
          items: cartStore.items.map((item) => ({
            cardId: item.card.id,
            serial: item.card.serial,
            name: item.card.card_name,
            cardType: item.card.card_type,
            quantity: item.quantity,
            unitPrice: getCardPrice(item.card.card_type)
          }))
        })
      });

      if (response.ok) {
        const { orderId, orderNumber } = await response.json();
        cartStore.clear();
        window.location.href = `/orders/${orderId}?success=true`;
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (err) {
      alert('Failed to submit order. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Checkout - Group Buy</title>
</svelte:head>

<div class="container max-w-4xl py-8">
  <a href="/cart" class="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
    <ArrowLeft class="h-4 w-4" />
    Back to cart
  </a>

  <h1 class="mb-8 text-3xl font-bold">Checkout</h1>

  <form onsubmit={handleSubmit}>
    <div class="grid gap-8 lg:grid-cols-2">
      <!-- Shipping Address -->
      <div>
        <h2 class="mb-4 text-xl font-semibold">Shipping Address</h2>

        {#if data.addresses.length > 0}
          <div class="mb-4 space-y-2">
            {#each data.addresses as address (address.id)}
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent {selectedAddressId === address.id && !useNewAddress ? 'border-primary bg-accent' : ''}"
              >
                <input
                  type="radio"
                  name="address"
                  value={address.id}
                  checked={selectedAddressId === address.id && !useNewAddress}
                  onchange={() => {
                    selectedAddressId = address.id;
                    useNewAddress = false;
                  }}
                  class="mt-1"
                />
                <div>
                  <p class="font-medium">{address.name}</p>
                  <p class="text-sm text-muted-foreground">
                    {address.line1}
                    {#if address.line2}, {address.line2}{/if}
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {address.city}, {address.state} {address.postal_code}
                  </p>
                </div>
              </label>
            {/each}

            <button
              type="button"
              class="w-full rounded-lg border border-dashed p-4 text-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground {useNewAddress ? 'border-primary bg-accent text-foreground' : ''}"
              onclick={() => (useNewAddress = true)}
            >
              + Add new address
            </button>
          </div>
        {/if}

        {#if useNewAddress || data.addresses.length === 0}
          <div class="space-y-4 rounded-lg border p-4">
            <div>
              <Label for="name">Full Name</Label>
              <Input id="name" bind:value={newAddress.name} required />
            </div>
            <div>
              <Label for="line1">Address Line 1</Label>
              <Input id="line1" bind:value={newAddress.line1} required />
            </div>
            <div>
              <Label for="line2">Address Line 2 (Optional)</Label>
              <Input id="line2" bind:value={newAddress.line2} />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <Label for="city">City</Label>
                <Input id="city" bind:value={newAddress.city} required />
              </div>
              <div>
                <Label for="state">State</Label>
                <Input id="state" bind:value={newAddress.state} />
              </div>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <Label for="postal_code">Postal Code</Label>
                <Input id="postal_code" bind:value={newAddress.postal_code} required />
              </div>
              <div>
                <Label for="country">Country</Label>
                <Input id="country" bind:value={newAddress.country} required />
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Order Summary -->
      <div>
        <h2 class="mb-4 text-xl font-semibold">Order Summary</h2>

        <div class="rounded-lg border bg-card p-4">
          <div class="max-h-64 space-y-2 overflow-auto">
            {#each cartStore.items as item (item.card.serial)}
              {@const price = getCardPrice(item.card.card_type)}
              <div class="flex justify-between text-sm">
                <span class="truncate">
                  {item.card.card_name} × {item.quantity}
                </span>
                <span class="shrink-0">{formatPrice(price * item.quantity)}</span>
              </div>
            {/each}
          </div>

          <div class="my-4 border-t"></div>

          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span>Subtotal ({cartStore.itemCount} items)</span>
              <span>{formatPrice(cartStore.total)}</span>
            </div>
            <div class="flex justify-between text-sm text-muted-foreground">
              <span>Shipping</span>
              <span>To be calculated</span>
            </div>
          </div>

          <div class="my-4 border-t"></div>

          <div class="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(cartStore.total)}</span>
          </div>

          <p class="mt-2 text-xs text-muted-foreground">
            * A PayPal invoice will be sent with final shipping costs.
          </p>
        </div>

        <Button type="submit" class="mt-6 w-full" size="lg" disabled={isSubmitting}>
          {#if isSubmitting}
            Submitting...
          {:else}
            <Check class="mr-2 h-4 w-4" />
            Place Order
          {/if}
        </Button>
      </div>
    </div>
  </form>
</div>
