<script lang="ts">
  import type { Card } from '$lib/server/types'
  import { getScryfallImageUrl, getCardUrl } from '$lib/utils'

  interface Props {
    cards: Card[]
  }

  let { cards }: Props = $props()

  // ── Stacking constants ──────────────────────────────────────────────────
  //
  // PEEK_FRACTION: how much of the card height is visible as the "peek strip".
  // Scryfall card name banner occupies ~12–13% of the card height from the top.
  // We set 12.5% so the name area is just visible.
  //
  // OVERLAP_MARGIN: the negative margin-top (as % of containing block WIDTH)
  //   that creates the overlap. Derived from:
  //     card_height = 1.4 × card_width  (from 2.5:3.5 aspect ratio)
  //     peek_height = PEEK_FRACTION × card_height = PEEK_FRACTION × 1.4 × W
  //     overlap     = card_height - peek_height = (1 - PEEK_FRACTION) × 1.4 × W
  //     margin %    = overlap / W = (1 - PEEK_FRACTION) × 1.4 × 100
  //
  // At PEEK_FRACTION = 0.125:
  //   margin = (1 - 0.125) × 1.4 × 100 = 0.875 × 140 = 122.5%
  const OVERLAP_MARGIN = '122.5%'

  // ── Data pipeline ───────────────────────────────────────────────────────

  interface Row {
    // Exact-match dedup key: set_code|collector_number|language|card_type (finish).
    // Cards are only deduplicated if ALL FOUR attributes are identical.
    key: string
    card: Card
    count: number
  }

  interface Column {
    setCode: string   // lowercase expansion code (e.g. "mh3")
    setName: string   // display name (e.g. "Modern Horizons 3")
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
    // 1. Group by expansion set_code
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
      // Sort rows by collector_number (numeric-aware)
      const rows = [...dedup.values()].sort((a, b) =>
        collNumSort(a.card.collector_number, b.card.collector_number)
      )
      cols.push({ setCode: g.setCode, setName: g.setName, totalCount: g.cards.length, rows })
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
  // Per-column: which row key is currently hovered (null = none).
  let hoveredKey = $state<Map<string, string | null>>(new Map())

  function getHov(sc: string): string | null {
    return hoveredKey.get(sc) ?? null
  }

  function setHov(sc: string, key: string | null) {
    hoveredKey = new Map(hoveredKey).set(sc, key)
  }

  // ── Z-index logic ───────────────────────────────────────────────────────
  //
  // Card stacking z-index model:
  //   row[0]   = BOTTOM of physical stack (z=1, lowest) — only its top strip is visible
  //   row[N-1] = TOP of physical stack (z=N, highest) — fully visible at the bottom of the layout
  //
  // This matches screenshot 1: each card shows its TOP strip (card name area),
  // and the LAST card in the list is fully visible beneath all others.
  //
  // On hover: z-index jumps to N+50 → card pops to front, full art visible.
  //
  function zIdx(col: Column, i: number, row: Row): number {
    const isHov = getHov(col.setCode) === row.key
    return isHov ? col.rows.length + 50 : i + 1
  }

  // ── Image resolution ────────────────────────────────────────────────────
  // Stacks view uses Scryfall images only (vendor/Ron images not used here).
  function resolveImg(c: Card): string {
    if (c.scryfall_id) return getScryfallImageUrl(c.scryfall_id, 'normal')
    return '/images/card-placeholder.png'
  }
</script>

<!--
  Stacks View — Archidekt-style physical card deck layout
  ────────────────────────────────────────────────────────
  LAYOUT: CSS multi-column masonry (Tailwind `columns-N`).
  Each expansion group is a `break-inside-avoid` block that flows top→bottom
  within each CSS column. Shorter groups allow new groups to appear below them
  in the same column, replicating the dynamic staggered layout from the reference.

  STACKING MECHANIC:
  Cards use `position: relative` with `margin-top: -122.5%` (negative overlap).
  This creates overlapping card images in normal CSS flow (no absolute positioning).
  z-index increases with DOM order: row[0] = z:1 (back), row[N-1] = z:N (front/visible).
  Hover raises z-index to N+50, popping any card to full view.

  The 122.5% overlap margin is derived from the 2.5:3.5 card aspect ratio and
  a 12.5% peek fraction, ensuring the card name at the top of each Scryfall
  image remains visible in the peek strip at any column width.
-->

<div class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-x-4 gap-y-0">
  {#each columns as col (col.setCode)}
    <!--
      Each expansion group is a self-contained masonry block.
      `break-inside-avoid` prevents the group from being split across CSS columns.
      `mb-6` adds space between groups stacked in the same CSS column.
    -->
    <div class="break-inside-avoid mb-6 w-full">

      <!-- ── Column header ── -->
      <div class="flex items-start gap-1.5 mb-2 px-0.5">
        {#if col.setCode !== 'unknown'}
          <img
            src="https://svgs.scryfall.io/card-symbols/{col.setCode}.svg"
            alt=""
            class="h-4 w-4 mt-0.5 shrink-0 opacity-80"
            aria-hidden="true"
            onerror={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        {/if}
        <div class="min-w-0 flex-1">
          <p class="text-xs font-bold uppercase tracking-wide truncate leading-tight">
            {col.setName}
          </p>
          <p class="text-[10px] text-muted-foreground tabular-nums">
            {col.totalCount} card{col.totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <!-- ── Card stack ── -->
      <!--
        Normal-flow stack using negative margin-top.
        row[0] is first in DOM (bottom of physical stack, z=1).
        row[N-1] is last in DOM (top of physical stack, z=N, fully visible).
        Each card's top strip (card name area ≈ 12.5% of card height) is visible
        beneath the card above it.
      -->
      <div class="relative">
        {#each col.rows as row, i (row.key)}
          {@const isHov = getHov(col.setCode) === row.key}

          <a
            href={getCardUrl(row.card)}
            class="relative block w-full transition-all duration-150 rounded-[10px] overflow-hidden"
            style="
              aspect-ratio: 2.5/3.5;
              position: relative;
              margin-top: {i === 0 ? '0' : `-${OVERLAP_MARGIN}`};
              z-index: {zIdx(col, i, row)};
              box-shadow: {isHov
                ? '0 16px 32px rgba(0,0,0,0.55), 0 0 0 2px hsl(var(--primary) / 0.8)'
                : '0 3px 8px rgba(0,0,0,0.4)'};
            "
            aria-label="{row.card.card_name ?? 'Card'}{row.count > 1 ? ` ×${row.count}` : ''}"
            onmouseenter={() => setHov(col.setCode, row.key)}
            onmouseleave={() => setHov(col.setCode, null)}
            onfocus={() => setHov(col.setCode, row.key)}
            onblur={() => setHov(col.setCode, null)}
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
              Count badge — top-left corner, only when >1 exact duplicate
              (same set_code + collector_number + language + card_type/finish).
            -->
            {#if row.count > 1}
              <div
                class="absolute top-[5%] left-[4%] z-10
                       bg-black/80 text-white text-[10px] font-bold leading-none
                       min-w-[18px] h-[18px] rounded-full
                       flex items-center justify-center px-1
                       shadow tabular-nums"
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
