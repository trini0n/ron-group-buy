<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import * as Table from '$components/ui/table';
  import * as Select from '$components/ui/select';
  import { ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/admin-shared';
  import { goto } from '$app/navigation';
  import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  let selectedStatus = $state('');
  
  $effect(() => {
    searchInput = data.searchQuery || '';
    selectedStatus = data.statusFilter || '';
  });

  const totalPages = $derived(Math.ceil(data.totalCount / data.perPage));

  function applyFilters() {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (selectedStatus) params.set('status', selectedStatus);
    params.set('page', '1');
    goto(`/admin/orders?${params.toString()}`);
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (selectedStatus) params.set('status', selectedStatus);
    params.set('page', newPage.toString());
    goto(`/admin/orders?${params.toString()}`);
  }

  function clearFilters() {
    searchInput = '';
    selectedStatus = '';
    goto('/admin/orders');
  }

  function formatDate(dateString: string) {
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
</script>

<div class="p-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">Orders</h1>
    <p class="text-muted-foreground">Manage and track all customer orders</p>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap items-center gap-4">
    <div class="relative flex-1 min-w-[200px] max-w-sm">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search by order # or name..."
        class="pl-10"
        bind:value={searchInput}
        onkeydown={(e) => e.key === 'Enter' && applyFilters()}
      />
    </div>

    <Select.Root 
      type="single"
      value={selectedStatus}
      onValueChange={(v) => { selectedStatus = v || ''; applyFilters(); }}
    >
      <Select.Trigger class="w-[180px]">
        {selectedStatus ? ORDER_STATUS_CONFIG[selectedStatus as OrderStatus]?.label : 'All Statuses'}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">All Statuses</Select.Item>
        {#each Object.entries(ORDER_STATUS_CONFIG) as [value, config]}
          <Select.Item {value}>{config.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Button variant="outline" onclick={applyFilters}>Search</Button>
    
    {#if data.searchQuery || data.statusFilter}
      <Button variant="ghost" onclick={clearFilters}>Clear</Button>
    {/if}
  </div>

  <!-- Results count -->
  <p class="mb-4 text-sm text-muted-foreground">
    Showing {data.orders.length} of {data.totalCount} orders
  </p>

  <!-- Orders Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Order #</Table.Head>
          <Table.Head>Customer</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head class="text-right">Items</Table.Head>
          <Table.Head class="text-right">Total</Table.Head>
          <Table.Head>Date</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each data.orders as order}
          {@const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus]}
          <Table.Row>
            <Table.Cell class="font-mono font-medium">
              {order.order_number}
            </Table.Cell>
            <Table.Cell>
              <div>
                <p class="font-medium">{order.shipping_name}</p>
                <p class="text-sm text-muted-foreground">
                  {order.user?.discord_username || order.user?.email}
                </p>
              </div>
            </Table.Cell>
            <Table.Cell>
              <Badge class={statusConfig?.color}>
                {statusConfig?.label || order.status}
              </Badge>
            </Table.Cell>
            <Table.Cell class="text-right">
              {order.itemCount}
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
        {:else}
          <Table.Row>
            <Table.Cell colspan={7} class="py-8 text-center text-muted-foreground">
              No orders found
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
