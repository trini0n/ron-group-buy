<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Badge } from '$components/ui/badge';
  import { Switch } from '$components/ui/switch';
  import * as Card from '$components/ui/card';
  import * as Dialog from '$components/ui/dialog';
  import * as Avatar from '$components/ui/avatar';
  import { Separator } from '$components/ui/separator';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import {
    User,
    Mail,
    MapPin,
    Bell,
    ShoppingBag,
    Edit,
    Trash2,
    Plus,
    Save,
    Check,
    ExternalLink
  } from 'lucide-svelte';

  interface Address {
    id: string;
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postal_code: string;
    country: string;
    is_default: boolean | null;
  }

  let { data } = $props();

  // Profile state
  let name = $state('');
  let isSavingProfile = $state(false);

  // Notification preferences
  let emailOrderConfirmed = $state(true);
  let emailInvoiceSent = $state(true);
  let emailPaymentReceived = $state(true);
  let emailOrderShipped = $state(true);
  let discordOrderShipped = $state(true);
  let discordPaymentReminder = $state(true);
  let isSavingNotifications = $state(false);

  // Initialize state from data
  $effect(() => {
    name = data.profile?.name || '';
    emailOrderConfirmed = data.notifications?.email_order_confirmed ?? true;
    emailInvoiceSent = data.notifications?.email_invoice_sent ?? true;
    emailPaymentReceived = data.notifications?.email_payment_received ?? true;
    emailOrderShipped = data.notifications?.email_order_shipped ?? true;
    discordOrderShipped = data.notifications?.discord_order_shipped ?? true;
    discordPaymentReminder = data.notifications?.discord_payment_reminder ?? true;
  });

  // Address dialog
  let isAddressDialogOpen = $state(false);
  let editingAddress = $state<Address | null>(null);
  let addressForm = $state({
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    is_default: false
  });
  let isSavingAddress = $state(false);

  function getInitials(name: string | null, email: string): string {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  }

  async function saveProfile() {
    isSavingProfile = true;
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (response.ok) {
        toast.success('Profile updated');
        invalidateAll();
      } else {
        toast.error('Failed to update profile');
      }
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      isSavingProfile = false;
    }
  }

  async function saveNotifications() {
    isSavingNotifications = true;
    try {
      const response = await fetch('/api/profile/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_order_confirmed: emailOrderConfirmed,
          email_invoice_sent: emailInvoiceSent,
          email_payment_received: emailPaymentReceived,
          email_order_shipped: emailOrderShipped,
          discord_order_shipped: discordOrderShipped,
          discord_payment_reminder: discordPaymentReminder
        })
      });

      if (response.ok) {
        toast.success('Notification preferences saved');
        invalidateAll();
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      isSavingNotifications = false;
    }
  }

  function openAddressDialog(address?: Address) {
    if (address) {
      editingAddress = address;
      addressForm = {
        name: address.name,
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state || '',
        postal_code: address.postal_code,
        country: address.country,
        is_default: address.is_default ?? false
      };
    } else {
      editingAddress = null;
      addressForm = {
        name: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        is_default: data.addresses.length === 0
      };
    }
    isAddressDialogOpen = true;
  }

  async function saveAddress() {
    isSavingAddress = true;
    try {
      const url = editingAddress
        ? `/api/profile/addresses/${editingAddress.id}`
        : '/api/profile/addresses';

      const response = await fetch(url, {
        method: editingAddress ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm)
      });

      if (response.ok) {
        toast.success(editingAddress ? 'Address updated' : 'Address added');
        isAddressDialogOpen = false;
        invalidateAll();
      } else {
        toast.error('Failed to save address');
      }
    } catch (err) {
      toast.error('Failed to save address');
    } finally {
      isSavingAddress = false;
    }
  }

  async function deleteAddress(address: Address) {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const response = await fetch(`/api/profile/addresses/${address.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Address deleted');
        invalidateAll();
      } else {
        toast.error('Failed to delete address');
      }
    } catch (err) {
      toast.error('Failed to delete address');
    }
  }

  async function setDefaultAddress(address: Address) {
    try {
      const response = await fetch(`/api/profile/addresses/${address.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true })
      });

      if (response.ok) {
        toast.success('Default address updated');
        invalidateAll();
      } else {
        toast.error('Failed to update default address');
      }
    } catch (err) {
      toast.error('Failed to update default address');
    }
  }
</script>

<svelte:head>
  <title>Profile - Group Buy</title>
</svelte:head>

<div class="container max-w-4xl py-8">
  <h1 class="mb-8 text-3xl font-bold">Profile</h1>

  <div class="grid gap-8 lg:grid-cols-3">
    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- User Card -->
      <Card.Root>
        <Card.Content class="flex flex-col items-center pt-6">
          <Avatar.Root class="h-20 w-20">
            <Avatar.Image src={data.profile?.avatar_url} alt={data.profile?.name || 'User'} />
            <Avatar.Fallback class="text-2xl">
              {getInitials(data.profile?.name ?? null, data.authUser.email || '')}
            </Avatar.Fallback>
          </Avatar.Root>
          <h2 class="mt-4 text-xl font-semibold">{data.profile?.name || 'User'}</h2>
          <p class="text-sm text-muted-foreground">{data.authUser.email}</p>
          
          {#if data.profile?.discord_username}
            <div class="mt-2 flex items-center gap-1 text-sm">
              <Badge variant="outline" class="flex items-center gap-1">
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                {data.profile.discord_username}
              </Badge>
            </div>
          {/if}

          <Separator class="my-4 w-full" />

          <div class="flex w-full justify-around text-center">
            <div>
              <p class="text-2xl font-bold">{data.orderCount}</p>
              <p class="text-xs text-muted-foreground">Orders</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{data.addresses.length}</p>
              <p class="text-xs text-muted-foreground">Addresses</p>
            </div>
          </div>
        </Card.Content>
        <Card.Footer>
          <Button variant="outline" class="w-full" href="/orders">
            <ShoppingBag class="mr-2 h-4 w-4" />
            View Orders
          </Button>
        </Card.Footer>
      </Card.Root>
    </div>

    <!-- Main Content -->
    <div class="space-y-6 lg:col-span-2">
      <!-- Profile Settings -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <User class="h-5 w-5" />
            Profile Settings
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Display Name</Label>
            <Input id="name" bind:value={name} placeholder="Your name" />
          </div>
          <div class="space-y-2">
            <Label>Email</Label>
            <Input value={data.authUser.email} disabled />
            <p class="text-xs text-muted-foreground">
              Email cannot be changed. Sign in with a different account to use a different email.
            </p>
          </div>
        </Card.Content>
        <Card.Footer>
          <Button onclick={saveProfile} disabled={isSavingProfile}>
            {#if isSavingProfile}
              Saving...
            {:else}
              <Save class="mr-2 h-4 w-4" />
              Save Profile
            {/if}
          </Button>
        </Card.Footer>
      </Card.Root>

      <!-- Saved Addresses -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center justify-between">
            <Card.Title class="flex items-center gap-2">
              <MapPin class="h-5 w-5" />
              Saved Addresses
            </Card.Title>
            <Button size="sm" onclick={() => openAddressDialog()}>
              <Plus class="mr-2 h-4 w-4" />
              Add Address
            </Button>
          </div>
        </Card.Header>
        <Card.Content>
          {#if data.addresses.length === 0}
            <p class="text-center text-sm text-muted-foreground py-4">
              No saved addresses yet
            </p>
          {:else}
            <div class="space-y-4">
              {#each data.addresses as address (address.id)}
                <div class="flex items-start justify-between rounded-lg border p-4">
                  <div>
                    {#if address.is_default}
                      <Badge variant="outline" class="mb-2">Default</Badge>
                    {/if}
                    <address class="not-italic text-sm">
                      <p class="font-medium">{address.name}</p>
                      <p>{address.line1}</p>
                      {#if address.line2}
                        <p>{address.line2}</p>
                      {/if}
                      <p>{address.city}, {address.state} {address.postal_code}</p>
                      <p>{address.country}</p>
                    </address>
                  </div>
                  <div class="flex gap-1">
                    {#if !address.is_default}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onclick={() => setDefaultAddress(address)}
                      >
                        <Check class="h-4 w-4" />
                      </Button>
                    {/if}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onclick={() => openAddressDialog(address)}
                    >
                      <Edit class="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onclick={() => deleteAddress(address)}
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Notification Preferences -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Bell class="h-5 w-5" />
            Notification Preferences
            <Badge variant="secondary">Coming Soon</Badge>
          </Card.Title>
          <Card.Description>
            Notification preferences for email and Discord will be available soon
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Bell class="h-12 w-12 mb-4 opacity-30" />
            <p class="text-sm">
              We're working on notification preferences. Soon you'll be able to customize
              how you receive updates about your orders via email and Discord.
            </p>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<!-- Address Dialog -->
<Dialog.Root bind:open={isAddressDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{editingAddress ? 'Edit' : 'Add'} Address</Dialog.Title>
    </Dialog.Header>

    <form onsubmit={(e) => { e.preventDefault(); saveAddress(); }}>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="addr_name">Full Name</Label>
          <Input id="addr_name" bind:value={addressForm.name} required />
        </div>
        <div class="space-y-2">
          <Label for="addr_line1">Address Line 1</Label>
          <Input id="addr_line1" bind:value={addressForm.line1} required />
        </div>
        <div class="space-y-2">
          <Label for="addr_line2">Address Line 2 (Optional)</Label>
          <Input id="addr_line2" bind:value={addressForm.line2} />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="addr_city">City</Label>
            <Input id="addr_city" bind:value={addressForm.city} required />
          </div>
          <div class="space-y-2">
            <Label for="addr_state">State</Label>
            <Input id="addr_state" bind:value={addressForm.state} />
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="addr_postal">Postal Code</Label>
            <Input id="addr_postal" bind:value={addressForm.postal_code} required />
          </div>
          <div class="space-y-2">
            <Label for="addr_country">Country</Label>
            <Input id="addr_country" bind:value={addressForm.country} required />
          </div>
        </div>
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={addressForm.is_default} />
          <span class="text-sm">Set as default address</span>
        </label>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => isAddressDialogOpen = false}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSavingAddress}>
          {#if isSavingAddress}
            Saving...
          {:else}
            <Save class="mr-2 h-4 w-4" />
            Save Address
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
