<script lang="ts">
  import CardGrid from '$components/cards/CardGrid.svelte';
  import CardTableView from '$components/cards/CardTableView.svelte';
  import SearchFilters from '$components/cards/SearchFilters.svelte';
  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import * as Tooltip from '$components/ui/tooltip';
  import { Search, LayoutGrid, List } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { untrack } from 'svelte';

  let { data } = $props();

  // Initialize from URL params via server - use untrack since we only want initial values
  const initialFilters = untrack(() => data.initialFilters);
  
  let searchQuery = $state(initialFilters.search);
  let viewMode = $state<'grid' | 'table'>(initialFilters.view);
  let filters = $state({
    setCodes: initialFilters.setCodes,
    colorIdentity: initialFilters.colorIdentity as string[],
    colorIdentityStrict: initialFilters.colorIdentityStrict,
    priceCategories: initialFilters.priceCategories as string[],
    cardTypes: initialFilters.cardTypes as string[],
    frameTypes: initialFilters.frameTypes as string[],
    inStockOnly: initialFilters.inStockOnly,
    isNew: initialFilters.isNew
  });

  // Track whether this is the initial render (skip first URL update)
  let isInitialized = $state(false);

  // Debounce timer for search input
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const SEARCH_DEBOUNCE_MS = 400;

  // Build URL from current filter state
  function buildFilterUrl(): string {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set('q', searchQuery);
    if (filters.setCodes.length > 0) params.set('sets', filters.setCodes.join(','));
    if (filters.colorIdentity.length > 0) params.set('colors', filters.colorIdentity.join(','));
    if (filters.colorIdentityStrict) params.set('strict', '1');
    if (filters.priceCategories.length > 0 && 
        !(filters.priceCategories.length === 2 && 
          filters.priceCategories.includes('Non-Foil') && 
          filters.priceCategories.includes('Foil'))) {
      params.set('price', filters.priceCategories.join(','));
    }
    if (filters.cardTypes.length > 0) params.set('types', filters.cardTypes.join(','));
    if (filters.frameTypes.length > 0) params.set('frames', filters.frameTypes.join(','));
    if (filters.inStockOnly) params.set('stock', '1');
    if (filters.isNew) params.set('new', '1');
    if (viewMode !== 'grid') params.set('view', viewMode);
    
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '/';
  }

  // Update URL without navigation (replaceState)
  function updateUrl() {
    const newUrl = buildFilterUrl();
    goto(newUrl, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // Debounced search update
  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Set new debounce timer
    searchDebounceTimer = setTimeout(() => {
      updateUrl();
    }, SEARCH_DEBOUNCE_MS);
  }

  // Watch for filter changes (non-search) and update URL immediately
  $effect(() => {
    // Track all filter values to trigger on changes
    const _ = [
      filters.setCodes.join(','),
      filters.colorIdentity.join(','),
      filters.colorIdentityStrict,
      filters.priceCategories.join(','),
      filters.cardTypes.join(','),
      filters.frameTypes.join(','),
      filters.inStockOnly,
      filters.isNew,
      viewMode
    ];
    
    // Skip the initial render to avoid unnecessary URL update
    if (!isInitialized) {
      isInitialized = true;
      return;
    }
    
    // Update URL
    queueMicrotask(() => updateUrl());
  });

  // Cleanup debounce timer on unmount
  $effect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  });
</script>

<svelte:head>
  <title>Group Buy - Card Catalog</title>
  <meta name="description" content="Browse and purchase Magic: The Gathering cards" />
</svelte:head>

<div class="container py-8">
  <!-- Hero Section -->
  <div class="mb-8 text-center">
    <h1 class="text-4xl font-bold tracking-tight">Card Catalog</h1>
    <p class="mt-2 text-muted-foreground">
      Browse Ron's selection of Magic: The Gathering cards
    </p>
  </div>

  <!-- Search Bar & View Toggle -->
  <div class="mb-6 flex items-center gap-4">
    <div class="relative flex-1">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search cards by name..."
        class="pl-10"
        value={searchQuery}
        oninput={handleSearchInput}
      />
    </div>
    <div class="flex items-center rounded-lg border bg-muted p-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="icon"
            class="h-8 w-8"
            onclick={() => (viewMode = 'grid')}
          >
            <LayoutGrid class="h-4 w-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p>Gallery View</p>
        </Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="icon"
            class="h-8 w-8"
            onclick={() => (viewMode = 'table')}
          >
            <List class="h-4 w-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p>List View</p>
        </Tooltip.Content>
      </Tooltip.Root>
    </div>
  </div>

  <div class="flex flex-col gap-6 lg:flex-row">
    <!-- Filters Sidebar -->
    <aside class="w-full shrink-0 lg:w-64">
      <SearchFilters 
        bind:filters 
        sets={data.sets} 
        onClearAll={() => { searchQuery = ''; }}
      />
    </aside>

    <!-- Card View -->
    <div class="flex-1">
      {#if viewMode === 'grid'}
        <CardGrid 
          cards={data.cards} 
          {searchQuery} 
          {filters}
        />
      {:else}
        <CardTableView
          cards={data.cards}
          {searchQuery}
          {filters}
        />
      {/if}
    </div>
  </div>
</div>
