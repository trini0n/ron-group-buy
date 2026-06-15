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
  // Scryfall card name banner occupies ~12–13% from the top. 13% keeps the full
  // name bar visible at any column width.
  //
  // OVERLAP_MARGIN: negative margin-top as % of containing block WIDTH.
  //   card_height  = 1.4 × W  (2.5:3.5 aspect ratio)
  //   peek_height  = PEEK_FRACTION × 1.4 × W
  //   overlap      = (1 - PEEK_FRACTION) × 1.4 × W
  //   margin %     = overlap / W = (1 - PEEK_FRACTION) × 140
  //
  // At PEEK_FRACTION = 0.13:
  //   margin = (1 - 0.13) × 140 = 0.87 × 140 = 121.8% ≈ 121.8%
  const OVERLAP_MARGIN = '121.8%'

  // ── Data pipeline ───────────────────────────────────────────────────────

  interface Row {
    // Exact-match dedup key: set_code|collector_number|language|card_type (finish).
    // Cards share an entry ONLY when all four attributes are identical.
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
      // Sort by collector_number ascending (numeric-aware natural sort)
      const rows = [...dedup.values()].sort((a, b) =>
        collNumSort(a.card.collector_number, b.card.collector_number)
      )
      cols.push({ setCode: g.setCode, setName: g.setName, totalCount: g.cards.length, rows })
    }

    // 3. Sort columns: unknown last, rest alphabetically by setName (natural sort)
    cols.sort((a, b) => {
      if (a.setCode === 'unknown') return 1
      if (b.setCode === 'unknown') return -1
      return naturalSort(a.setName, b.setName)
    })

    return cols
  })

  // ── Hover state ─────────────────────────────────────────────────────────
  //
  // Single string state: "setCode::rowKey" when a card is hovered, null otherwise.
  //
  // This replaces the previous Map-based approach which caused a Svelte 5 runtime
  // error ("can't access property 'prev', C is undefined") when switching between
  // view modes. The Map mutation was creating stale reactive signal references
  // that Svelte's signal graph couldn't resolve after component remount.
  //
  let hoveredCard = $state<string | null>(null)

  function isHov(setCode: string, rowKey: string): boolean {
    return hoveredCard === `${setCode}::${rowKey}`
  }

  function onEnter(setCode: string, rowKey: string) {
    hoveredCard = `${setCode}::${rowKey}`
  }

  function onLeave() {
    hoveredCard = null
  }

  // ── Z-index logic ───────────────────────────────────────────────────────
  //
  // row[0]   = BACK of physical stack (z=1) — only its top strip visible
  // row[N-1] = FRONT of physical stack (z=N) — fully visible at the bottom
  // On hover: z jumps to N+50, card pops to full view.
  //
  function zIdx(col: Column, i: number, row: Row): number {
    return isHov(col.setCode, row.key) ? col.rows.length + 50 : i + 1
  }

  // ── Image resolution ────────────────────────────────────────────────────
  // Stacks view uses Scryfall images only.
  function resolveImg(c: Card): string {
    if (c.scryfall_id) return getScryfallImageUrl(c.scryfall_id, 'normal')
    return '/images/card-placeholder.png'
  }
</script>

<!--
  Stacks View — Archidekt-style physical card deck layout
  ────────────────────────────────────────────────────────
  LAYOUT: CSS multi-column masonry (Tailwind `columns-N` with `break-inside-avoid`).
  Groups flow top→bottom within each CSS column. Shorter groups allow new groups
  to start below them in the same column — the dynamic Archidekt-style layout.

  STACKING MECHANIC: Normal CSS flow with negative margin-top creates the overlap.
    • row[0] (DOM first)  → z=1  (back  — top strip only visible)
    • row[N-1] (DOM last) → z=N  (front — fully visible at bottom of layout)
    • Hover on any card   → z=N+50, full card art pops to front
  The 121.8% margin is derived from aspect ratio 2.5:3.5 and PEEK_FRACTION=0.13,
  keeping the card name area (top ~13% of Scryfall images) visible at any width.
-->

<div class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-x-4 gap-y-0">
  {#each columns as col (col.setCode)}
    <!--
      Each expansion group is a masonry block.
      `break-inside-avoid` prevents splitting across CSS columns.
    -->
    <div class="break-inside-avoid mb-6 w-full">

      <!-- ── Column header ── -->
      <div class="flex items-start gap-1.5 mb-2 px-0.5">
        {#if col.setCode !== 'unknown'}
          <!--
            Set symbol: Scryfall serves SVGs at /sets/{code}.svg
            (NOT /card-symbols/ — that path is for mana/tap symbols)
          -->
          <img
            src="https://svgs.scryfall.io/sets/{col.setCode}.svg"
            alt=""
            class="h-4 w-4 mt-0.5 shrink-0 opacity-80"
            aria-hidden="true"
            onerror={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        {/if}
        <div class="min-w-0 flex-1">
          <!-- break-words instead of truncate: long set names wrap instead of clip -->
          <p class="text-xs font-bold uppercase tracking-wide break-words leading-tight">
            {col.setName}
          </p>
          <p class="text-[10px] text-muted-foreground tabular-nums">
            {col.totalCount} card{col.totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <!-- ── Card stack ── -->
      <div class="relative">
        {#each col.rows as row, i (row.key)}
          {@const hov = isHov(col.setCode, row.key)}
          {@const zi = zIdx(col, i, row)}

          <!--
            Each card is a stacking entry. margin-top creates the overlap;
            z-index determines paint order.

            BADGE POSITION NOTE:
            The count badge is at top-1 left-1 (4px from corner), which lands
            within the card's decorative frame border — the dark area at the very
            top of Scryfall card images BEFORE the card name text starts (~13% in).
            At any column width, this keeps the badge out of the name text area.
          -->
          <a
            href={getCardUrl(row.card)}
            class="relative block w-full rounded-[10px] overflow-hidden transition-shadow duration-150"
            style="
              aspect-ratio: 2.5/3.5;
              margin-top: {i === 0 ? '0' : `-${OVERLAP_MARGIN}`};
              z-index: {zi};
              box-shadow: {hov
                ? '0 16px 36px rgba(0,0,0,0.6), 0 0 0 2px hsl(var(--primary) / 0.85)'
                : '0 3px 8px rgba(0,0,0,0.45)'};
            "
            aria-label="{row.card.card_name ?? 'Card'}{row.count > 1 ? ` ×${row.count}` : ''}"
            onmouseenter={() => onEnter(col.setCode, row.key)}
            onmouseleave={onLeave}
            onfocus={() => onEnter(col.setCode, row.key)}
            onblur={onLeave}
          >
            <!-- Scryfall card image fills the entire card -->
            <img
              src={resolveImg(row.card)}
              alt={row.card.card_name ?? 'Card'}
              class="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              draggable="false"
            />

            <!--
              Count badge: only shown when there are 2+ EXACT duplicates
              (identical set_code + collector_number + language + finish).

              Positioned at top-1 left-1 (4px) = within the card frame border
              area, below the card's decorative top frame but above where the
              actual name text begins (≥13% from top on Scryfall images).
              overflow:hidden on the parent <a> clips it to the rounded corner.
            -->
            {#if row.count > 1}
              <div
                class="absolute top-1 left-1 z-10
                       bg-black/85 text-white text-[9px] font-bold leading-none
                       w-[15px] h-[15px] rounded-full
                       flex items-center justify-center
                       shadow-md tabular-nums border border-white/25"
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
