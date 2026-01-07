<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { Switch } from '$components/ui/switch';
  import * as Table from '$components/ui/table';
  import * as Avatar from '$components/ui/avatar';
  import * as Tooltip from '$components/ui/tooltip';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Search, ChevronLeft, ChevronRight, ExternalLink, ShieldAlert, ShoppingBag, Shield, Crown } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  let togglingAdminFor = $state<string | null>(null);
  
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
              <Button variant="ghost" size="sm" href="/admin/users/{user.id}">
                <ExternalLink class="h-4 w-4" />
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
