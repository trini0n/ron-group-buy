<script lang="ts">
  import type { Card } from '$lib/server/types'
  import { getRonImageUrl, getScryfallImageUrl, getCardUrl } from '$lib/utils'
  import { ChevronDown } from 'lucide-svelte'

  interface Props {
    cards: Card[]
  }

  let { cards }: Props = $props()

  // ─── Data pipeline ────────────────────────────────────────────────────────

  interface Row {
    key: string    // card_name + '|' + card_type (dedup key)
    card: Card     // representative card (first occurrence)
    count: number  // number of copies with same name + finish
  }

  interface Column {
    setCode: string   // lowercase, for Scryfall SVG URL
    setName: string   // display name
    totalCount: number
    rows: Row[]
  }

  /** Numeric-aware sort on collector_number */
  function collectorNumberSort(a: string | null, b: string | null): number {
    const na = parseInt(a ?? '', 10)
    const nb = parseInt(b ?? '', 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return (a ?? '').localeCompare(b ?? '')
  }

  /** Natural sort on arbitrary strings (handles e.g. "Set 5" vs "Set 42") */
  function naturalSort(a: string, b: string): number {
    const re = /(\d+)|(\D+)/g
    const tokensA = a.match(re) ?? []
    const tokensB = b.match(re) ?? []
    const len = Math.max(tokensA.length, tokensB.length)
    for (let i = 0; i < len; i++) {
      const ta = tokensA[i] ?? ''
      const tb = tokensB[i] ?? ''
      const na = parseInt(ta, 10)
      const nb = parseInt(tb, 10)
      if (!isNaN(na) && !isNaN(nb)) {
        if (na !== nb) return na - nb
      } else {
        const cmp = ta.localeCompare(tb)
        if (cmp !== 0) return cmp
      }
    }
    return 0
  }

  /** Build columns from card list */
  const columns = $derived.by<Column[]>(() => {
    // 1. Group cards by expansion set_code
    const groupMap = new Map<string, { setCode: string; setName: string; cards: Card[] }>()

    for (const card of cards) {
      const sc = (card.set_code ?? '').toLowerCase() || 'unknown'
      const sn = card.set_name ?? (sc === 'unknown' ? 'Unknown Set' : sc.toUpperCase())
      if (!groupMap.has(sc)) {
        groupMap.set(sc, { setCode: sc, setName: sn, cards: [] })
      }
      groupMap.get(sc)!.cards.push(card)
    }

    // 2. For each group: deduplicate, sort rows
    const cols: Column[] = []
    for (const [, group] of groupMap) {
      const dedupMap = new Map<string, Row>()

      for (const card of group.cards) {
        const key = `${card.card_name ?? ''}|${card.card_type ?? ''}`
        const existing = dedupMap.get(key)
        if (existing) {
          existing.count++
        } else {
          dedupMap.set(key, { key, card, count: 1 })
        }
      }

      // Sort rows by collector_number (numeric-aware)
      const rows = [...dedupMap.values()].sort((a, b) =>
        collectorNumberSort(a.card.collector_number, b.card.collector_number)
      )

      cols.push({
        setCode: group.setCode,
        setName: group.setName,
        totalCount: group.cards.length,
        rows
      })
    }

    // 3. Sort columns: Unknown Set last, rest by setName (natural sort)
    cols.sort((a, b) => {
      if (a.setCode === 'unknown') return 1
      if (b.setCode === 'unknown') return -1
      return naturalSort(a.setName, b.setName)
    })

    return cols
  })

  // ─── Per-column state ──────────────────────────────────────────────────────

  interface ColState {
    expandedKey: string | null  // which row image is expanded
    collapsed: boolean          // mobile accordion collapsed
  }

  let colStates = $state<Map<string, ColState>>(new Map())

  /** Get or initialise state for a column */
  function getColState(setCode: string): ColState {
    if (!colStates.has(setCode)) {
      colStates.set(setCode, { expandedKey: null, collapsed: false })
    }
    return colStates.get(setCode)!
  }

  function toggleExpand(setCode: string, key: string) {
    const state = getColState(setCode)
    state.expandedKey = state.expandedKey === key ? null : key
    colStates = new Map(colStates) // trigger reactivity
  }

  function toggleCollapse(setCode: string) {
    const state = getColState(setCode)
    state.collapsed = !state.collapsed
    colStates = new Map(colStates)
  }

  // ─── Image resolution ─────────────────────────────────────────────────────

  // Track cards whose ron image has failed (keyed by card id)
  let ronImageFailed = $state<Set<string>>(new Set())

  function resolveImage(card: Card): string {
    const ron = getRonImageUrl(card.ron_image_url)
    if (ron && !ronImageFailed.has(card.id)) return ron
    if (card.scryfall_id) return getScryfallImageUrl(card.scryfall_id, 'normal')
    return '/images/card-placeholder.png'
  }

  function handleRonError(card: Card) {
    ronImageFailed = new Set([...ronImageFailed, card.id])
  }
</script>

<!--
  StacksView — Archidekt-style column layout
  Desktop: horizontal scrollable columns side-by-side
  Mobile:  vertical accordion (each column header toggles its card list)
-->

<!-- Outer scroll wrapper (desktop horizontal, mobile vertical) -->
<div
  class="flex flex-col gap-3 sm:flex-row sm:gap-0 sm:overflow-x-auto
         sm:border sm:rounded-xl sm:overflow-hidden"
>
  {#each columns as col (col.setCode)}
    {@const state = getColState(col.setCode)}

    <!-- Column wrapper -->
    <div
      class="flex flex-col border rounded-xl overflow-hidden
             sm:rounded-none sm:border-y-0 sm:border-l-0 sm:border-r
             sm:last:border-r-0 sm:w-[240px] sm:min-w-[200px] sm:max-w-[280px] sm:shrink-0"
    >
      <!-- Column header — doubles as accordion toggle on mobile -->
      <button
        class="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/40 hover:bg-muted/60
               transition-colors text-left border-b sm:cursor-default"
        onclick={() => toggleCollapse(col.setCode)}
        aria-expanded={!state.collapsed}
        aria-controls="stack-col-{col.setCode}"
      >
        <!-- Scryfall set icon (hidden on error) -->
        {#if col.setCode !== 'unknown'}
          <img
            src="https://svgs.scryfall.io/card-symbols/{col.setCode}.svg"
            alt=""
            class="h-4 w-4 shrink-0"
            aria-hidden="true"
            onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        {/if}

        <!-- Set name -->
        <span class="font-semibold text-sm truncate flex-1 text-left">{col.setName}</span>

        <!-- Card count pill -->
        <span
          class="shrink-0 text-xs text-muted-foreground bg-background border
                 rounded-full px-2 py-0.5 tabular-nums"
        >
          {col.totalCount}
        </span>

        <!-- Chevron — visible only on mobile -->
        <ChevronDown
          class="h-4 w-4 text-muted-foreground sm:hidden transition-transform duration-200
                 {state.collapsed ? '-rotate-90' : ''}"
        />
      </button>

      <!-- Card list — accordion-aware on mobile, always visible on desktop -->
      <div
        id="stack-col-{col.setCode}"
        class="{state.collapsed ? 'hidden' : 'block'} sm:block sm:flex-1 sm:overflow-y-auto"
      >
        {#each col.rows as row (row.key)}
          {@const isExpanded = state.expandedKey === row.key}

          <!-- Compact card row -->
          <button
            class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b last:border-b-0
                   hover:bg-accent/40 transition-colors
                   {isExpanded ? 'bg-accent/50' : ''}"
            onclick={() => toggleExpand(col.setCode, row.key)}
            aria-expanded={isExpanded}
          >
            <span class="flex-1 truncate leading-snug">{row.card.card_name ?? 'Unknown'}</span>
            {#if row.count > 1}
              <span
                class="shrink-0 text-xs font-mono text-muted-foreground
                       bg-muted px-1.5 py-0.5 rounded tabular-nums"
              >
                ×{row.count}
              </span>
            {/if}
          </button>

          <!-- Inline image expand -->
          {#if isExpanded}
            <div class="px-3 py-2.5 border-b bg-card">
              <a
                href={getCardUrl(row.card)}
                class="block"
                aria-label="View {row.card.card_name ?? 'card'} detail"
              >
                <img
                  src={resolveImage(row.card)}
                  alt={row.card.card_name ?? 'Card'}
                  class="w-full rounded-lg shadow-md object-cover
                         aspect-[2.5/3.5] hover:opacity-90 transition-opacity"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror={() => handleRonError(row.card)}
                />
              </a>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>
