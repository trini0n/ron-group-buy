<script lang="ts">
  import { Badge } from '$components/ui/badge'
  import CardGrid from '$components/cards/CardGrid.svelte'
  import { ArrowLeft, Layers } from 'lucide-svelte'

  let { data } = $props()

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

    <div class="flex items-start gap-3">
      <Layers class="h-6 w-6 text-muted-foreground mt-1 shrink-0" />
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <h1 class="text-2xl font-bold">{data.set.set_name}</h1>
          <Badge variant="secondary" class="font-mono text-xs">{data.set.set_code}</Badge>
        </div>
        <div class="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{data.cards.length} card{data.cards.length !== 1 ? 's' : ''}</span>
          {#if data.set.price != null}
            <span class="text-lg font-bold text-primary">
              ${Number(data.set.price).toFixed(2)}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Card grid -->
  {#if data.cards.length === 0}
    <div class="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
      <Layers class="h-16 w-16 opacity-20 mb-4" />
      <h2 class="text-xl font-semibold mb-2">No cards in this set yet</h2>
      <p class="max-w-sm">Cards will appear here once the vendor associates them with this set.</p>
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
