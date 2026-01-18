<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Badge } from '$components/ui/badge';
  import { Checkbox } from '$components/ui/checkbox';
  import * as Table from '$components/ui/table';
  import * as Select from '$components/ui/select';
  import * as Popover from '$components/ui/popover';
  import * as Command from '$components/ui/command';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { getRonImageUrl, getScryfallImageUrl, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { 
    Search, 
    ChevronLeft, 
    ChevronRight, 
    Package,
    PackageX,
    RefreshCw,
    ChevronsUpDown,
    Check,
    CloudDownload,
    Loader2,
    ImageIcon
  } from 'lucide-svelte';

  interface InventoryCard {
    id: string;
    serial: string;
    card_name: string;
    set_name: string | null;
    set_code: string | null;
    collector_number: string | null;
    card_type: string;
    is_in_stock: boolean | null;
    is_new: boolean | null;
    foil_type: string | null;
    language: string | null;
    scryfall_id: string | null;
    ron_image_url: string | null;
    isDuplicate: boolean;
  }

  let { data } = $props();

  let searchInput = $state('');
  let selectedStock = $state('');
  let selectedSets = $state<string[]>([]);
  let showDuplicatesOnly = $state(false);
  
  // Hover state for card image popup
  let hoveredCard = $state<InventoryCard | null>(null);
  let hoverPosition = $state({ x: 0, y: 0 });
  
  // Set filter combobox state
  let setComboboxOpen = $state(false);
  let setSearchValue = $state('');
  
  $effect(() => {
    searchInput = data.searchQuery || '';
    selectedStock = data.stockFilter || '';
    selectedSets = data.setFilter ? data.setFilter.split(',').filter(Boolean) : [];
    showDuplicatesOnly = data.duplicatesOnly || false;
  });
  
  // Track selected cards for bulk actions
  let selectedCards = $state<Set<string>>(new Set());
  let isUpdating = $state(false);
  let isSyncing = $state(false);
  let isResyncingImages = $state(false);
  let resyncingCardId = $state<string | null>(null);

  const totalPages = $derived(Math.ceil(data.totalCount / data.perPage));
  
  // Filter sets based on search
  const filteredSets = $derived.by(() => {
    if (!setSearchValue) return data.sets;
    const query = setSearchValue.toLowerCase();
    return data.sets.filter(
      (set: { code: string; name: string }) =>
        set.name.toLowerCase().includes(query) || set.code.toLowerCase().includes(query)
    );
  });
  
  // Get display label for sets
  const selectedSetsLabel = $derived.by(() => {
    if (selectedSets.length === 0) return 'All Sets';
    if (selectedSets.length === 1) {
      const set = data.sets.find((s: { code: string; name: string }) => s.code === selectedSets[0]);
      return set ? set.name : 'All Sets';
    }
    return `${selectedSets.length} sets selected`;
  });

  function toggleSet(code: string) {
    if (selectedSets.includes(code)) {
      selectedSets = selectedSets.filter(c => c !== code);
    } else {
      selectedSets = [...selectedSets, code];
    }
    applyFilters();
  }
  
  function clearSetSelection() {
    selectedSets = [];
    setSearchValue = '';
    applyFilters();
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (selectedStock) params.set('stock', selectedStock);
    if (selectedSets.length > 0) params.set('sets', selectedSets.join(','));
    if (showDuplicatesOnly) params.set('duplicates', '1');
    params.set('page', '1');
    goto(`/admin/inventory?${params.toString()}`);
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams();
    if (searchInput) params.set('q', searchInput);
    if (selectedStock) params.set('stock', selectedStock);
    if (selectedSets.length > 0) params.set('sets', selectedSets.join(','));
    if (showDuplicatesOnly) params.set('duplicates', '1');
    params.set('page', newPage.toString());
    goto(`/admin/inventory?${params.toString()}`);
  }

  function clearFilters() {
    searchInput = '';
    selectedStock = '';
    selectedSets = [];
    setSearchValue = '';
    showDuplicatesOnly = false;
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

  async function syncWithGoogleSheets() {
    isSyncing = true;
    try {
      const response = await fetch('/api/admin/inventory/sync', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Sync complete! ${result.success} cards synced, ${result.errors} errors. Total: ${result.total}`);
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to sync with Google Sheets');
      }
    } catch (err) {
      toast.error('Failed to sync with Google Sheets');
    } finally {
      isSyncing = false;
    }
  }

  async function resyncImages(cardIds: string[]) {
    isResyncingImages = true;
    try {
      const response = await fetch('/api/admin/inventory/resync-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_ids: cardIds })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Resynced ${result.updated} image(s), ${result.errors} error(s)`);
        selectedCards = new Set();
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to resync images');
      }
    } catch (err) {
      toast.error('Failed to resync images');
    } finally {
      isResyncingImages = false;
    }
  }

  async function resyncSingleCardImage(cardId: string) {
    resyncingCardId = cardId;
    try {
      const response = await fetch('/api/admin/inventory/resync-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_ids: [cardId] })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.updated > 0) {
          toast.success('Image resynced successfully');
        } else if (result.errors > 0) {
          toast.error('Failed to resync image');
        } else {
          toast.info('No image found in sheet');
        }
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to resync image');
      }
    } catch (err) {
      toast.error('Failed to resync image');
    } finally {
      resyncingCardId = null;
    }
  }

  // Handle mouse move for card image popup
  function handleRowMouseMove(e: MouseEvent, card: InventoryCard) {
    hoveredCard = card;
    hoverPosition = { x: e.clientX, y: e.clientY };
  }

  function handleRowMouseLeave() {
    hoveredCard = null;
  }

  // Get image URL for hover popup
  function getCardImageUrl(card: InventoryCard): string {
    const ronUrl = getRonImageUrl(card.ron_image_url);
    if (ronUrl) return ronUrl;
    return card.scryfall_id 
      ? getScryfallImageUrl(card.scryfall_id, 'normal') 
      : '/images/card-placeholder.png';
  }
</script>

<div class="p-8">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">Inventory</h1>
      <p class="text-muted-foreground">Manage card stock status</p>
    </div>
    <Button 
      variant="outline" 
      onclick={syncWithGoogleSheets}
      disabled={isSyncing}
      class="gap-2"
    >
      {#if isSyncing}
        <Loader2 class="h-4 w-4 animate-spin" />
        Syncing...
      {:else}
        <CloudDownload class="h-4 w-4" />
        Sync with Google Sheets
      {/if}
    </Button>
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

    <!-- Set Filter - Searchable Multiselect -->
    <Popover.Root bind:open={setComboboxOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            class="w-[200px] justify-between"
            role="combobox"
            aria-expanded={setComboboxOpen}
          >
            <span class="truncate">{selectedSetsLabel}</span>
            <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-[300px] p-0" align="start">
        <Command.Root shouldFilter={false}>
          <Command.Input
            placeholder="Search sets..."
            bind:value={setSearchValue}
          />
          <Command.List>
            <Command.Empty>No sets found.</Command.Empty>
            {#if selectedSets.length > 0}
              <div class="flex items-center justify-between px-2 py-1.5 border-b">
                <span class="text-xs text-muted-foreground">{selectedSets.length} selected</span>
                <Button variant="ghost" size="sm" class="h-auto py-0 px-1 text-xs" onclick={clearSetSelection}>
                  Clear
                </Button>
              </div>
            {/if}
            <Command.Group>
              {#each filteredSets as set (set.code)}
                <Command.Item
                  value={set.code}
                  onSelect={() => toggleSet(set.code)}
                >
                  <Check
                    class="mr-2 h-4 w-4 {selectedSets.includes(set.code) ? 'opacity-100' : 'opacity-0'}"
                  />
                  <span class="truncate">{set.name}</span>
                  <span class="ml-2 text-xs text-muted-foreground">({set.code.toUpperCase()})</span>
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>

    <Button variant="outline" onclick={applyFilters}>Search</Button>
    
    <!-- Duplicates filter toggle -->
    <Button 
      variant={showDuplicatesOnly ? "default" : "outline"} 
      onclick={() => { showDuplicatesOnly = !showDuplicatesOnly; applyFilters(); }}
      class="gap-2"
    >
      <span class="h-2 w-2 rounded-full bg-orange-500"></span>
      Duplicates {#if data.totalDuplicates}({data.totalDuplicates}){/if}
    </Button>
    
    {#if data.searchQuery || data.stockFilter || data.setFilter || data.duplicatesOnly}
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
        variant="outline"
        onclick={() => resyncImages([...selectedCards])}
        disabled={isResyncingImages}
        class="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
      >
        {#if isResyncingImages}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Resyncing...
        {:else}
          <ImageIcon class="mr-2 h-4 w-4" />
          Resync Images
        {/if}
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
          <Table.Head>Set Code</Table.Head>
          <Table.Head>№</Table.Head>
          <Table.Head>LA</Table.Head>
          <Table.Head>Finish</Table.Head>
          <Table.Head>Stock</Table.Head>
          <Table.Head></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each data.cards as card}
          <Table.Row 
            class="{selectedCards.has(card.id) ? 'bg-muted/50' : ''} {card.isDuplicate ? 'border-l-4 border-l-orange-500' : ''}"
            onmouseleave={handleRowMouseLeave}
          >
            <Table.Cell>
              <Checkbox 
                checked={selectedCards.has(card.id)}
                onCheckedChange={() => toggleCardSelection(card.id)}
              />
            </Table.Cell>
            <Table.Cell 
              class="font-medium"
              onmousemove={(e) => handleRowMouseMove(e, card)}
            >
              {card.card_name}
              {#if card.is_new}
                <Badge variant="outline" class="ml-2 border-green-500 text-green-500">New</Badge>
              {/if}
              {#if card.isDuplicate}
                <Badge variant="outline" class="ml-2 border-orange-500 text-orange-500">Duplicate</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell 
              class="font-mono text-sm"
              onmousemove={(e) => handleRowMouseMove(e, card)}
            >
              {card.serial}
            </Table.Cell>
            <Table.Cell 
              class="text-sm"
              onmousemove={(e) => handleRowMouseMove(e, card)}
            >
              {card.set_name || card.set_code}
            </Table.Cell>
            <Table.Cell 
              class="text-xs font-mono uppercase"
              onmousemove={(e) => handleRowMouseMove(e, card)}
            >
              {card.set_code || '—'}
            </Table.Cell>
            <Table.Cell 
              class="text-sm"
              onmousemove={(e) => handleRowMouseMove(e, card)}
            >
              {card.collector_number || '—'}
            </Table.Cell>
            <Table.Cell 
              class="text-sm"
              onmousemove={(e) => handleRowMouseMove(e, card)}
            >
              {card.language || 'en'}
            </Table.Cell>
            <Table.Cell onmousemove={(e) => handleRowMouseMove(e, card)}>
              {@const finish = getFinishLabel(card)}
              <Badge class={getFinishBadgeClasses(finish)}>{finish}</Badge>
            </Table.Cell>
            <Table.Cell onmousemove={(e) => handleRowMouseMove(e, card)}>
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
            <Table.Cell class="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                onclick={() => toggleSingleCard(card.id, card.is_in_stock ?? false)}
                disabled={isUpdating}
                title="Toggle stock status"
              >
                <RefreshCw class="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onclick={() => resyncSingleCardImage(card.id)}
                disabled={resyncingCardId === card.id}
                title="Resync image from Google Sheets"
                class="text-blue-600 hover:text-blue-700"
              >
                {#if resyncingCardId === card.id}
                  <Loader2 class="h-4 w-4 animate-spin" />
                {:else}
                  <ImageIcon class="h-4 w-4" />
                {/if}
              </Button>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={10} class="py-8 text-center text-muted-foreground">
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

<!-- Card image popup on hover -->
{#if hoveredCard}
  <div
    class="pointer-events-none fixed z-50 rounded-lg border bg-background shadow-xl"
    style="left: {hoverPosition.x + 20}px; top: {Math.max(10, hoverPosition.y - 150)}px;"
  >
    <img
      src={getCardImageUrl(hoveredCard)}
      alt={hoveredCard.card_name}
      class="h-[300px] w-auto rounded-lg object-contain"
      referrerpolicy="no-referrer"
    />
  </div>
{/if}
