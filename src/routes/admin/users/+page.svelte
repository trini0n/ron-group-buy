<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { Switch } from '$components/ui/switch';
  import { Textarea } from '$components/ui/textarea';
  import { Checkbox } from '$components/ui/checkbox';
  import { Label } from '$components/ui/label';
  import * as Table from '$components/ui/table';
  import * as Avatar from '$components/ui/avatar';
  import * as Tooltip from '$components/ui/tooltip';
  import * as Dialog from '$components/ui/dialog';
  import * as Card from '$components/ui/card';
  import { ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/admin-shared';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Search, ChevronLeft, ChevronRight, ExternalLink, ShieldAlert, ShoppingBag, Shield, Crown, Eye, MapPin, Mail, MessageSquare, Save, Loader2 } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  let togglingAdminFor = $state<string | null>(null);
  
  // Dialog state
  let dialogOpen = $state(false);
  let selectedUser = $state<any>(null);
  let userOrders = $state<any[]>([]);
  let userAddresses = $state<any[]>([]);
  let loadingUserDetails = $state(false);
  
  // Editable fields for selected user
  let adminNotes = $state('');
  let isBlocked = $state(false);
  let blockedReason = $state('');
  let isSaving = $state(false);
  
  // Initialize searchInput when data changes
  $effect(() => {
    searchInput = data.searchQuery || '';
  });

  // Use $derived for computed values that depend on data
  const totalPages = $derived(Math.ceil(data.totalCount / data.perPage));

  function applyFilters() {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    params.set('page', '1');
    goto(`/admin/users?${params.toString()}`);
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    params.set('page', newPage.toString());
    goto(`/admin/users?${params.toString()}`);
  }

  function clearFilters() {
    searchInput = '';
    goto('/admin/users');
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getInitials(name: string | null, email: string): string {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  }

  async function toggleAdmin(userId: string, currentlyAdmin: boolean) {
    togglingAdminFor = userId;
    try {
      const response = await fetch(`/api/admin/users/${userId}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentlyAdmin })
      });

      if (response.ok) {
        toast.success(currentlyAdmin ? 'Admin access removed' : 'Admin access granted');
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to update admin status');
      }
    } catch (err) {
      toast.error('Failed to update admin status');
    } finally {
      togglingAdminFor = null;
    }
  }

  async function openUserDetails(user: any) {
    selectedUser = user;
    dialogOpen = true;
    loadingUserDetails = true;
    
    // Reset editable fields
    adminNotes = user.admin_notes || '';
    isBlocked = user.is_blocked || false;
    blockedReason = user.blocked_reason || '';
    userOrders = [];
    userAddresses = [];
    
    try {
      const response = await fetch(`/api/admin/users/${user.id}/details`);
      if (response.ok) {
        const details = await response.json();
        userOrders = details.orders || [];
        userAddresses = details.addresses || [];
        // Update editable fields from fresh data
        adminNotes = details.user.admin_notes || '';
        isBlocked = details.user.is_blocked || false;
        blockedReason = details.user.blocked_reason || '';
        selectedUser = { ...user, ...details.user };
      } else {
        toast.error('Failed to load user details');
      }
    } catch (err) {
      toast.error('Failed to load user details');
    } finally {
      loadingUserDetails = false;
    }
  }

  async function saveUserDetails() {
    if (!selectedUser) return;
    isSaving = true;
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
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

  function formatPrice(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatDateFull(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">Users</h1>
    <p class="text-muted-foreground">Manage registered users</p>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap items-center gap-4">
    <div class="relative flex-1 min-w-[200px] max-w-sm">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search by name, email, or Discord..."
        class="pl-10"
        bind:value={searchInput}
        onkeydown={(e) => e.key === 'Enter' && applyFilters()}
      />
    </div>

    <Button variant="outline" onclick={applyFilters}>Search</Button>
    
    {#if data.searchQuery}
      <Button variant="ghost" onclick={clearFilters}>Clear</Button>
    {/if}
  </div>

  <!-- Results count -->
  <p class="mb-4 text-sm text-muted-foreground">
    Showing {data.users.length} of {data.totalCount} users
  </p>

  <!-- Users Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>User</Table.Head>
          <Table.Head>Discord</Table.Head>
          <Table.Head class="text-right">Orders</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Admin</Table.Head>
          <Table.Head>Joined</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each data.users as user}
          <Table.Row>
            <Table.Cell>
              <div class="flex items-center gap-3">
                <Avatar.Root class="h-8 w-8">
                  <Avatar.Image src={user.avatar_url} alt={user.name || user.email} />
                  <Avatar.Fallback>{getInitials(user.name, user.email)}</Avatar.Fallback>
                </Avatar.Root>
                <div>
                  <p class="font-medium">{user.name || 'No name'}</p>
                  <p class="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </Table.Cell>
            <Table.Cell>
              {#if user.discord_username}
                <span class="text-sm">{user.discord_username}</span>
              {:else}
                <span class="text-sm text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <ShoppingBag class="h-4 w-4 text-muted-foreground" />
                <span>{user.orderCount}</span>
              </div>
            </Table.Cell>
            <Table.Cell>
              {#if (user as any).is_blocked}
                <Badge variant="destructive" class="flex items-center gap-1 w-fit">
                  <ShieldAlert class="h-3 w-3" />
                  Blocked
                </Badge>
              {:else}
                <Badge variant="outline">Active</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if user.adminRole === 'super_admin'}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <Badge class="flex items-center gap-1 bg-amber-500 text-white">
                      <Crown class="h-3 w-3" />
                      Super
                    </Badge>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    <p>Super Admin (cannot be changed)</p>
                  </Tooltip.Content>
                </Tooltip.Root>
              {:else if user.discord_id}
                <div class="flex items-center gap-2">
                  <Switch 
                    checked={user.isAdmin}
                    disabled={togglingAdminFor === user.id}
                    onCheckedChange={() => toggleAdmin(user.id, user.isAdmin)}
                  />
                  {#if user.isAdmin}
                    <Shield class="h-4 w-4 text-primary" />
                  {/if}
                </div>
              {:else}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <span class="text-xs text-muted-foreground">No Discord</span>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    <p>User must link Discord to become admin</p>
                  </Tooltip.Content>
                </Tooltip.Root>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-sm text-muted-foreground">
              {formatDate(user.created_at)}
            </Table.Cell>
            <Table.Cell>
              <Button variant="ghost" size="sm" onclick={() => openUserDetails(user)}>
                <Eye class="h-4 w-4" />
              </Button>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={7} class="py-8 text-center text-muted-foreground">
              No users found
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-4 flex items-center justify-between">
      <p class="text-sm text-muted-foreground">
        Page {data.page} of {totalPages}
      </p>
      <div class="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          disabled={data.page <= 1}
          onclick={() => changePage(data.page - 1)}
        >
          <ChevronLeft class="h-4 w-4" />
          Previous
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={data.page >= totalPages}
          onclick={() => changePage(data.page + 1)}
        >
          Next
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  {/if}
</div>

<!-- User Details Dialog -->
<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content class="max-w-4xl max-h-[90vh] overflow-y-auto">
    {#if selectedUser}
      <Dialog.Header>
        <div class="flex items-center gap-4">
          <Avatar.Root class="h-12 w-12">
            <Avatar.Image src={selectedUser.avatar_url} alt={selectedUser.name || selectedUser.email} />
            <Avatar.Fallback>{getInitials(selectedUser.name, selectedUser.email)}</Avatar.Fallback>
          </Avatar.Root>
          <div class="flex-1">
            <Dialog.Title>{selectedUser.name || 'Unnamed User'}</Dialog.Title>
            <Dialog.Description>{selectedUser.email}</Dialog.Description>
          </div>
          {#if isBlocked}
            <Badge variant="destructive" class="flex items-center gap-1">
              <ShieldAlert class="h-3 w-3" />
              Blocked
            </Badge>
          {/if}
        </div>
      </Dialog.Header>

      {#if loadingUserDetails}
        <div class="flex items-center justify-center py-12">
          <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      {:else}
        <div class="grid gap-6 lg:grid-cols-3 mt-6">
          <!-- Main Content -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Account Info -->
            <Card.Root>
              <Card.Header class="pb-3">
                <Card.Title class="text-base">Account Information</Card.Title>
              </Card.Header>
              <Card.Content>
                <dl class="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt class="text-muted-foreground">Email</dt>
                    <dd class="font-medium">{selectedUser.email}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Discord</dt>
                    <dd class="font-medium">{selectedUser.discord_username || '—'}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Discord ID</dt>
                    <dd class="font-mono text-xs">{selectedUser.discord_id || '—'}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Joined</dt>
                    <dd class="font-medium">{formatDateFull(selectedUser.created_at)}</dd>
                  </div>
                </dl>
              </Card.Content>
            </Card.Root>

            <!-- Recent Orders -->
            <Card.Root>
              <Card.Header class="pb-3">
                <Card.Title class="text-base flex items-center gap-2">
                  <ShoppingBag class="h-4 w-4" />
                  Recent Orders
                </Card.Title>
              </Card.Header>
              <Card.Content>
                {#if userOrders.length > 0}
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
                      {#each userOrders as order}
                        {@const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus]}
                        <Table.Row>
                          <Table.Cell class="font-mono text-sm">{order.order_number}</Table.Cell>
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
                              <ExternalLink class="h-3 w-3" />
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
              <Card.Header class="pb-3">
                <Card.Title class="text-base flex items-center gap-2">
                  <MapPin class="h-4 w-4" />
                  Saved Addresses
                </Card.Title>
              </Card.Header>
              <Card.Content>
                {#if userAddresses.length > 0}
                  <div class="grid gap-3 sm:grid-cols-2">
                    {#each userAddresses as address}
                      <div class="rounded-lg border p-3 text-sm">
                        {#if address.is_default}
                          <Badge variant="outline" class="mb-2 text-xs">Default</Badge>
                        {/if}
                        <address class="not-italic">
                          <p class="font-medium">{address.name}</p>
                          <p class="text-muted-foreground">{address.line1}</p>
                          {#if address.line2}
                            <p class="text-muted-foreground">{address.line2}</p>
                          {/if}
                          <p class="text-muted-foreground">{address.city}, {address.state} {address.postal_code}</p>
                          <p class="text-muted-foreground">{address.country}</p>
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
            <!-- Account Status -->
            <Card.Root>
              <Card.Header class="pb-3">
                <Card.Title class="text-base flex items-center gap-2">
                  <ShieldAlert class="h-4 w-4" />
                  Account Status
                </Card.Title>
              </Card.Header>
              <Card.Content class="space-y-4">
                <label class="flex items-center gap-3 cursor-pointer">
                  <Checkbox 
                    checked={isBlocked}
                    onCheckedChange={(v) => isBlocked = !!v}
                  />
                  <span class="text-sm">Block this user</span>
                </label>
                
                {#if isBlocked}
                  <div class="space-y-2">
                    <Label class="text-sm">Reason for blocking</Label>
                    <Textarea
                      placeholder="Enter reason..."
                      bind:value={blockedReason}
                      rows={2}
                    />
                  </div>
                {/if}
              </Card.Content>
            </Card.Root>

            <!-- Admin Notes -->
            <Card.Root>
              <Card.Header class="pb-3">
                <Card.Title class="text-base flex items-center gap-2">
                  <MessageSquare class="h-4 w-4" />
                  Admin Notes
                </Card.Title>
              </Card.Header>
              <Card.Content class="space-y-4">
                <Textarea 
                  placeholder="Internal notes about this user..."
                  rows={3}
                  bind:value={adminNotes}
                />
              </Card.Content>
            </Card.Root>

            <!-- Notification Preferences -->
            <Card.Root>
              <Card.Header class="pb-3">
                <Card.Title class="text-base flex items-center gap-2">
                  <Mail class="h-4 w-4" />
                  Notifications
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">Email notifications</dt>
                    <dd>{selectedUser.email_notifications ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">Discord notifications</dt>
                    <dd>{selectedUser.discord_notifications ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                </dl>
              </Card.Content>
            </Card.Root>
          </div>
        </div>

        <Dialog.Footer class="mt-6">
          <Button variant="outline" onclick={() => dialogOpen = false}>Close</Button>
          <Button onclick={saveUserDetails} disabled={isSaving}>
            <Save class="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Dialog.Footer>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>
