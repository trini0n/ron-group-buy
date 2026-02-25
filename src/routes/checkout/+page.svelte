<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import { Label } from '$components/ui/label';
  import * as Card from '$components/ui/card';
  import { Separator } from '$components/ui/separator';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { formatPrice, getCardPrice } from '$lib/utils';
  import { createSupabaseClient } from '$lib/supabase';
  import { browser } from '$app/environment';
  import { ArrowLeft, Check, AlertTriangle, Mail, Package, Truck, ChevronDown, ChevronUp } from 'lucide-svelte';


  let { data } = $props();

  // Shipping pricing constants
  const SHIPPING_RATES = {
    us: {
      regular: 6.00,
      express: 40.00,
      expressPerHalfKg: 8.00,
      tariff: 9.00
    },
    international: {
      regular: 6.00,
      express: 25.00,
      expressPerHalfKg: 5.00,
      tariff: 0
    }
  };

  // Email verification
  let isResendingVerification = $state(false);
  let verificationSent = $state(false);

  // Form state - use $derived for data-dependent values
  let selectedAddressId = $state<string | null>(null);
  let useNewAddress = $state(false);
  let isSubmitting = $state(false);
  let shippingType = $state<'regular' | 'express'>('regular');
  
  // Initialize from data
  $effect(() => {
    selectedAddressId = data.addresses.find((a) => a.is_default)?.id || data.addresses[0]?.id || null;
    useNewAddress = data.addresses.length === 0;
  });

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

  const COUNTRY_CODES: Record<string, string> = {
    'US': '+1', 'USA': '+1', 'UNITED STATES': '+1',
    'CA': '+1', 'CANADA': '+1',
    'GB': '+44', 'UK': '+44', 'UNITED KINGDOM': '+44',
    'AU': '+61', 'AUSTRALIA': '+61',
    'DE': '+49', 'GERMANY': '+49',
    'FR': '+33', 'FRANCE': '+33',
    'IT': '+39', 'ITALY': '+39',
    'ES': '+34', 'SPAIN': '+34',
    'NL': '+31', 'NETHERLANDS': '+31',
    'BR': '+55', 'BRAZIL': '+55',
    'MX': '+52', 'MEXICO': '+52',
    'JP': '+81', 'JAPAN': '+81',
    'CN': '+86', 'CHINA': '+86',
    'IN': '+91', 'INDIA': '+91',
    'SG': '+65', 'SINGAPORE': '+65',
    'MY': '+60', 'MALAYSIA': '+60',
    'ID': '+62', 'INDONESIA': '+62',
    'PH': '+63', 'PHILIPPINES': '+63',
    'TH': '+66', 'THAILAND': '+66',
    'VN': '+84', 'VIETNAM': '+84',
    'KR': '+82', 'SOUTH KOREA': '+82',
    'TW': '+886', 'TAIWAN': '+886',
    'HK': '+852', 'HONG KONG': '+852',
    'NZ': '+64', 'NEW ZEALAND': '+64',
    'CH': '+41', 'SWITZERLAND': '+41',
    'SE': '+46', 'SWEDEN': '+46',
    'NO': '+47', 'NORWAY': '+47',
    'DK': '+45', 'DENMARK': '+45',
    'FI': '+358', 'FINLAND': '+358',
    'IE': '+353', 'IRELAND': '+353',
    'PT': '+351', 'PORTUGAL': '+351',
    'AT': '+43', 'AUSTRIA': '+43',
    'BE': '+32', 'BELGIUM': '+32',
    'PL': '+48', 'POLAND': '+48',
    'CZ': '+420', 'CZECH REPUBLIC': '+420'
  };

  function getCountryCode(country: string): string {
    return COUNTRY_CODES[country.toUpperCase().trim()] || '';
  }

  // PayPal email and Phone Number
  let paypalEmail = $state('');
  let phoneNumber = $state('');
  
  let prevAddressId = $state<string | null>(null);
  let prevCountry = $state<string | null>(null);

  // Order note
  let orderNote = $state('');

  // Determine shipping location and calculate costs
  let selectedCountry = $derived.by(() => {
    if (useNewAddress) {
      return newAddress.country;
    }
    const selectedAddress = data.addresses.find((a: { id: string; country: string }) => a.id === selectedAddressId);
    return selectedAddress?.country || 'US';
  });

  // Effect for handling phone number and email updates
  $effect(() => {
    paypalEmail = data.userPaypalEmail || '';

    const currentCountry = selectedCountry;

    // If swapping to a different saved address
    if (!useNewAddress && selectedAddressId !== prevAddressId) {
      const selected = data.addresses.find((a: any) => a.id === selectedAddressId) as any;
      if (selected?.phone_number) {
        phoneNumber = selected.phone_number;
      } else {
        const code = getCountryCode(currentCountry);
        phoneNumber = code ? `${code} ` : '';
      }
      prevAddressId = selectedAddressId;
      prevCountry = currentCountry;
    } 
    // If country changed (e.g. typing in new address form) or switching to new address form
    else if (currentCountry !== prevCountry) {
      const code = getCountryCode(currentCountry);
      // Only auto-fill if empty or exactly matches another country code
      if (!phoneNumber || Object.values(COUNTRY_CODES).some(c => phoneNumber.trim() === c)) {
        phoneNumber = code ? `${code} ` : '';
      }
      prevCountry = currentCountry;
      if (useNewAddress) prevAddressId = null;
    }
  });

  let isUSShipping = $derived(
    selectedCountry.toUpperCase() === 'US' || 
    selectedCountry.toUpperCase() === 'USA' || 
    selectedCountry.toUpperCase() === 'UNITED STATES'
  );

  let rates = $derived(isUSShipping ? SHIPPING_RATES.us : SHIPPING_RATES.international);
  let shippingCost = $derived(shippingType === 'regular' ? rates.regular : rates.express);
  let tariffCost = $derived(rates.tariff);
  let estimatedTotal = $derived(cartStore.total + shippingCost + tariffCost);

  // Collapsible items state
  let showItems = $state(false);

  // Calculate foil and non-foil breakdown
  let foilItems = $derived(
    cartStore.items.filter(item => item.card.card_type === 'Foil')
  );
  let nonFoilItems = $derived(
    cartStore.items.filter(item => item.card.card_type !== 'Foil')
  );
  let foilCount = $derived(
    foilItems.reduce((sum, item) => sum + item.quantity, 0)
  );
  let nonFoilCount = $derived(
    nonFoilItems.reduce((sum, item) => sum + item.quantity, 0)
  );
  let foilTotal = $derived(
    foilItems.reduce((sum, item) => sum + getCardPrice(item.card.card_type) * item.quantity, 0)
  );
  let nonFoilTotal = $derived(
    nonFoilItems.reduce((sum, item) => sum + getCardPrice(item.card.card_type) * item.quantity, 0)
  );

  async function resendVerificationEmail() {
    if (!browser) return;
    
    isResendingVerification = true;
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: data.userEmail || ''
    });
    isResendingVerification = false;
    if (!error) {
      verificationSent = true;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!data.isEmailVerified) {
      alert('Please verify your email address before placing an order.');
      return;
    }
    
    if (!phoneNumber || !phoneNumber.trim()) {
      alert('Please provide a phone number. This is required for delivery.');
      return;
    }
    
    isSubmitting = true;

    try {
      // Validate cart before submitting order
      const validation = await cartStore.validate();
      if (validation) {
        const hasInvalidItems = validation.invalid_items?.length > 0;
        const hasPriceChanges = validation.price_changes?.length > 0;
        
        if (hasInvalidItems) {
          alert('Some items in your cart are no longer available. Please review your cart.');
          isSubmitting = false;
          return;
        }
        
        if (hasPriceChanges) {
          const confirm = window.confirm(
            'Some prices have changed since you added items to your cart. Continue with checkout?'
          );
          if (!confirm) {
            isSubmitting = false;
            return;
          }
        }
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId: useNewAddress ? null : selectedAddressId,
          newAddress: useNewAddress ? newAddress : null,
          shippingType,
          cartId: cartStore.cartId,
          cartVersion: cartStore.version,
          action: data.existingPendingOrder ? 'merge' : null, // Auto-merge if existing order
          paypalEmail: paypalEmail.trim() || null,
          phoneNumber: phoneNumber.trim(),
          notes: orderNote.trim() || null,
          items: cartStore.items.map((item) => ({
            cardId: item.card.id,
            serial: item.card.serial,
            name: item.card.card_name,
            cardType: item.card.card_type,
            quantity: item.quantity,
            unitPrice: getCardPrice(item.card.card_type),
            // Identity fields for stable matching across inventory resyncs
            setCode: item.card.set_code,
            collectorNumber: item.card.collector_number,
            isFoil: item.card.is_foil,
            isEtched: item.card.is_etched,
            language: item.card.language || 'en'
          }))
        })
      });

      const result = await response.json();

      if (response.ok) {
        // Clear cart and wait for it to complete before redirecting
        await cartStore.clear();
        window.location.href = `/orders/${result.orderId}?success=true`;
      } else {
        alert(`Error: ${result.message}`);
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

  <!-- Email Verification Warning -->
  {#if !data.isEmailVerified}
    <div class="mb-6 rounded-lg border border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-900/20">
      <div class="flex items-start gap-3">
        <AlertTriangle class="mt-0.5 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <div class="flex-1">
          <h3 class="font-medium text-yellow-800 dark:text-yellow-300">Email Verification Required</h3>
          <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
            Please verify your email address ({data.userEmail}) before placing an order.
            Check your inbox for the verification link.
          </p>
          {#if verificationSent}
            <p class="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check class="h-4 w-4" />
              Verification email sent! Check your inbox.
            </p>
          {:else}
            <Button 
              variant="outline" 
              size="sm" 
              class="mt-2" 
              onclick={resendVerificationEmail}
              disabled={isResendingVerification}
            >
              <Mail class="mr-2 h-4 w-4" />
              {isResendingVerification ? 'Sending...' : 'Resend Verification Email'}
            </Button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

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
                <Label for="state">State / Province / Region</Label>
                <Input id="state" bind:value={newAddress.state} placeholder="Optional" />
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

      <!-- Shipping Type Selection -->
      <div class="lg:col-span-2">
        <h2 class="mb-4 text-xl font-semibold">Shipping Method</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent {shippingType === 'regular' ? 'border-primary bg-accent' : ''}"
          >
            <input
              type="radio"
              name="shippingType"
              value="regular"
              checked={shippingType === 'regular'}
              onchange={() => shippingType = 'regular'}
              class="mt-1"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <Package class="h-4 w-4" />
                <span class="font-medium">Regular Shipping</span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                Standard delivery
              </p>
              <p class="mt-2 font-semibold">{formatPrice(rates.regular)}</p>
            </div>
          </label>

          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent {shippingType === 'express' ? 'border-primary bg-accent' : ''}"
          >
            <input
              type="radio"
              name="shippingType"
              value="express"
              checked={shippingType === 'express'}
              onchange={() => shippingType = 'express'}
              class="mt-1"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <Truck class="h-4 w-4" />
                <span class="font-medium">Express Shipping</span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                Faster delivery (+{formatPrice(rates.expressPerHalfKg)}/0.5kg over 0.5kg)
              </p>
              <p class="mt-2 font-semibold">{formatPrice(rates.express)}</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Contact Information -->
      <div class="lg:col-span-2">
        <h2 class="mb-4 text-xl font-semibold">Contact & Payment Information</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="paypal-email">PayPal Email Address</Label>
            <Input 
              id="paypal-email" 
              type="email"
              placeholder="your-email@example.com"
              bind:value={paypalEmail}
            />
            <p class="text-xs text-muted-foreground">
              We'll send your PayPal invoice to this address.
            </p>
          </div>
          <div class="space-y-2">
            <Label for="phone-number">Phone Number <span class="text-red-500">*</span></Label>
            <Input 
              id="phone-number" 
              type="tel"
              placeholder="+1 (555) 000-0000"
              required
              bind:value={phoneNumber}
            />
            <p class="text-xs text-muted-foreground">
              Required by forwarders for international delivery.
            </p>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          These details will be saved to your profile for future orders.
        </p>
      </div>

      <!-- Order Notes -->
      <div class="lg:col-span-2">
        <h2 class="mb-4 text-xl font-semibold">Order Notes (Optional)</h2>
        <div class="space-y-2">
          <Label for="order-note">Add a note to your order</Label>
          <Textarea 
            id="order-note" 
            placeholder="Special instructions, questions, or notes for your order (optional)"
            bind:value={orderNote}
            class="min-h-[100px]"
          />
          <p class="text-xs text-muted-foreground">
            This note will be visible to the seller and attached to your order.
          </p>
        </div>
      </div>

      <!-- Order Summary -->
      <div class="lg:col-span-2">
        <h2 class="mb-4 text-xl font-semibold">Order Summary</h2>

        <Card.Root>
          <Card.Content class="pt-6">
            <!-- Collapsible Items Section -->
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              onclick={() => showItems = !showItems}
            >
              <span class="font-medium">{cartStore.itemCount} items in cart</span>
              {#if showItems}
                <ChevronUp class="h-5 w-5 text-muted-foreground" />
              {:else}
                <ChevronDown class="h-5 w-5 text-muted-foreground" />
              {/if}
            </button>

            {#if showItems}
              <div class="mt-3 max-h-64 space-y-2 overflow-auto rounded-lg bg-muted/50 p-3">
                {#each cartStore.items as item (item.id)}
                  {@const price = getCardPrice(item.card.card_type)}
                  <div class="flex justify-between text-sm">
                    <span class="truncate pr-2">
                      {item.card.card_name} × {item.quantity}
                      <span class="text-muted-foreground">({item.card.card_type})</span>
                    </span>
                    <span class="shrink-0">{formatPrice(price * item.quantity)}</span>
                  </div>
                {/each}
              </div>
            {/if}

            <Separator class="my-4" />

            <!-- Subtotal Breakdown -->
            <div class="space-y-2">
              <div class="flex justify-between text-sm font-medium">
                <span>Subtotal ({cartStore.itemCount} cards)</span>
                <span>{formatPrice(cartStore.total)}</span>
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
                <span>Shipping ({shippingType === 'regular' ? 'Regular' : 'Express'})</span>
                <span>{formatPrice(shippingCost)}</span>
              </div>
              {#if tariffCost > 0}
                <div class="flex justify-between text-sm">
                  <span>Tariff (US orders)</span>
                  <span>{formatPrice(tariffCost)}</span>
                </div>
              {/if}
            </div>

            <Separator class="my-4" />

            <div class="flex justify-between text-lg font-bold">
              <span>Estimated Total</span>
              <span>{formatPrice(estimatedTotal)}</span>
            </div>

            <p class="mt-2 text-xs text-muted-foreground">
              * Final invoice may include additional weight-based shipping charges for Express orders.
            </p>
          </Card.Content>
        </Card.Root>

        <Button type="submit" class="mt-6 w-full" size="lg" disabled={isSubmitting || !data.isEmailVerified}>
          {#if isSubmitting}
            Submitting...
          {:else if !data.isEmailVerified}
            <AlertTriangle class="mr-2 h-4 w-4" />
            Verify Email to Order
          {:else}
            <Check class="mr-2 h-4 w-4" />
            Place Order
          {/if}
        </Button>
      </div>
    </div>
  </form>
</div>
