<script lang="ts">
  import CardGrid from '$components/cards/CardGrid.svelte';
  import SearchFilters from '$components/cards/SearchFilters.svelte';
  import { Input } from '$components/ui/input';
  import { Search } from 'lucide-svelte';

  let { data } = $props();

  let searchQuery = $state('');
  let filters = $state({
    setCode: '',
    colorIdentity: [] as string[],
    cardType: '' as '' | 'Normal' | 'Holo' | 'Foil',
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

  <!-- Search Bar -->
  <div class="relative mb-6">
    <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      type="search"
      placeholder="Search cards by name..."
      class="pl-10"
      bind:value={searchQuery}
    />
  </div>

  <div class="flex flex-col gap-6 lg:flex-row">
    <!-- Filters Sidebar -->
    <aside class="w-full shrink-0 lg:w-64">
      <SearchFilters bind:filters sets={data.sets} />
    </aside>

    <!-- Card Grid -->
    <div class="flex-1">
      <CardGrid 
        cards={data.cards} 
        {searchQuery} 
        {filters}
      />
    </div>
  </div>
</div>
