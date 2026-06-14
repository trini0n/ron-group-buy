<script lang="ts">
  import { Badge } from '$components/ui/badge'
  import CardGrid from '$components/cards/CardGrid.svelte'
  import { ArrowLeft, Layers, List, LayoutGrid } from 'lucide-svelte'

  let { data } = $props()

  // View toggle: 'grid' = enriched CardGrid, 'list' = plaintext
  let viewMode = $state<'grid' | 'list'>('list')

  // CardGrid requires filter + search props — use permissive defaults to show all cards
  const noFilters = {
    setCodes: [],
    colorIdentity: [],
    colorIdentityStrict: false,
    priceCategories: ['Non-Foil', 'Foil', 'Serialized'],
    foilSubtypes: ['Foil', 'Galaxy Foil', 'Raised Foil', 'Surge Foil'],
    nonFoilSubtypes: ['Normal', 'Holo'],
    cardTypes: [],
    frameTypes: [],
    inStockOnly: false,
    isNew: false,
    isMisprint: false
  }

  // Derive a readable name for each card
  function cardDisplayName(card: (typeof data.cards)[number]): string {
    return card.card_name ?? 'Unknown Card'
  }
</script>

<svelte:head>
  <title>{data.set.set_name} — Sets — Group Buy</title>
  <meta
    name="description"
    content="Browse {data.cards.length} cards in {data.set.set_name}. Part of the Group Buy curated sets collection."
  />
</svelte:head>

<div class="container py-8 max-w-7xl mx-auto px-4">
  <!-- Breadcrumb + header -->
  <div class="mb-8 space-y-3">
    <a
      href="/sets"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
      Back to Sets
    </a>

    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div class="flex items-start gap-3">
        <Layers class="h-6 w-6 text-muted-foreground mt-1 shrink-0" />
        <div>
          <h1 class="text-2xl font-bold">{data.set.set_name}</h1>
          <div class="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span>{data.cards.length} card{data.cards.length !== 1 ? 's' : ''}</span>
            {#if data.set.price != null}
              <span class="text-lg font-bold text-primary">
                ${Number(data.set.price).toFixed(2)}
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- View mode toggle (only show if cards exist) -->
      {#if data.cards.length > 0}
        <div class="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          <button
            id="view-toggle-list"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors {viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}"
            onclick={() => (viewMode = 'list')}
            aria-label="Plaintext list view"
          >
            <List class="h-3.5 w-3.5" />
            List
          </button>
          <button
            id="view-toggle-grid"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors {viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}"
            onclick={() => (viewMode = 'grid')}
            aria-label="Card grid view"
          >
            <LayoutGrid class="h-3.5 w-3.5" />
            Grid
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Content -->
  {#if data.cards.length === 0}
    <div class="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
      <Layers class="h-16 w-16 opacity-20 mb-4" />
      <h2 class="text-xl font-semibold mb-2">No cards in this set yet</h2>
      <p class="max-w-sm">Cards will appear here once the vendor associates them with this set.</p>
    </div>
  {:else if viewMode === 'list'}
    <!-- Plaintext list: one card per line -->
    <div class="border rounded-xl overflow-hidden">
      <div class="px-4 py-2 bg-muted/40 border-b text-xs text-muted-foreground font-medium">
        {data.cards.length} card{data.cards.length !== 1 ? 's' : ''}
      </div>
      <ol class="divide-y divide-border">
        {#each data.cards as card, i (card.id ?? i)}
          <li class="flex items-baseline gap-3 px-4 py-2 text-sm hover:bg-muted/20 transition-colors">
            <span class="text-muted-foreground text-xs w-6 shrink-0 text-right">{i + 1}</span>
            <span class="font-medium">{cardDisplayName(card)}</span>
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    <CardGrid
      cards={data.cards}
      searchQuery=""
      filters={noFilters}
      setReleaseDates={data.setReleaseDates}
    />
  {/if}
</div>
