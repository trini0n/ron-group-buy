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
    ExternalLink,
    Key,
    Shield
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
  let paypalEmail = $state('');
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
    paypalEmail = data.profile?.paypal_email || '';
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

  // Auth methods validation - prevent account lockout
  const authMethods = $derived({
    hasGoogle: !!data.profile?.google_id,
    hasDiscord: !!data.profile?.discord_id,
    hasPassword: data.hasPassword ?? false,
    total: (data.profile?.google_id ? 1 : 0) + 
           (data.profile?.discord_id ? 1 : 0) + 
           (data.hasPassword ? 1 : 0)
  });

  const canDisconnect = $derived(authMethods.total > 1);

  // Password dialog
  let isPasswordDialogOpen = $state(false);
  let passwordMode = $state<'add' | 'change'>('add');
  let passwordForm = $state({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  let isSavingPassword = $state(false);

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
        body: JSON.stringify({ name, paypal_email: paypalEmail })
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

  // OAuth Management
  async function connectOAuth(provider: 'google' | 'discord') {
    try {
      const response = await fetch(`/api/profile/auth/${provider}`, {
        method: 'POST'
      });

      if (response.ok) {
        const { url } = await response.json();
        // Redirect to OAuth provider
        window.location.href = url;
      } else {
        const error = await response.json();
        toast.error(error.message || `Failed to connect ${provider}`);
      }
    } catch (err) {
      toast.error(`Failed to connect ${provider}`);
    }
  }

  async function disconnectOAuth(provider: 'google' | 'discord') {
    if (!canDisconnect) {
      toast.error('Cannot remove last authentication method');
      return;
    }

    if (!confirm(`Are you sure you want to disconnect your ${provider} account?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/profile/auth/${provider}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success(`${provider} account disconnected`);
        invalidateAll();
      } else {
        const error = await response.json();
        toast.error(error.message || `Failed to disconnect ${provider}`);
      }
    } catch (err) {
      toast.error(`Failed to disconnect ${provider}`);
    }
  }

  // Password Management
  function openPasswordDialog(mode: 'add' | 'change') {
    passwordMode = mode;
    passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    isPasswordDialogOpen = true;
  }

  async function savePassword() {
    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Validate password strength
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    isSavingPassword = true;
    try {
      const endpoint = '/api/profile/password';
      const method = passwordMode === 'add' ? 'POST' : 'PATCH';
      const body = passwordMode === 'add' 
        ? { password: passwordForm.newPassword }
        : { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast.success(passwordMode === 'add' ? 'Password added' : 'Password changed');
        isPasswordDialogOpen = false;
        invalidateAll();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save password');
      }
    } catch (err) {
      toast.error('Failed to save password');
    } finally {
      isSavingPassword = false;
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
          <div class="space-y-2">
            <Label for="paypal-email">PayPal Email Address</Label>
            <Input 
              id="paypal-email" 
              type="email"
              bind:value={paypalEmail}
              placeholder="your-paypal@example.com"
            />
            <p class="text-xs text-muted-foreground">
              Used for PayPal invoices. Leave blank if same as account email.
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

      <!-- Account Security -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Shield class="h-5 w-5" />
            Account Security
          </Card.Title>
          <Card.Description>
            Manage connected accounts and login methods
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          <!-- Connected Accounts -->
          <div>
            <h3 class="mb-3 text-sm font-medium">Connected Accounts</h3>
            <div class="space-y-2">
              <!-- Google Account -->
              <div class="flex items-center justify-between rounded-lg border p-3">
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    <svg class="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium">Google</p>
                    <p class="text-xs text-muted-foreground">
                      {authMethods.hasGoogle ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {#if authMethods.hasGoogle}
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!canDisconnect}
                    onclick={() => disconnectOAuth('google')}
                  >
                    Disconnect
                  </Button>
                {:else}
                  <Button 
                    variant="default" 
                    size="sm"
                    onclick={() => connectOAuth('google')}
                  >
                    Connect
                  </Button>
                {/if}
              </div>

              <!-- Discord Account -->
              <div class="flex items-center justify-between rounded-lg border p-3">
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium">Discord</p>
                    <p class="text-xs text-muted-foreground">
                      {authMethods.hasDiscord ? data.profile?.discord_username || 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {#if authMethods.hasDiscord}
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={!canDisconnect}
                    onclick={() => disconnectOAuth('discord')}
                  >
                    Disconnect
                  </Button>
                {:else}
                  <Button 
                    variant="default" 
                    size="sm"
                    onclick={() => connectOAuth('discord')}
                  >
                    Connect
                  </Button>
                {/if}
              </div>
            </div>
          </div>

          <Separator />

          <!-- Password Section -->
          <div>
            <h3 class="mb-3 text-sm font-medium">Password</h3>
            <div class="rounded-lg border p-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded bg-muted">
                    <Key class="h-4 w-4" />
                  </div>
                  <div>
                    <p class="text-sm font-medium">Password Login</p>
                    <p class="text-xs text-muted-foreground">
                      {authMethods.hasPassword ? 'Password is set  ' : 'No password set'}
                    </p>
                  </div>
                </div>
                <Button 
                  variant={authMethods.hasPassword ? 'outline' : 'default'}
                  size="sm"
                  onclick={() => openPasswordDialog(authMethods.hasPassword ? 'change' : 'add')}
                >
                  {authMethods.hasPassword ? 'Change' : 'Add'} Password
                </Button>
              </div>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              <strong>Note:</strong> Password management coming soon.
            </p>
          </div>

          <Separator />

          <!-- Account Status -->
          <div class="rounded-lg bg-muted p-3">
            <p class="text-sm font-medium">Login Methods: {authMethods.total}</p>
            <p class="text-xs text-muted-foreground mt-1">
              {#if authMethods.total === 1}
                You have 1 login method. Add another before disconnecting to prevent account lockout.
              {:else}
                You have {authMethods.total} login methods. You can safely disconnect one if needed.
              {/if}
            </p>
          </div>
        </Card.Content>
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

<!-- Password Dialog -->
<Dialog.Root bind:open={isPasswordDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{passwordMode === 'add' ? 'Add' : 'Change'} Password</Dialog.Title>
      <Dialog.Description>
        {passwordMode === 'add' 
          ? 'Add a password to enable email/password login.'
          : 'Change your current password. You will stay logged in.'}
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={(e) => { e.preventDefault(); savePassword(); }}>
      <div class="space-y-4 py-4">
        {#if passwordMode === 'change'}
          <div class="space-y-2">
            <Label for="current_password">Current Password</Label>
            <Input 
              id="current_password" 
              type="password"
              bind:value={passwordForm.currentPassword}
              required
              autocomplete="current-password"
            />
          </div>
        {/if}
        
        <div class="space-y-2">
          <Label for="new_password">New Password</Label>
          <Input 
            id="new_password" 
            type="password"
            bind:value={passwordForm.newPassword}
            required
            minlength="8"
            autocomplete="new-password"
          />
          <p class="text-xs text-muted-foreground">
            Must be at least 8 characters
          </p>
        </div>
        
        <div class="space-y-2">
          <Label for="confirm_password">Confirm New Password</Label>
          <Input 
            id="confirm_password" 
            type="password"
            bind:value={passwordForm.confirmPassword}
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => isPasswordDialogOpen = false}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSavingPassword}>
          {#if isSavingPassword}
            Saving...
          {:else}
            <Save class="mr-2 h-4 w-4" />
            {passwordMode === 'add' ? 'Add' : 'Change'} Password
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
