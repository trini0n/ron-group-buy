<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { Checkbox } from '$components/ui/checkbox';
  import * as Table from '$components/ui/table';
  import * as Select from '$components/ui/select';
  import * as Dialog from '$components/ui/dialog';
  import { ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/admin-shared';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Search, ChevronLeft, ChevronRight, ExternalLink, Package, Truck } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  let selectedStatus = $state('');
  
  // Multi-select state
  let selectedOrders = $state<Set<string>>(new Set());
  let bulkDialogOpen = $state(false);
  let bulkNewStatus = $state<OrderStatus | ''>('');
  let isBulkUpdating = $state(false);
  
  const allSelected = $derived(
    data.orders.length > 0 && selectedOrders.size === data.orders.length
  );
  const someSelected = $derived(selectedOrders.size > 0);
  
  $effect(() => {
    searchInput = data.searchQuery || '';
    selectedStatus = data.statusFilter || '';
    // Clear selection on page change
    selectedOrders = new Set();
  });

  const totalPages = $derived(Math.ceil(data.totalCount / data.perPage));

  function toggleOrder(orderId: string) {
    const newSet = new Set(selectedOrders);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    selectedOrders = newSet;
  }

  function toggleAll() {
    if (allSelected) {
      selectedOrders = new Set();
    } else {
      selectedOrders = new Set(data.orders.map((o: any) => o.id));
    }
  }

  async function bulkUpdateStatus() {
    if (!bulkNewStatus || selectedOrders.size === 0) return;
    
    isBulkUpdating = true;
    try {
      const response = await fetch('/api/admin/orders/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrders),
          status: bulkNewStatus
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Updated ${result.updated} orders to ${ORDER_STATUS_CONFIG[bulkNewStatus]?.label}`);
        bulkDialogOpen = false;
        bulkNewStatus = '';
        selectedOrders = new Set();
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to update orders');
      }
    } catch (err) {
      toast.error('Failed to update orders');
    } finally {
      isBulkUpdating = false;
    }
  }

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
  <div class="mb-4 flex items-center justify-between">
    <p class="text-sm text-muted-foreground">
      Showing {data.orders.length} of {data.totalCount} orders
    </p>
    {#if someSelected}
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">{selectedOrders.size} selected</span>
        <Button size="sm" onclick={() => bulkDialogOpen = true}>
          Update Status
        </Button>
        <Button size="sm" variant="ghost" onclick={() => selectedOrders = new Set()}>
          Clear
        </Button>
      </div>
    {/if}
  </div>

  <!-- Orders Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-10">
            <Checkbox 
              checked={allSelected} 
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
          </Table.Head>
          <Table.Head>Order #</Table.Head>
          <Table.Head>Customer</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Shipping</Table.Head>
          <Table.Head class="text-right">Items</Table.Head>
          <Table.Head class="text-right">Total</Table.Head>
          <Table.Head>Date</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each data.orders as order}
          {@const statusConfig = ORDER_STATUS_CONFIG[order.status as OrderStatus]}
          <Table.Row class={selectedOrders.has(order.id) ? 'bg-muted/50' : ''}>
            <Table.Cell>
              <Checkbox 
                checked={selectedOrders.has(order.id)} 
                onCheckedChange={() => toggleOrder(order.id)}
                aria-label="Select order"
              />
            </Table.Cell>
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
            <Table.Cell>
              <div class="flex items-center gap-1 text-sm">
                {#if order.shipping_type === 'express'}
                  <Truck class="h-3.5 w-3.5" />
                  <span>Express</span>
                {:else}
                  <Package class="h-3.5 w-3.5" />
                  <span>Regular</span>
                {/if}
              </div>
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
            <Table.Cell colspan={9} class="py-8 text-center text-muted-foreground">
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

<!-- Bulk Status Update Dialog -->
<Dialog.Root bind:open={bulkDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Update Order Status</Dialog.Title>
      <Dialog.Description>
        Change status for {selectedOrders.size} selected order{selectedOrders.size !== 1 ? 's' : ''}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="py-4">
      <Select.Root 
        type="single"
        value={bulkNewStatus}
        onValueChange={(v) => bulkNewStatus = (v || '') as OrderStatus | ''}
      >
        <Select.Trigger class="w-full">
          {bulkNewStatus ? ORDER_STATUS_CONFIG[bulkNewStatus]?.label : 'Select new status'}
        </Select.Trigger>
        <Select.Content>
          {#each Object.entries(ORDER_STATUS_CONFIG) as [value, config]}
            <Select.Item {value}>
              <Badge class="{config.color} mr-2">{config.label}</Badge>
              {config.label}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => bulkDialogOpen = false}>
        Cancel
      </Button>
      <Button onclick={bulkUpdateStatus} disabled={!bulkNewStatus || isBulkUpdating}>
        {isBulkUpdating ? 'Updating...' : `Update ${selectedOrders.size} Orders`}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
