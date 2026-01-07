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
            <div>
              <dt class="text-sm text-muted-foreground">Discord ID</dt>
              <dd class="font-mono text-sm">{user.discord_id || '—'}</dd>
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
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Email notifications</dt>
              <dd>{user.email_notifications ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Discord notifications</dt>
              <dd>{user.discord_notifications ? 'Enabled' : 'Disabled'}</dd>
            </div>
          </dl>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>
