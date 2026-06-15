<script lang="ts">
  import type { Card } from '$lib/server/types'
  import { getScryfallImageUrl, getCardUrl } from '$lib/utils'

  interface Props {
    cards: Card[]
  }

  let { cards }: Props = $props()

  // ── Stacking constants ──────────────────────────────────────────────────
  //
  // PEEK_FRACTION: fraction of card height visible as the "peek strip."
  // 13% of the card height captures the full name banner on Scryfall images.
  //
  // OVERLAP: the negative margin-top (as % of containing block WIDTH) that
  // creates the physical overlap between cards:
  //   card_height  = 1.4 × W      (from 2.5:3.5 aspect ratio)
  //   peek_height  = 0.13 × 1.4W  = 0.182W
  //   overlap      = 1.4W - 0.182W = 1.218W
  //   OVERLAP%     = 121.8%
  //
  const OVERLAP = '121.8%'

  // ── Data pipeline ───────────────────────────────────────────────────────

  interface Row {
    // Exact-match dedup key: set_code|collector_number|language|card_type
    // Cards share an entry ONLY when all four attributes match.
    key: string
    card: Card
    count: number
  }

  interface Column {
    setCode: string
    setName: string
    totalCount: number
    rows: Row[]
  }

  function naturalSort(a: string, b: string): number {
    const re = /(\d+)|(\D+)/g
    const ta = a.match(re) ?? [], tb = b.match(re) ?? []
    const len = Math.max(ta.length, tb.length)
    for (let i = 0; i < len; i++) {
      const sa = ta[i] ?? '', sb = tb[i] ?? ''
      const na = parseInt(sa, 10), nb = parseInt(sb, 10)
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
      const c = sa.localeCompare(sb)
      if (c) return c
    }
    return 0
  }

  function collNumSort(a: string | null, b: string | null): number {
    const na = parseInt(a ?? '', 10), nb = parseInt(b ?? '', 10)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return (a ?? '').localeCompare(b ?? '')
  }

  const columns = $derived.by<Column[]>(() => {
    // 1. Group cards by expansion set_code
    const map = new Map<string, { setCode: string; setName: string; cards: Card[] }>()
    for (const c of cards) {
      const sc = (c.set_code ?? '').toLowerCase() || 'unknown'
      const sn = c.set_name ?? (sc === 'unknown' ? 'Unknown Set' : sc.toUpperCase())
      if (!map.has(sc)) map.set(sc, { setCode: sc, setName: sn, cards: [] })
      map.get(sc)!.cards.push(c)
    }

    // 2. Deduplicate by exact match (set_code|collector_number|language|card_type)
    const cols: Column[] = []
    for (const [, g] of map) {
      const dedup = new Map<string, Row>()
      for (const c of g.cards) {
        const key = [
          c.set_code ?? '',
          c.collector_number ?? '',
          c.language ?? '',
          c.card_type ?? ''
        ].join('|')
        const ex = dedup.get(key)
        if (ex) ex.count++
        else dedup.set(key, { key, card: c, count: 1 })
      }
      // Sort by collector_number ascending (numeric-aware)
      const rows = [...dedup.values()].sort((a, b) =>
        collNumSort(a.card.collector_number, b.card.collector_number)
      )
      cols.push({
        setCode: g.setCode,
        setName: g.setName,
        totalCount: g.cards.length,
        rows
      })
    }

    // 3. Sort columns: unknown last, rest by setName (natural sort)
    cols.sort((a, b) => {
      if (a.setCode === 'unknown') return 1
      if (b.setCode === 'unknown') return -1
      return naturalSort(a.setName, b.setName)
    })

    return cols
  })

  // ── Hover state ─────────────────────────────────────────────────────────
  //
  // Tracks the currently hovered card by { setCode, idx }.
  // Using idx (not key) so we can check idx === hoveredIdx + 1 cheaply —
  // that card gets its margin-top changed to produce the slide-down animation.
  //
  // The 500ms debounce (hoverTimer) prevents the animation from firing when
  // a user quickly sweeps over many cards. The timer is cancelled immediately
  // on mouseleave so the animation never queues up multiple times.
  // The box-shadow / glow is handled by pure CSS :hover (no JS delay).
  //
  let hoveredInfo = $state<{ setCode: string; idx: number } | null>(null)
  let hoverTimer: ReturnType<typeof setTimeout> | null = null

  // Tracks which set codes returned a 404 for their symbol image.
  // On error, the img is swapped for an inline SVG fallback.
  // Using a plain $state object (not Set) so property assignment triggers reactivity.
  let symbolErrors = $state<Record<string, true>>({})

  // ── Fixed column layout ──────────────────────────────────────────────────
  //
  // CSS `columns` layout rebalances column heights whenever any group grows
  // (e.g. on hover expand), causing groups to jump between columns and breaking
  // the expanded hover state.
  //
  // Fix: pre-assign each column group to a fixed layout column using a greedy
  // bin-packing algorithm (assign each group to the shortest column). Once
  // assigned, groups never move — hover animations cannot trigger reflow.
  //
  // numCols mirrors the Tailwind responsive breakpoints:
  //   default → 2 cols   (< 640px)
  //   sm      → 3 cols   (≥ 640px)
  //   lg      → 4 cols   (≥ 1024px)
  //   xl      → 5 cols   (≥ 1280px)
  //
  let numCols = $state(2)

  $effect(() => {
    function update() {
      if (window.innerWidth >= 1280)      numCols = 5
      else if (window.innerWidth >= 1024) numCols = 4
      else if (window.innerWidth >= 640)  numCols = 3
      else                                numCols = 2
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  })

  // Distribute column groups into numCols fixed layout columns.
  // Each group goes to whichever layout column has the fewest cards so far
  // (greedy shortest-column-first). Re-runs only when the data or numCols
  // changes — NOT on hover state changes.
  const distributedCols = $derived.by<Column[][]>(() => {
    const result: Column[][] = Array.from({ length: numCols }, () => [])
    const heights = new Array<number>(numCols).fill(0)
    for (const col of columns) {
      let minIdx = 0
      for (let i = 1; i < numCols; i++) {
        if (heights[i] < heights[minIdx]) minIdx = i
      }
      result[minIdx].push(col)
      heights[minIdx] += col.rows.length
    }
    return result
  })

  function onEnter(setCode: string, idx: number) {
    // Cancel any in-flight timer (user moved to a new card before 500ms elapsed)
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
    // Wait 500ms before activating the slide-down — avoids animation queue overload
    hoverTimer = setTimeout(() => {
      hoveredInfo = { setCode, idx }
      hoverTimer = null
    }, 75)
  }

  function onLeave() {
    // Immediately cancel any pending activation
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
    // Immediately reverse the animation (no delay on exit)
    hoveredInfo = null
  }

  // Clean up the timer if the component is destroyed while a hover is pending
  $effect(() => {
    return () => {
      if (hoverTimer !== null) clearTimeout(hoverTimer)
    }
  })

  // The card immediately BELOW the hovered card (i === hoveredIdx + 1) gets
  // margin-top = 0 instead of -OVERLAP, physically pushing it (and all cards
  // below it) downward to expose the full hovered card above.
  function isPushedDown(setCode: string, idx: number): boolean {
    return (
      hoveredInfo !== null &&
      hoveredInfo.setCode === setCode &&
      hoveredInfo.idx === idx - 1
    )
  }

  // ── Margin-top per card ─────────────────────────────────────────────────
  //
  // Normal:     i=0  → '0'         (first card, no overlap needed)
  //             i>0  → '-121.8%'   (standard overlap, peek strip only visible)
  // Slide-down: i=hoveredIdx+1 → '0'  (gap opens, exposes full card above)
  //
  // The CSS `transition: margin-top` on every card animates this change.
  // No z-index manipulation needed: the cards below physically move away
  // and the hovered card is revealed through the natural DOM stack order.
  //
  function marginTop(col: Column, i: number): string {
    if (i === 0) return '0'
    if (isPushedDown(col.setCode, i)) return '0'
    return `-${OVERLAP}`
  }

  // ── Image resolution ────────────────────────────────────────────────────
  function resolveImg(c: Card): string {
    if (c.scryfall_id) return getScryfallImageUrl(c.scryfall_id, 'normal')
    return '/images/card-placeholder.png'
  }
</script>

<!--
  Stacks View — Archidekt-style physical card deck layout
  ────────────────────────────────────────────────────────
  LAYOUT: JS-assigned fixed flex columns.
  Groups are distributed into N layout columns via greedy bin-packing
  (shortest-column-first by card count) at render time, then locked.
  Hover animations expand card stacks within a column but can never
  trigger a layout reflow that moves groups to another column.
  numCols mirrors Tailwind sm/lg/xl breakpoints via a resize listener.

  STACKING:
    Normal     → all cards overlap with margin-top: -121.8%, showing only
                 the top 13% (name strip) of each card as a peek strip.
    Hover      → after a 75ms debounce, the card immediately below
                 (idx = hoveredIdx+1) switches margin-top: -121.8% → 0 via
                 CSS transition (250ms ease). This physically slides ALL lower
                 cards down, progressively revealing the hovered card.
                 No z-index pop: the cards slide fully away.
    Un-hover   → immediately clears hoveredInfo, transition reverses (250ms).
    Box-shadow → pure CSS :hover (no JS delay — immediate feedback).
-->

<style>
  /*
    Immediate visual feedback on hover (no 500ms delay).
    Amber outline (#f59105) matches the set symbol / badge color.
    The slide-down animation is JS-debounced; this glow is CSS-native.
  */
  .stack-card {
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
  }
  .stack-card:hover {
    box-shadow:
      0 16px 36px rgba(0, 0, 0, 0.6),
      0 0 0 2px rgba(245, 145, 5, 0.8);
  }
</style>

<!--
  Outer wrapper: a fixed flex row of numCols layout columns.
  Each layout column is a flex-col that holds its pre-assigned set groups.
  Because groups are statically assigned (not flowed), hover-induced height
  changes in one column cannot displace groups in other columns.
-->
<div class="flex gap-x-4 items-start">
  {#each distributedCols as colGroup, _colIdx}
    <div class="flex flex-col gap-y-6 flex-1 min-w-0">
      {#each colGroup as col (col.setCode)}
        <div class="w-full">

      <!-- ── Column header ── -->
      <div class="flex items-start gap-1.5 mb-2 px-0.5">
        {#if col.setCode !== 'unknown'}
          <!--
            Set symbol: Scryfall serves at /sets/{code}.svg (NOT /card-symbols/).
            dark:invert — light mode keeps the original black SVG; dark mode
            applies filter:invert(1) turning it white so it’s visible on dark
            backgrounds. Simple, accurate, no CSS filter math required.
            On 404 (e.g. SLD and promotional sets), swap to the inline
            shooting-star fallback SVG. fill="currentColor" lets it inherit
            the text colour naturally in both light and dark mode.
          -->
          {#if symbolErrors[col.setCode]}
            <!-- Shooting-star fallback (shown when Scryfall set symbol 404s) -->
            <svg
              viewBox="0 0 1024 1024"
              class="h-4 w-4 mt-0.5 shrink-0"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M279.151 423.97s124.892-65.304 281.136-65.304c210.033 0 425.863 116.408 462.788 312.323 0 0-110.775-283.943-451.499-283.943-153.271 0-241.3 65.304-241.3 65.304l124.892 2.889-167.472 39.67 102.229 107.885-130.609-73.788 31.208 147.637-68.134-124.892-90.856 164.707 53.932-184.542L.924 574.414l173.169-85.139-110.691-96.596 133.436 56.842-17.007-113.601 53.932 107.947L307.53 307.54l-28.38 116.429z" />
            </svg>
          {:else}
            <img
              src="https://svgs.scryfall.io/sets/{col.setCode}.svg"
              alt=""
              class="h-4 w-4 mt-0.5 shrink-0 dark:invert"
              aria-hidden="true"
              onerror={() => {
                symbolErrors[col.setCode] = true
              }}
            />
          {/if}
        {/if}
        <div class="min-w-0 flex-1">
          <!-- break-words: long set names wrap instead of truncating -->
          <p class="text-xs font-bold uppercase tracking-wide break-words leading-tight">
            {col.setName}
          </p>
          <p class="text-[10px] text-muted-foreground tabular-nums">
            {col.totalCount} card{col.totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <!-- ── Card stack ── -->
      <!--
        Normal-flow stack with negative margin-top for overlap.
        Each card's `margin-top` is individually computed; the CSS
        `transition: margin-top` on every card means any change animates.

        Hover sequence:
          1. Mouse enters card[i] → hoveredInfo = { setCode, idx: i }
          2. card[i].z-index = N+50 (immediately on top of all others)
          3. card[i+1].margin-top: -121.8% → 0  (CSS transition 250ms)
          4. card[i+1] and all cards below slide down, exposing card[i] fully
          5. Mouse leaves → hoveredInfo = null; slide reverses (250ms)
      -->
      <div class="relative">
        {#each col.rows as row, i (row.key)}
          {@const mt = marginTop(col, i)}

          <a
            href={getCardUrl(row.card)}
            class="stack-card relative block w-full rounded-[10px] overflow-hidden"
            style="
              aspect-ratio: 2.5/3.5;
              margin-top: {mt};
              z-index: {i + 1};
              transition: margin-top 250ms cubic-bezier(0.4, 0, 0.2, 1);
            "
            aria-label="{row.card.card_name ?? 'Card'}{row.count > 1 ? ` ×${row.count}` : ''}"
            onmouseenter={() => onEnter(col.setCode, i)}
            onmouseleave={onLeave}
            onfocus={() => onEnter(col.setCode, i)}
            onblur={onLeave}
          >
            <!-- Scryfall card image -->
            <img
              src={resolveImg(row.card)}
              alt={row.card.card_name ?? 'Card'}
              class="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              draggable="false"
            />

            <!--
              Count badge: shown when there are 2+ exact duplicates
              (same set_code + collector_number + language + finish).

              Amber (#f59105) background: visible against any card art, consistent
              with the set symbol tint color. Positioned at top-1 left-1 (4px) —
              within the card's decorative frame border area, which sits above
              the name text (~13% from top on Scryfall images).
            -->
            {#if row.count > 1}
              <div
                class="absolute top-1 left-1 z-10
                       text-white text-[10px] font-extrabold leading-none
                       min-w-[18px] h-[18px] rounded-full
                       flex items-center justify-center px-1
                       shadow-lg tabular-nums"
                style="background-color: #f59105; border: 1.5px solid rgba(255,255,255,0.35);"
              >
                {row.count}
              </div>
            {/if}
          </a>
        {/each}
      </div>

        </div>
      {/each}
    </div>
  {/each}
</div>
