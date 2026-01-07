<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { Checkbox } from '$components/ui/checkbox';
  import * as Table from '$components/ui/table';
  import * as Select from '$components/ui/select';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { 
    Search, 
    ChevronLeft, 
    ChevronRight, 
    Package,
    PackageX,
    RefreshCw
  } from 'lucide-svelte';

  let { data } = $props();

  let searchInput = $state('');
  let selectedStock = $state('');
  let selectedSet = $state('');
  
  $effect(() => {
    searchInput = data.searchQuery || '';
    selectedStock = data.stockFilter || '';
    selectedSet = data.setFilter || '';
  });
  
  // Track selected cards for bulk actions
  let selectedCards = $state<Set<string>>(new Set());
  let isUpdating = $state(false);

  const totalPages = $derived(Math.ceil(data.totalCount / data.perPage));

  function applyFilters() {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (selectedStock) params.set('stock', selectedStock);
    if (selectedSet) params.set('set', selectedSet);
    params.set('page', '1');
    goto(`/admin/inventory?${params.toString()}`);
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (selectedStock) params.set('stock', selectedStock);
    if (selectedSet) params.set('set', selectedSet);
    params.set('page', newPage.toString());
    goto(`/admin/inventory?${params.toString()}`);
  }

  function clearFilters() {
    searchInput = '';
    selectedStock = '';
    selectedSet = '';
    goto('/admin/inventory');
  }

  function toggleCardSelection(cardId: string) {
    const newSet = new Set(selectedCards);
    if (newSet.has(cardId)) {
      newSet.delete(cardId);
    } else {
      newSet.add(cardId);
    }
    selectedCards = newSet;
  }

  function toggleSelectAll() {
    if (selectedCards.size === data.cards.length) {
      selectedCards = new Set();
    } else {
      selectedCards = new Set(data.cards.map(c => c.id));
    }
  }

  async function updateStock(cardIds: string[], inStock: boolean) {
    isUpdating = true;
    try {
      const response = await fetch('/api/admin/inventory/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_ids: cardIds,
          is_in_stock: inStock
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Updated ${result.updated} cards`);
        selectedCards = new Set();
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to update cards');
      }
    } catch (err) {
      toast.error('Failed to update cards');
    } finally {
      isUpdating = false;
    }
  }

  async function toggleSingleCard(cardId: string, currentStock: boolean) {
    await updateStock([cardId], !currentStock);
  }

  function getFinishLabel(card: { card_type: string; foil_type?: string | null }): string {
    if (card.foil_type) return card.foil_type;
    return card.card_type;
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">Inventory</h1>
    <p class="text-muted-foreground">Manage card stock status</p>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap items-center gap-4">
    <div class="relative flex-1 min-w-[200px] max-w-sm">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search by name or serial..."
        class="pl-10"
        bind:value={searchInput}
        onkeydown={(e) => e.key === 'Enter' && applyFilters()}
      />
    </div>

    <Select.Root 
      type="single"
      value={selectedStock}
      onValueChange={(v) => { selectedStock = v || ''; applyFilters(); }}
    >
      <Select.Trigger class="w-[150px]">
        {selectedStock === 'in' ? 'In Stock' : selectedStock === 'out' ? 'Out of Stock' : 'All Stock'}
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">All Stock</Select.Item>
        <Select.Item value="in">In Stock</Select.Item>
        <Select.Item value="out">Out of Stock</Select.Item>
      </Select.Content>
    </Select.Root>

    <Select.Root 
      type="single"
      value={selectedSet}
      onValueChange={(v) => { selectedSet = v || ''; applyFilters(); }}
    >
      <Select.Trigger class="w-[200px]">
        {selectedSet ? data.sets.find(s => s.code === selectedSet)?.name || selectedSet : 'All Sets'}
      </Select.Trigger>
      <Select.Content class="max-h-[300px]">
        <Select.Item value="">All Sets</Select.Item>
        {#each data.sets as set}
          <Select.Item value={set.code}>{set.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <Button variant="outline" onclick={applyFilters}>Search</Button>
    
    {#if data.searchQuery || data.stockFilter || data.setFilter}
      <Button variant="ghost" onclick={clearFilters}>Clear</Button>
    {/if}
  </div>

  <!-- Bulk Actions -->
  {#if selectedCards.size > 0}
    <div class="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
      <span class="text-sm font-medium">{selectedCards.size} selected</span>
      <Button 
        size="sm" 
        variant="outline"
        onclick={() => updateStock([...selectedCards], true)}
        disabled={isUpdating}
      >
        <Package class="mr-2 h-4 w-4" />
        Mark In Stock
      </Button>
      <Button 
        size="sm" 
        variant="outline"
        onclick={() => updateStock([...selectedCards], false)}
        disabled={isUpdating}
      >
        <PackageX class="mr-2 h-4 w-4" />
        Mark Out of Stock
      </Button>
      <Button 
        size="sm" 
        variant="ghost"
        onclick={() => selectedCards = new Set()}
      >
        Clear Selection
      </Button>
    </div>
  {/if}

  <!-- Results count -->
  <p class="mb-4 text-sm text-muted-foreground">
    Showing {data.cards.length} of {data.totalCount} cards
  </p>

  <!-- Cards Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[50px]">
            <Checkbox 
              checked={selectedCards.size === data.cards.length && data.cards.length > 0}
              onCheckedChange={toggleSelectAll}
            />
          </Table.Head>
          <Table.Head>Card Name</Table.Head>
          <Table.Head>Serial</Table.Head>
          <Table.Head>Set</Table.Head>
          <Table.Head>Finish</Table.Head>
          <Table.Head>Stock</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each data.cards as card}
          <Table.Row class={selectedCards.has(card.id) ? 'bg-muted/50' : ''}>
            <Table.Cell>
              <Checkbox 
                checked={selectedCards.has(card.id)}
                onCheckedChange={() => toggleCardSelection(card.id)}
              />
            </Table.Cell>
            <Table.Cell class="font-medium">
              {card.card_name}
              {#if card.is_new}
                <Badge variant="outline" class="ml-2 border-green-500 text-green-500">New</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell class="font-mono text-sm">{card.serial}</Table.Cell>
            <Table.Cell class="text-sm">
              {card.set_name || card.set_code}
            </Table.Cell>
            <Table.Cell>
              <Badge variant="outline">{getFinishLabel(card)}</Badge>
            </Table.Cell>
            <Table.Cell>
              {#if card.is_in_stock}
                <Badge class="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  In Stock
                </Badge>
              {:else}
                <Badge variant="destructive">
                  Out of Stock
                </Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <Button 
                variant="ghost" 
                size="sm"
                onclick={() => toggleSingleCard(card.id, card.is_in_stock)}
                disabled={isUpdating}
              >
                <RefreshCw class="h-4 w-4" />
              </Button>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={7} class="py-8 text-center text-muted-foreground">
              No cards found
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
