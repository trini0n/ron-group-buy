<script lang="ts">
  import StacksView from '$components/cards/StacksView.svelte'
  import { ArrowLeft, Layers, List, FileText } from 'lucide-svelte'

  let { data } = $props()

  // View toggle: 'stacks' (default) | 'list'
  let viewMode = $state<'list' | 'stacks'>('stacks')

  // Total card count including quantities
  const totalCount = $derived(data.cardEntries.reduce((s, e) => s + e.quantity, 0))

  // Build the metadata suffix for list view: e.g. "PF25 #1" or "PF25 #1 [ja]"
  function cardMeta(card: (typeof data.cardEntries)[number]['card']): string {
    const parts: string[] = []
    if (card.set_code) parts.push(card.set_code.toUpperCase())
    if (card.collector_number) parts.push(`#${card.collector_number}`)
    const lang = card.language?.toLowerCase()
    if (lang && lang !== 'en') parts.push(`[${lang}]`)
    return parts.join(' ')
  }
</script>

<svelte:head>
  <title>{data.set.set_name} — Sets — Group Buy</title>
  <meta
    name="description"
    content="Browse {totalCount} cards in {data.set.set_name}. Part of the Group Buy curated sets collection."
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
            <span>{totalCount} card{totalCount !== 1 ? 's' : ''}</span>
            {#if data.set.price != null}
              <span class="text-lg font-bold text-primary">
                ${Number(data.set.price).toFixed(2)}
              </span>
            {/if}
          </div>
        </div>
      </div>

      <!-- View mode toggle (only show if cards exist) -->
      {#if data.cardEntries.length > 0}
        <div class="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          <button
            id="view-toggle-stacks"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors {viewMode === 'stacks' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}"
            onclick={() => (viewMode = 'stacks')}
            aria-label="Stacks view"
          >
            <Layers class="h-3.5 w-3.5" />
            Stacks
          </button>
          <button
            id="view-toggle-list"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors {viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}"
            onclick={() => (viewMode = 'list')}
            aria-label="Plaintext list view"
          >
            <List class="h-3.5 w-3.5" />
            List
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Content -->
  {#if data.cardEntries.length === 0 && !data.set.card_list_text}
    <div class="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
      <Layers class="h-16 w-16 opacity-20 mb-4" />
      <h2 class="text-xl font-semibold mb-2">No cards in this set yet</h2>
      <p class="max-w-sm">Cards will appear here once the vendor associates them with this set.</p>
    </div>
  {:else if data.cardEntries.length === 0 && data.set.card_list_text}
    <!-- Plain text list fallback: no imported cards, but a text list is saved -->
    <div class="border rounded-xl overflow-hidden">
      <div class="px-4 py-2 bg-muted/40 border-b text-xs text-muted-foreground font-medium flex items-center gap-2">
        <FileText class="h-3.5 w-3.5" />
        {data.set.card_list_text.split('\n').filter((l) => l.trim()).length} cards
      </div>
      <ol class="divide-y divide-border">
        {#each data.set.card_list_text.split('\n').filter((l) => l.trim()) as line, i}
          <li class="flex items-baseline gap-3 px-4 py-2 hover:bg-muted/20 transition-colors">
            <span class="text-muted-foreground text-xs w-6 shrink-0 text-right tabular-nums select-none">{i + 1}</span>
            <span class="font-mono text-sm flex-1">{line}</span>
          </li>
        {/each}
      </ol>
    </div>
  {:else if viewMode === 'list'}
    <!-- Plaintext list: one row per unique card, quantity shown inline -->
    <div class="border rounded-xl overflow-hidden">
      <div class="px-4 py-2 bg-muted/40 border-b text-xs text-muted-foreground font-medium">
        {data.cardEntries.length} unique card{data.cardEntries.length !== 1 ? 's' : ''}
        {#if totalCount !== data.cardEntries.length}
          <span class="ml-1">({totalCount} total)</span>
        {/if}
      </div>
      <ol class="divide-y divide-border">
        {#each data.cardEntries as entry, i (entry.card.id ?? i)}
          <li class="flex items-baseline gap-3 px-4 py-2 text-sm hover:bg-muted/20 transition-colors">
            <span class="text-muted-foreground text-xs w-6 shrink-0 text-right tabular-nums">{i + 1}</span>
            <span class="font-medium flex-1">{entry.card.card_name ?? 'Unknown Card'}</span>
            {#if entry.quantity > 1}
              <span
                class="shrink-0 text-[10px] font-extrabold tabular-nums text-white rounded-full px-1.5 py-0.5 leading-none"
                style="background-color: #f59105;"
              >
                ×{entry.quantity}
              </span>
            {/if}
            {#if cardMeta(entry.card)}
              <span class="text-muted-foreground text-xs shrink-0 tabular-nums font-mono">
                {cardMeta(entry.card)}
              </span>
            {/if}
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    <!-- Stacks view: receives expanded array so count badge shows ×N automatically -->
    <StacksView cards={data.cards} />
  {/if}
</div>

