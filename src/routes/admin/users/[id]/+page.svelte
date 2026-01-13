<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Textarea } from '$components/ui/textarea';
  import { Badge } from '$components/ui/badge';
  import { Checkbox } from '$components/ui/checkbox';
  import { Label } from '$components/ui/label';
  import * as Card from '$components/ui/card';
  import * as Table from '$components/ui/table';
  import * as Avatar from '$components/ui/avatar';
  import { Separator } from '$components/ui/separator';
  import { ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/admin-shared';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { 
    ArrowLeft, 
    Save, 
    ShoppingBag, 
    MapPin, 
    Mail,
    MessageSquare,
    ShieldAlert,
    ExternalLink
  } from 'lucide-svelte';

  let { data } = $props();

  // Use $derived for reactive user reference
  const user = $derived(data.user);

  // Editable fields - use $effect to reset when data changes
  let adminNotes = $state('');
  let isBlocked = $state(false);
  let blockedReason = $state('');
  
  $effect(() => {
    adminNotes = (data.user as any).admin_notes || '';
    isBlocked = (data.user as any).is_blocked || false;
    blockedReason = (data.user as any).blocked_reason || '';
  });

  let isSaving = $state(false);

  function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatPrice(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function getInitials(name: string | null, email: string): string {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  }

  async function saveUserDetails() {
    isSaving = true;
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_notes: adminNotes || null,
          is_blocked: isBlocked,
          blocked_reason: isBlocked ? blockedReason : null
        })
      });

      if (response.ok) {
        toast.success('User updated successfully');
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to update user');
      }
    } catch (err) {
      toast.error('Failed to update user');
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="p-8">
  <!-- Header -->
  <div class="mb-6 flex items-center gap-4">
    <Button variant="ghost" size="icon" href="/admin/users">
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <Avatar.Root class="h-12 w-12">
      <Avatar.Image src={user.avatar_url} alt={user.name || user.email} />
      <Avatar.Fallback>{getInitials(user.name, user.email)}</Avatar.Fallback>
    </Avatar.Root>
    <div class="flex-1">
      <h1 class="text-2xl font-bold">{user.name || 'Unnamed User'}</h1>
      <p class="text-sm text-muted-foreground">{user.email}</p>
    </div>
    {#if isBlocked}
      <Badge variant="destructive" class="flex items-center gap-1">
        <ShieldAlert class="h-3 w-3" />
        Blocked
      </Badge>
    {/if}
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-6">
      <!-- User Info -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Account Information</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl class="grid gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-muted-foreground">Email</dt>
              <dd class="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted-foreground">Discord</dt>
              <dd class="font-medium">{user.discord_username || '—'}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-sm text-muted-foreground mb-2">Authentication Methods</dt>
              <dd class="flex flex-wrap gap-2">
                {#if user.google_id}
                  <Badge variant="outline" class="flex items-center gap-1">
                    <svg class="h-3 w-3" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google OAuth
                  </Badge>
                {/if}
                {#if user.discord_id}
                  <Badge variant="outline" class="flex items-center gap-1">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                    </svg>
                    Discord OAuth
                  </Badge>
                {/if}
                {#if !user.google_id && !user.discord_id}
                  <Badge variant="outline">Email/Password</Badge>
                {/if}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-muted-foreground">PayPal Email</dt>
              <dd class="font-medium">{user.paypal_email || user.email}</dd>
            </div>
            <div>
              <dt class="text-sm text-muted-foreground">Joined</dt>
              <dd class="font-medium">{formatDate(user.created_at)}</dd>
            </div>
          </dl>
        </Card.Content>
      </Card.Root>

      <!-- Recent Orders -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <ShoppingBag class="h-5 w-5" />
            Recent Orders
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {#if data.orders.length > 0}
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Order #</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head class="text-right">Total</Table.Head>
                  <Table.Head>Date</Table.Head>
                  <Table.Head></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each data.orders as order}
                  {@const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus]}
                  <Table.Row>
                    <Table.Cell class="font-mono">{order.order_number}</Table.Cell>
                    <Table.Cell>
                      <Badge class={statusConfig?.color}>
                        {statusConfig?.label || order.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell class="text-right font-medium">
                      {formatPrice(order.total)}
                    </Table.Cell>
                    <Table.Cell class="text-sm text-muted-foreground">
                      {formatDate(order.created_at)}
                    </Table.Cell>
                    <Table.Cell>
                      <Button variant="ghost" size="sm" href="/admin/orders/{order.id}">
                        <ExternalLink class="h-4 w-4" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          {:else}
            <p class="text-sm text-muted-foreground">No orders yet</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Saved Addresses -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <MapPin class="h-5 w-5" />
            Saved Addresses
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {#if data.addresses.length > 0}
            <div class="grid gap-4 sm:grid-cols-2">
              {#each data.addresses as address}
                <div class="rounded-lg border p-4">
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
              {/each}
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">No saved addresses</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Block User -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <ShieldAlert class="h-5 w-5" />
            Account Status
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <Checkbox 
              checked={isBlocked}
              onCheckedChange={(v) => isBlocked = !!v}
            />
            <span>Block this user</span>
          </label>
          
          {#if isBlocked}
            <div class="space-y-2">
              <Label>Reason for blocking</Label>
              <Textarea
                placeholder="Enter reason..."
                bind:value={blockedReason}
              />
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Admin Notes -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <MessageSquare class="h-5 w-5" />
            Admin Notes
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <Textarea 
            placeholder="Internal notes about this user..."
            rows={4}
            bind:value={adminNotes}
          />
          <Button onclick={saveUserDetails} disabled={isSaving} class="w-full">
            <Save class="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Card.Content>
      </Card.Root>

      <!-- Notification Preferences -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Mail class="h-5 w-5" />
            Notifications
            <Badge variant="secondary">Coming Soon</Badge>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            Notification preferences are not yet available.
          </p>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
