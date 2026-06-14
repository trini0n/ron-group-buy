<script lang="ts">
  import { Badge } from '$components/ui/badge'
  import { Library, Layers } from 'lucide-svelte'
  import { cartStore } from '$lib/stores/cart.svelte'
  import { toast } from 'svelte-sonner'

  let { data } = $props()

  let addingSetCode = $state<string | null>(null)

  async function addSetToCart(setCode: string, setName: string) {
    addingSetCode = setCode
    try {
      const ok = await cartStore.addBundle(setCode, 1)
      if (ok) {
        toast.success(`${setName} added to cart`)
      } else {
        toast.error('Failed to add set to cart')
      }
    } finally {
      addingSetCode = null
    }
  }
</script>

<svelte:head>
  <title>Sets — Group Buy</title>
  <meta name="description" content="Browse curated card sets available in the group buy. Each set is a hand-picked collection of cards." />
</svelte:head>

<div class="container py-8 max-w-6xl mx-auto px-4">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <Layers class="h-7 w-7 text-muted-foreground" />
      <h1 class="text-3xl font-bold">Sets</h1>
    </div>
    <p class="text-muted-foreground">
      Curated collections of cards available in the group buy.
      {#if data.sets.length > 0}
        {data.sets.length} set{data.sets.length !== 1 ? 's' : ''} available.
      {/if}
    </p>
  </div>

  {#if data.sets.length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <Library class="h-16 w-16 text-muted-foreground/30 mb-4" />
      <h2 class="text-xl font-semibold mb-2">No sets yet</h2>
      <p class="text-muted-foreground max-w-sm">
        Check back soon — curated sets will be listed here when available.
      </p>
    </div>
  {:else}
    <!-- Sets grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {#each data.sets as set (set.set_code)}
        <div class="group flex flex-col border rounded-xl p-5 bg-card hover:bg-accent/30 hover:border-primary/40 transition-all duration-200 hover:shadow-md">
          <!-- Set name (links to detail) -->
          <a href="/sets/{set.set_code}" class="block mb-2">
            <h2 class="font-semibold text-base leading-snug group-hover:text-primary transition-colors">
              {set.set_name}
            </h2>
          </a>

          <!-- Code badge -->
          <div class="mb-3">
            <Badge variant="secondary" class="font-mono text-xs">
              {set.set_code}
            </Badge>
          </div>

          <!-- Price + card count row -->
          <div class="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
            {#if set.price != null}
              <span class="text-lg font-bold text-primary">
                ${Number(set.price).toFixed(2)}
              </span>
            {:else}
              <span class="text-sm text-muted-foreground">Price TBD</span>
            {/if}
            <span class="text-xs text-muted-foreground">
              {set.card_count} card{set.card_count !== 1 ? 's' : ''}
            </span>
          </div>

          <!-- Add to Cart button -->
          <button
            id="add-set-{set.set_code}"
            class="mt-3 w-full rounded-lg border border-primary/60 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={addingSetCode === set.set_code || set.price == null}
            onclick={() => addSetToCart(set.set_code, set.set_name)}
          >
            {addingSetCode === set.set_code ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
