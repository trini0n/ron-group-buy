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
  let hoveredInfo = $state<{ setCode: string; idx: number } | null>(null)

  function isHov(setCode: string, idx: number): boolean {
    return (
      hoveredInfo !== null &&
      hoveredInfo.setCode === setCode &&
      hoveredInfo.idx === idx
    )
  }

  // The card immediately BELOW the hovered card (i === hoveredIdx + 1) gets
  // margin-top = 0 instead of -OVERLAP, which physically pushes it (and all
  // cards after it) downward — exposing the full hovered card above.
  function isPushedDown(setCode: string, idx: number): boolean {
    return (
      hoveredInfo !== null &&
      hoveredInfo.setCode === setCode &&
      hoveredInfo.idx === idx - 1
    )
  }

  // ── Z-index logic ───────────────────────────────────────────────────────
  //
  // Stacking model (matching Archidekt / physical deck metaphor):
  //   row[0]   = BACK  of deck, z=1  (only its top strip visible in normal state)
  //   row[N-1] = FRONT of deck, z=N  (fully visible at bottom of the layout)
  //
  // Hovered card: z = N+50 (renders above all others while it's fully exposed
  // by the slide-down of the card immediately below it).
  //
  function zIdx(col: Column, i: number): number {
    return isHov(col.setCode, i) ? col.rows.length + 50 : i + 1
  }

  // ── Margin-top per card ─────────────────────────────────────────────────
  //
  // Normal:      i=0 → '0',  i>0 → '-121.8%'  (standard overlap)
  // Slide-down:  i=hoveredIdx+1 → '0'           (full gap, exposes hovered card)
  //
  // CSS transition on margin-top in the template animates this change.
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

  // ── Set symbol filter ───────────────────────────────────────────────────
  // Scryfall set symbol SVGs are black on transparent background.
  // This filter chain converts black → #f59105 (amber):
  //   brightness(0)     → force pure black (ensure no grey stray pixels)
  //   invert(1)         → black becomes white
  //   sepia(1)          → white becomes warm near-yellow (255,255,239)
  //   saturate(3000%)   → push saturation to pure yellow (255,255,0)
  //   hue-rotate(335deg)→ rotate yellow(60°) by -25° → orange (35°) ≈ (255,149,0)
  //   brightness(0.96)  → slight dim → (245,143,0) ≈ #f58f00 ≈ #f59105
  const SET_SYMBOL_FILTER =
    'brightness(0) invert(1) sepia(1) saturate(3000%) hue-rotate(335deg) brightness(0.96)'
</script>

<!--
  Stacks View — Archidekt-style physical card deck layout
  ────────────────────────────────────────────────────────
  LAYOUT: CSS multi-column masonry (`columns-N` + `break-inside-avoid`).
  Groups flow top→bottom in each CSS column; shorter groups let new groups
  begin below them — the dynamic staggered layout from the reference screenshots.

  STACKING:
    Normal state  → all cards overlap with negative margin-top (-121.8%)
                    showing only the top 13% (name strip) of each card.
    Hover state   → hovered card z = N+50 (pops to front).
                    The card immediately below (idx = hovered+1) switches
                    margin-top from -121.8% to 0 via CSS transition (250ms).
                    This physically slides ALL lower cards down by one full
                    OVERLAP height, exposing the hovered card completely.
                    Un-hover reverses the animation smoothly.
-->

<div class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-x-4 gap-y-0">
  {#each columns as col (col.setCode)}
    <div class="break-inside-avoid mb-6 w-full">

      <!-- ── Column header ── -->
      <div class="flex items-start gap-1.5 mb-2 px-0.5">
        {#if col.setCode !== 'unknown'}
          <!--
            Set symbol: Scryfall serves at /sets/{code}.svg (NOT /card-symbols/).
            CSS filter chain tints the default black SVG to amber #f59105 for
            visibility on both light and dark backgrounds.
          -->
          <img
            src="https://svgs.scryfall.io/sets/{col.setCode}.svg"
            alt=""
            class="h-4 w-4 mt-0.5 shrink-0"
            aria-hidden="true"
            style="filter: {SET_SYMBOL_FILTER};"
            onerror={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
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
          {@const hov = isHov(col.setCode, i)}
          {@const zi  = zIdx(col, i)}
          {@const mt  = marginTop(col, i)}

          <a
            href={getCardUrl(row.card)}
            class="relative block w-full rounded-[10px] overflow-hidden"
            style="
              aspect-ratio: 2.5/3.5;
              margin-top: {mt};
              z-index: {zi};
              transition: margin-top 250ms cubic-bezier(0.4, 0, 0.2, 1),
                          box-shadow 180ms ease;
              box-shadow: {hov
                ? '0 20px 40px rgba(0,0,0,0.65), 0 0 0 2px hsl(var(--primary) / 0.85)'
                : '0 3px 8px rgba(0,0,0,0.45)'};
            "
            aria-label="{row.card.card_name ?? 'Card'}{row.count > 1 ? ` ×${row.count}` : ''}"
            onmouseenter={() => { hoveredInfo = { setCode: col.setCode, idx: i } }}
            onmouseleave={() => { hoveredInfo = null }}
            onfocus={() => { hoveredInfo = { setCode: col.setCode, idx: i } }}
            onblur={() => { hoveredInfo = null }}
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
