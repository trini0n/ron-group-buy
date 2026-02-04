<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { Checkbox } from '$components/ui/checkbox';
  import * as Table from '$components/ui/table';
  import * as Select from '$components/ui/select';
  import * as Dialog from '$components/ui/dialog';
  import * as Accordion from '$components/ui/accordion';
  import { ScrollArea } from '$components/ui/scroll-area';
  import { ORDER_STATUS_CONFIG, type OrderStatus } from '$lib/admin-shared';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { 
    Search, 
    ChevronLeft, 
    ChevronRight, 
    ExternalLink, 
    Package, 
    Truck, 
    Folder,
    FolderOpen,
    X,
    Download
  } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  
  // Multi-select state
  let selectedOrders = $state<Set<string>>(new Set());
  let bulkDialogOpen = $state(false);
  let bulkNewStatus = $state<OrderStatus | ''>('');
  let isBulkUpdating = $state(false);
  let isExporting = $state(false);
  
  // Accordion state for status sections
  let expandedSections = $state<string[]>(['pending', 'invoiced']);
  
  // Get all visible orders across all statuses for selection logic
  const allVisibleOrders = $derived(() => {
    const orders: any[] = [];
    for (const statusData of Object.values(data.ordersByStatus)) {
      orders.push(...statusData.orders);
    }
    return orders;
  });
  
  const allSelected = $derived(
    allVisibleOrders().length > 0 && selectedOrders.size === allVisibleOrders().length
  );
  const someSelected = $derived(selectedOrders.size > 0);
  
  $effect(() => {
    searchInput = data.searchQuery || '';
    // Clear selection on page change
    selectedOrders = new Set();
  });

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
      selectedOrders = new Set(allVisibleOrders().map((o: any) => o.id));
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

  function buildFilterUrl(overrides: Record<string, string | null> = {}) {
    const params = new URLSearchParams();
    
    const q = overrides.q !== undefined ? overrides.q : searchInput;
    const groupBuy = overrides.groupBuy !== undefined ? overrides.groupBuy : data.groupBuyFilter;
    
    if (q) params.set('q', q);
    if (groupBuy) params.set('groupBuy', groupBuy);
    
    // Preserve all status page parameters unless we're resetting (e.g., applying new filters)
    if (!overrides.resetPages) {
      const url = new URL(window.location.href);
      for (const [key, value] of url.searchParams.entries()) {
        if (key.endsWith('_page')) {
          params.set(key, value);
        }
      }
    }
    
    return `/admin/orders?${params.toString()}`;
  }

  function applyFilters() {
    // Reset pagination when applying new filters
    goto(buildFilterUrl({ resetPages: 'true' }));
  }

  function selectGroupBuy(groupBuyId: string | null) {
    goto(buildFilterUrl({ groupBuy: groupBuyId === null ? 'unassigned' : groupBuyId, resetPages: 'true' }));
  }

  function clearGroupBuyFilter() {
    goto(buildFilterUrl({ groupBuy: null, resetPages: 'true' }));
  }

  function changePage(status: string, newPage: number) {
    const params = new URLSearchParams(window.location.search);
    if (searchInput) params.set('q', searchInput);
    if (data.groupBuyFilter) params.set('groupBuy', data.groupBuyFilter);
    
    // Update the specific status page parameter
    params.set(`${status}_page`, newPage.toString());
    
    goto(`/admin/orders?${params.toString()}`);
  }

  function clearFilters() {
    searchInput = '';
    goto('/admin/orders');
  }

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

  function getActiveGroupBuyName(): string | null {
    if (!data.groupBuyFilter) return null;
    if (data.groupBuyFilter === 'unassigned') return 'Unassigned Orders';
    const gb = data.groupBuys.find((g: any) => g.id === data.groupBuyFilter);
    return gb?.name || null;
  }

  async function exportGroupBuy() {
    if (!data.groupBuyFilter || data.groupBuyFilter === 'unassigned') return;
    
    isExporting = true;
    try {
      const response = await fetch(`/api/admin/exports/groupbuy/${data.groupBuyFilter}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('content-disposition')?.split('filename="')[1]?.slice(0, -1) || 'export.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Group buy exported successfully');
      } else {
        toast.error('Failed to export group buy');
      }
    } catch (err) {
      toast.error('Failed to export group buy');
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="flex h-full">
  <!-- Group Buy Folders Panel -->
  <aside class="w-56 shrink-0 border-r bg-muted/30">
    <div class="p-3 border-b">
      <h3 class="text-xs font-semibold uppercase text-muted-foreground">Group Buys</h3>
    </div>
    <ScrollArea class="h-[calc(100vh-12rem)]">
      <div class="p-2 space-y-1">
        <!-- All Orders -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors {!data.groupBuyFilter ? 'bg-accent font-medium' : ''}"
          onclick={clearGroupBuyFilter}
        >
          <Folder class="h-4 w-4 shrink-0" />
          <span class="flex-1 text-left truncate">All Orders</span>
          <span class="text-xs text-muted-foreground">{data.allOrdersCount}</span>
        </button>

        <!-- Group Buys -->
        {#each data.groupBuys as groupBuy}
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors {data.groupBuyFilter === groupBuy.id ? 'bg-accent font-medium' : ''}"
            onclick={() => selectGroupBuy(groupBuy.id)}
          >
            {#if data.groupBuyFilter === groupBuy.id}
              <FolderOpen class="h-4 w-4 shrink-0 text-primary" />
            {:else}
              <Folder class="h-4 w-4 shrink-0" />
            {/if}
            <span class="flex-1 text-left truncate">{groupBuy.name}</span>
            {#if groupBuy.is_active}
              <Badge class="bg-green-500/20 text-green-500 border-green-500/50 text-[10px] px-1 py-0">Active</Badge>
            {/if}
            <span class="text-xs text-muted-foreground">{groupBuy.orderCount}</span>
          </button>
        {/each}

        <!-- Unassigned -->
        {#if data.unassignedCount > 0}
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors {data.groupBuyFilter === 'unassigned' ? 'bg-accent font-medium' : ''}"
            onclick={() => selectGroupBuy(null)}
          >
            <Folder class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 text-left truncate text-muted-foreground">Unassigned</span>
            <span class="text-xs text-muted-foreground">{data.unassignedCount}</span>
          </button>
        {/if}
      </div>
    </ScrollArea>
  </aside>

  <!-- Main Content -->
  <div class="flex-1 overflow-auto">
    <div class="p-6">
      <div class="mb-6">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold">Orders</h1>
          {#if getActiveGroupBuyName()}
            <Badge variant="secondary" class="text-sm">
              {getActiveGroupBuyName()}
              <button 
                class="ml-1 hover:text-destructive"
                onclick={clearGroupBuyFilter}
              >
                <X class="h-3 w-3" />
              </button>
            </Badge>
          {/if}
        </div>
        <p class="text-sm text-muted-foreground">Manage and track customer orders</p>
      </div>

      <!-- Filters -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
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

        <Button variant="outline" size="sm" onclick={applyFilters}>Search</Button>
        
        {#if data.searchQuery}
          <Button variant="ghost" size="sm" onclick={clearFilters}>Clear</Button>
        {/if}
      </div>

      <!-- Results count & bulk actions -->
      <div class="mb-3 flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
          Showing {allVisibleOrders().length} orders
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
        
        <!-- Bulk Export Button (only show when group buy is selected) -->
        {#if data.groupBuyFilter && data.groupBuyFilter !== 'unassigned'}
          <Button 
            variant="outline" 
            size="sm"
            onclick={exportGroupBuy}
            disabled={isExporting}
          >
            <Download class="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export Group Buy'}
          </Button>
        {/if}
      </div>

      <!-- Orders by Status Accordion -->
      {#if Object.keys(data.ordersByStatus).length > 0}
        <Accordion.Root type="multiple" bind:value={expandedSections} class="space-y-3">
          {#each Object.entries(ORDER_STATUS_CONFIG) as [status, config]}
            {@const statusData = data.ordersByStatus[status]}
            {#if statusData && statusData.orders.length > 0}
              <Accordion.Item value={status} class="rounded-lg border">
                <Accordion.Trigger class="px-4 py-2.5 hover:no-underline">
                  <div class="flex items-center gap-3">
                    <Badge class={config.color}>{config.label}</Badge>
                    <span class="text-sm text-muted-foreground">
                      {statusData.totalCount} order{statusData.totalCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div class="border-t">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.Head class="w-10">
                            <Checkbox 
                              checked={statusData.orders.every((o: any) => selectedOrders.has(o.id))} 
                              onCheckedChange={() => {
                                const allInSection = statusData.orders.every((o: any) => selectedOrders.has(o.id));
                                const newSet = new Set(selectedOrders);
                                statusData.orders.forEach((o: any) => {
                                  if (allInSection) {
                                    newSet.delete(o.id);
                                  } else {
                                    newSet.add(o.id);
                                  }
                                });
                                selectedOrders = newSet;
                              }}
                              aria-label="Select all in section"
                            />
                          </Table.Head>
                          <Table.Head>Order #</Table.Head>
                          <Table.Head>Customer</Table.Head>
                          <Table.Head>Shipping</Table.Head>
                          <Table.Head class="text-right">Items</Table.Head>
                          <Table.Head class="text-right">Total</Table.Head>
                          <Table.Head>Date</Table.Head>
                          <Table.Head></Table.Head>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {#each statusData.orders as order}
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
                        {/each}
                      </Table.Body>
                    </Table.Root>
                    
                    <!-- Per-status pagination -->
                    {#if statusData.totalPages > 1}
                      <div class="mt-3 px-4 pb-3 flex items-center justify-between border-t pt-3">
                        <p class="text-sm text-muted-foreground">
                          Page {statusData.currentPage} of {statusData.totalPages}
                        </p>
                        <div class="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={statusData.currentPage <= 1}
                            onclick={() => changePage(status, statusData.currentPage - 1)}
                          >
                            <ChevronLeft class="h-4 w-4" />
                            Previous
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={statusData.currentPage >= statusData.totalPages}
                            onclick={() => changePage(status, statusData.currentPage + 1)}
                          >
                            Next
                            <ChevronRight class="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    {/if}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            {/if}
          {/each}
        </Accordion.Root>
      {:else}
        <div class="rounded-md border py-12 text-center text-muted-foreground">
          No orders found
        </div>
      {/if}
    </div>
  </div>
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
