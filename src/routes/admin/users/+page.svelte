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
  import { Search, ChevronLeft, ChevronRight, ExternalLink, ShieldAlert, ShoppingBag, Shield, Crown, Eye, MapPin, Mail, MessageSquare, Save, Loader2, Key } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  let togglingAdminFor = $state<string | null>(null);
  
  // Dialog state
  let dialogOpen = $state(false);
  let selectedUser = $state<any>(null);
  let userOrders = $state<any[]>([]);
  let userAddresses = $state<any[]>([]);
  let loadingUserDetails = $state(false);
  let userAuthMethods = $state({ hasGoogle: false, hasDiscord: false, hasPassword: false });
  
  // Editable fields for selected user
  let adminNotes = $state('');
  let isBlocked = $state(false);
  let blockedReason = $state('');
  let isSaving = $state(false);
  let isResettingPassword = $state(false);
  
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
        userAuthMethods = details.authMethods || { hasGoogle: false, hasDiscord: false, hasPassword: false };
        // Update editable fields from fresh data
        adminNotes = details.user.admin_notes || '';
        isBlocked = details.user.is_blocked || false;
        blockedReason = details.user.blocked_reason || '';
        selectedUser = { ...user, ...details.user, authMethods: details.authMethods };
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

  async function resetUserPassword() {
    if (!selectedUser) return;
    
    if (!confirm(`Send password reset email to ${selectedUser.email}?`)) {
      return;
    }

    isResettingPassword = true;
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Password reset email sent');
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to send password reset email');
      }
    } catch (err) {
      toast.error('Failed to send password reset email');
    } finally {
      isResettingPassword = false;
    }
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
          <Table.Head>Auth Methods</Table.Head>
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
              <div class="flex items-center gap-1 flex-wrap">
                {#if user.google_id}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <Badge variant="outline" class="text-xs">
                        <svg class="h-3 w-3 mr-1" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google
                      </Badge>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p>Google OAuth</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                {/if}
                {#if user.discord_username}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <Badge variant="outline" class="text-xs">
                        <svg class="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                        </svg>
                        Discord
                      </Badge>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                      <p>{user.discord_username}</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                {/if}
                {#if !user.google_id && !user.discord_username}
                  <Badge variant="outline" class="text-xs">
                    <Key class="h-3 w-3 mr-1" />
                    Password
                  </Badge>
                {/if}
              </div>
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
                <dl class="grid gap-3 text-sm">
                  <div>
                    <dt class="text-muted-foreground">Email</dt>
                    <dd class="font-medium">{selectedUser.email}</dd>
                  </div>
                  
                  <div>
                    <dt class="text-muted-foreground mb-2">Authentication Methods</dt>
                    <dd class="space-y-2">
                      {#if userAuthMethods.hasGoogle}
                        <div class="flex items-center gap-2 text-sm">
                          <Badge variant="outline" class="w-fit">
                            <svg class="h-3 w-3 mr-1" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Google OAuth
                          </Badge>
                          {#if selectedUser.google_id}
                            <span class="text-xs text-muted-foreground font-mono">{selectedUser.google_id}</span>
                          {/if}
                        </div>
                      {/if}
                      
                      {#if userAuthMethods.hasDiscord}
                        <div class="space-y-1">
                          <div class="flex items-center gap-2">
                            <Badge variant="outline" class="w-fit">
                              <svg class="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                              </svg>
                              Discord OAuth
                            </Badge>
                            {#if selectedUser.discord_username}
                              <span class="text-xs">{selectedUser.discord_username}</span>
                            {/if}
                          </div>
                          {#if selectedUser.discord_id}
                            <div class="text-xs text-muted-foreground font-mono ml-20">{selectedUser.discord_id}</div>
                          {/if}
                        </div>
                      {/if}
                      
                      {#if userAuthMethods.hasPassword}
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" class="w-fit">
                            <Key class="h-3 w-3 mr-1" />
                            Email/Password
                          </Badge>
                          <span class="text-xs text-muted-foreground">Password authentication enabled</span>
                        </div>
                      {/if}
                      
                      {#if !userAuthMethods.hasGoogle && !userAuthMethods.hasDiscord && !userAuthMethods.hasPassword}
                        <p class="text-xs text-muted-foreground">No authentication methods found</p>
                      {/if}
                    </dd>
                  </div>

                  <div>
                    <dt class="text-muted-foreground">Joined</dt>
                    <dd class="font-medium">{formatDateFull(selectedUser.created_at)}</dd>
                  </div>
                </dl>
              </Card.Content>
            </Card.Root>

            <!-- Password Management (for email/password users) -->
            {#if userAuthMethods.hasPassword}
              <Card.Root>
                <Card.Header class="pb-3">
                  <Card.Title class="text-base flex items-center gap-2">
                    <Key class="h-4 w-4" />
                    Password Management
                  </Card.Title>
                  <Card.Description>
                    Admin controls for user password authentication
                  </Card.Description>
                </Card.Header>
                <Card.Content>
                  <div class="space-y-3">
                    <div>
                      <p class="text-sm font-medium mb-1">Password Status</p>
                      <p class="text-xs text-muted-foreground">User has password authentication enabled</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onclick={resetUserPassword}
                      disabled={isResettingPassword}
                    >
                      {#if isResettingPassword}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      {:else}
                        <Mail class="mr-2 h-4 w-4" />
                        Send Password Reset Email
                      {/if}
                    </Button>
                    <p class="text-xs text-muted-foreground">
                      Sends a password reset link to <strong>{selectedUser.email}</strong>
                    </p>
                  </div>
                </Card.Content>
              </Card.Root>
            {/if}

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
