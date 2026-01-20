<script lang="ts">
  import CardGrid from '$components/cards/CardGrid.svelte';
  import CardTableView from '$components/cards/CardTableView.svelte';
  import SearchFilters from '$components/cards/SearchFilters.svelte';
  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import * as Tooltip from '$components/ui/tooltip';
  import { Skeleton } from '$components/ui/skeleton';
  import { Search, LayoutGrid, List } from 'lucide-svelte';
  import { untrack } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import type { Card } from '$lib/server/types';

  let { data } = $props();

  // Initialize from URL params via server - use untrack since we only want initial values
  const initialFilters = untrack(() => data.initialFilters);
  
  let searchQuery = $state(initialFilters.search);
  let viewMode = $state<'grid' | 'table'>(initialFilters.view);
  let currentPage = $state(initialFilters.page);
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

  // Cache loaded data so skeleton only shows on initial load
  let loadedCards = $state<Card[] | null>(null);
  let loadedSets = $state<{ code: string; name: string }[] | null>(null);
  let loadError = $state<string | null>(null);
  let isLoading = $state(true);

  // Load data once and cache it
  $effect(() => {
    data.streamed.cardsData
      .then((cardsData) => {
        loadedCards = cardsData.cards;
        loadedSets = cardsData.sets;
        isLoading = false;
      })
      .catch((error) => {
        loadError = error.message || 'Failed to load cards';
        isLoading = false;
      });
  });

  // Track whether this is the initial render (skip first URL update)
  let isInitialized = $state(false);
  
  // Track previous filter state to detect actual filter changes (not page changes)
  let prevFilters = $state({
    setCodes: filters.setCodes.join(','),
    colorIdentity: filters.colorIdentity.join(','),
    colorIdentityStrict: filters.colorIdentityStrict,
    priceCategories: filters.priceCategories.join(','),
    cardTypes: filters.cardTypes.join(','),
    frameTypes: filters.frameTypes.join(','),
    inStockOnly: filters.inStockOnly,
    isNew: filters.isNew,
    viewMode: viewMode
  });

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
    if (currentPage > 1) params.set('page', String(currentPage));
    
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '/';
  }

  // Update URL without navigation - use SvelteKit's replaceState
  function updateUrl() {
    const newUrl = buildFilterUrl();
    // Use SvelteKit's replaceState - maintain current state to prevent component errors
    replaceState(newUrl, $page.state);
  }

  // Handle page change from CardGrid
  function handlePageChange(page: number) {
    currentPage = page;
    updateUrl();
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
      currentPage = 1; // Reset to page 1 on search
      updateUrl();
    }, SEARCH_DEBOUNCE_MS);
  }

  // Watch for filter changes (non-search) and update URL immediately
  $effect(() => {
    // Create snapshot of current filter state
    const current = {
      setCodes: filters.setCodes.join(','),
      colorIdentity: filters.colorIdentity.join(','),
      colorIdentityStrict: filters.colorIdentityStrict,
      priceCategories: filters.priceCategories.join(','),
      cardTypes: filters.cardTypes.join(','),
      frameTypes: filters.frameTypes.join(','),
      inStockOnly: filters.inStockOnly,
      isNew: filters.isNew,
      viewMode: viewMode
    };
    
    // Skip the initial render to avoid unnecessary URL update
    if (!isInitialized) {
      isInitialized = true;
      prevFilters = current;
      return;
    }
    
    // Check if any actual filter changed (not just page number)
    const filtersChanged = Object.keys(current).some(
      key => current[key as keyof typeof current] !== prevFilters[key as keyof typeof prevFilters]
    );
    
    // Only reset to page 1 when filters actually change
    if (filtersChanged) {
      currentPage = 1;
      prevFilters = current;
    }
    
    // Update URL synchronously
    updateUrl();
  });

  // Cleanup debounce timer on unmount
  $effect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  });

  // Search input element reference for keyboard shortcut
  let searchInputEl: HTMLInputElement | null = $state(null);

  // Handle "/" keyboard shortcut to focus search
  function handleKeydown(event: KeyboardEvent) {
    // Ignore if typing in an input, textarea, or contenteditable
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    if (event.key === '/') {
      event.preventDefault();
      searchInputEl?.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>Ron's Group Buy</title>
  <meta name="description" content="Browse and order cards for Ron's monthly group buy" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Ron's Group Buy" />
  <meta property="og:description" content="Browse and order cards for Ron's monthly group buy" />
  <meta property="og:image" content="/ron-gb.png" />
  <meta property="og:site_name" content="Ron GB" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Ron's Group Buy" />
  <meta name="twitter:description" content="Browse and order cards for Ron's monthly group buy" />
  <meta name="twitter:image" content="/ron-gb.png" />
</svelte:head>

<div class="container py-8">
  <!-- Hero Section -->
  <div class="mb-8 text-center">
    <h1 class="text-4xl font-bold tracking-tight">Card Catalog</h1>
    <p class="mt-2 text-muted-foreground">
      Browse Ron's library of Magic: The Gathering cards
    </p>
  </div>

  <!-- Search Bar & View Toggle -->
  <div class="mb-6 flex items-center gap-4">
    <div class="relative flex-1">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        bind:ref={searchInputEl}
        type="search"
        placeholder="Search cards by name... (Press / to focus)"
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
    <!-- Filters Sidebar - always visible, sets load async -->
    <aside class="w-full shrink-0 lg:w-64">
      <SearchFilters 
        bind:filters 
        sets={loadedSets || []} 
        onClearAll={() => { searchQuery = ''; currentPage = 1; }}
      />
    </aside>

    <!-- Card View -->
    <div class="flex-1">
      {#if isLoading}
        <!-- Skeleton for card grid while loading -->
        <div class="mb-4 flex items-center justify-between">
          <Skeleton class="h-4 w-48" />
          <Skeleton class="h-4 w-24" />
        </div>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {#each Array(10) as _}
            <div class="space-y-2">
              <Skeleton class="aspect-[488/680] w-full rounded-lg" />
              <Skeleton class="h-4 w-3/4" />
              <div class="flex justify-between">
                <Skeleton class="h-3 w-16" />
                <Skeleton class="h-3 w-12" />
              </div>
            </div>
          {/each}
        </div>
      {:else if loadError}
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <p class="text-xl font-medium text-destructive">Error loading cards</p>
          <p class="mt-2 text-muted-foreground">{loadError}</p>
        </div>
      {:else if loadedCards}
        {#if viewMode === 'grid'}
          <CardGrid 
            cards={loadedCards} 
            {searchQuery} 
            {filters}
            {currentPage}
            onPageChange={handlePageChange}
          />
        {:else}
          <CardTableView
            cards={loadedCards}
            {searchQuery}
            {filters}
            {currentPage}
            onPageChange={handlePageChange}
          />
        {/if}
      {/if}
    </div>
  </div>
</div>
