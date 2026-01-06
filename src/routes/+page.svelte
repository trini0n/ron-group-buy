<script lang="ts">
  import CardGrid from '$components/cards/CardGrid.svelte';
  import CardTableView from '$components/cards/CardTableView.svelte';
  import SearchFilters from '$components/cards/SearchFilters.svelte';
  import { Input } from '$components/ui/input';
  import { Button } from '$components/ui/button';
  import * as Tooltip from '$components/ui/tooltip';
  import { Search, LayoutGrid, List } from 'lucide-svelte';

  let { data } = $props();

  let searchQuery = $state('');
  let viewMode = $state<'grid' | 'table'>('grid');
  let filters = $state({
    setCode: '',
    colorIdentity: [] as string[],
    priceCategories: ['Normal', 'Holo', 'Foil'] as string[],
    cardTypes: [] as string[],
    frameTypes: [] as string[],
    inStockOnly: false,
    isNew: false
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
      Browse our selection of Magic: The Gathering cards
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
        bind:value={searchQuery}
      />
    </div>
    <div class="flex items-center rounded-lg border bg-muted p-1">
      <Tooltip.Root>
        <Tooltip.Trigger onclick={() => viewMode = 'grid'}>
          {#snippet child({ props })}
            <Button
              {...props}
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              class="h-8 w-8"
            >
              <LayoutGrid class="h-4 w-4" />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p>Gallery View</p>
        </Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger onclick={() => viewMode = 'table'}>
          {#snippet child({ props })}
            <Button
              {...props}
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="icon"
              class="h-8 w-8"
            >
              <List class="h-4 w-4" />
            </Button>
          {/snippet}
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
      <SearchFilters bind:filters sets={data.sets} />
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
