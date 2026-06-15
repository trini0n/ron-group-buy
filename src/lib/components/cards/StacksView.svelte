<script lang="ts">
  import type { Card } from '$lib/server/types'
  import { getRonImageUrl, getScryfallImageUrl, getCardUrl } from '$lib/utils'

  interface Props {
    cards: Card[]
  }

  let { cards }: Props = $props()

  // ── Layout constants ────────────────────────────────────────────────────
  // Fixed column width drives all pixel math for the stacking effect.
  const COL_W = 220          // px — each column is this wide
  const CARD_H = Math.round(COL_W * 3.5 / 2.5) // 308px at 2.5:3.5 aspect ratio
  const PEEK_PX = 52         // px of each card's bottom strip that shows behind the card above
  const MAX_COLS = 5

  // ── Data pipeline ───────────────────────────────────────────────────────

  interface Row {
    key: string      // dedup key: card_name + '|' + card_type
    card: Card       // representative card (first occurrence)
    count: number    // copies with same name + finish
  }

  interface Column {
    setCode: string   // lowercase — used for Scryfall SVG icon
    setName: string   // display label
    totalCount: number
    rows: Row[]       // sorted by collector_number asc; row[0] = top of stack (fully visible)
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
    // 1. Group by MTG expansion (set_code on the card)
    const map = new Map<string, { setCode: string; setName: string; cards: Card[] }>()
    for (const c of cards) {
      const sc = (c.set_code ?? '').toLowerCase() || 'unknown'
      const sn = c.set_name ?? (sc === 'unknown' ? 'Unknown Set' : sc.toUpperCase())
      if (!map.has(sc)) map.set(sc, { setCode: sc, setName: sn, cards: [] })
      map.get(sc)!.cards.push(c)
    }

    // 2. Deduplicate within each group + sort rows
    const cols: Column[] = []
    for (const [, g] of map) {
      const dedup = new Map<string, Row>()
      for (const c of g.cards) {
        const key = `${c.card_name ?? ''}|${c.card_type ?? ''}`
        const ex = dedup.get(key)
        if (ex) ex.count++
        else dedup.set(key, { key, card: c, count: 1 })
      }
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

  // ── Hover state (per column) ────────────────────────────────────────────
  // hoveredKey tracks which row is "expanded" (brought to front) per column.
  // null = no card hovered = row[0] is the naturally visible top card.
  let hoveredKey = $state<Map<string, string | null>>(new Map())

  function getHov(sc: string): string | null {
    return hoveredKey.get(sc) ?? null
  }

  function setHov(sc: string, key: string | null) {
    const m = new Map(hoveredKey)
    m.set(sc, key)
    hoveredKey = m
  }

  // ── Image resolution ────────────────────────────────────────────────────
  let ronFailed = $state<Set<string>>(new Set())

  function resolveImg(c: Card): string {
    const ron = getRonImageUrl(c.ron_image_url)
    if (ron && !ronFailed.has(c.id)) return ron
    if (c.scryfall_id) return getScryfallImageUrl(c.scryfall_id, 'normal')
    return '/images/card-placeholder.png'
  }

  function markFailed(id: string) {
    ronFailed = new Set([...ronFailed, id])
  }

  // ── Z-index logic ───────────────────────────────────────────────────────
  // row[0] = top of the physical stack (highest z-index, fully visible).
  // row[N-1] = bottom of the stack (lowest z-index, mostly covered).
  // On hover: the hovered row gets z = rows.length + 50 (pops to front).
  function zIndex(col: Column, i: number): number {
    const hovKey = getHov(col.setCode)
    const isHov = hovKey !== null && hovKey === col.rows[i]?.key
    return isHov ? col.rows.length + 50 : col.rows.length - i
  }

  // ── Container height per column ─────────────────────────────────────────
  // = CARD_H (for the fully-visible top card) + (N-1) × PEEK_PX (one strip per additional card)
  function stackHeight(col: Column): number {
    return CARD_H + (col.rows.length - 1) * PEEK_PX
  }
</script>

<!--
  Stacks View — Archidekt-style physical card deck layout
  ───────────────────────────────────────────────────────
  Each column = one MTG expansion.
  Cards are absolutely positioned in a "stack":
    • row[0] sits at top=0, z-index=highest → fully visible at all times
    • row[i] sits at top = i×PEEK_PX, z-index = rows.length-i
      → only its bottom PEEK_PX strip is visible (peek underneath the card above)
  On hover → z-index jumps to rows.length+50 → card "pops out" to full view.
  Name gradient overlay ensures card name is readable in the peek strip.
-->

<div
  class="grid gap-5 justify-center overflow-x-auto pb-4"
  style="grid-template-columns: repeat({Math.min(columns.length, MAX_COLS)}, {COL_W}px)"
>
  {#each columns as col (col.setCode)}
    <!-- Column -->
    <div style="width: {COL_W}px">

      <!-- ── Column header ── -->
      <div class="flex items-start gap-2 mb-3 px-0.5">
        {#if col.setCode !== 'unknown'}
          <img
            src="https://svgs.scryfall.io/card-symbols/{col.setCode}.svg"
            alt=""
            class="h-5 w-5 mt-0.5 shrink-0 opacity-90"
            aria-hidden="true"
            onerror={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        {/if}
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold leading-tight truncate">{col.setName}</p>
          <p class="text-xs text-muted-foreground tabular-nums">
            {col.totalCount} card{col.totalCount !== 1 ? 's' : ''}
            {#if col.rows.length !== col.totalCount}
              · {col.rows.length} unique
            {/if}
          </p>
        </div>
      </div>

      <!-- ── Card stack ── -->
      <div
        class="relative"
        style="height: {stackHeight(col)}px"
        aria-label="{col.setName} stack"
      >
        {#each col.rows as row, i (row.key)}
          {@const isHov = getHov(col.setCode) === row.key}
          {@const zi = zIndex(col, i)}

          <!--
            Each card is absolutely positioned in the stack.
            top = i × PEEK_PX  → cards fan downward, each peeking below the one above.
            z-index = rows.length - i  → row[0] has highest z (on top), row[N] lowest.
            On hover: z-index = rows.length+50 → pops to front.
          -->
          <a
            href={getCardUrl(row.card)}
            class="absolute block transition-all duration-150 rounded-xl overflow-hidden"
            style="
              width: {COL_W}px;
              height: {CARD_H}px;
              top: {i * PEEK_PX}px;
              z-index: {zi};
              box-shadow: {isHov
                ? '0 20px 40px rgba(0,0,0,0.5), 0 0 0 2px hsl(var(--primary))'
                : '0 4px 12px rgba(0,0,0,0.35)'};
              transform: {isHov ? 'scale(1.02)' : 'scale(1)'};
            "
            aria-label="{row.card.card_name ?? 'Card'}{row.count > 1 ? ` ×${row.count}` : ''}"
            onmouseenter={() => setHov(col.setCode, row.key)}
            onmouseleave={() => setHov(col.setCode, null)}
            onfocus={() => setHov(col.setCode, row.key)}
            onblur={() => setHov(col.setCode, null)}
          >
            <!-- Card art -->
            <img
              src={resolveImg(row.card)}
              alt={row.card.card_name ?? 'Card'}
              width={COL_W}
              height={CARD_H}
              class="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
              draggable="false"
              onerror={() => markFailed(row.card.id)}
            />

            <!--
              Name overlay — always rendered at the BOTTOM of every card.
              When the card is in "peek" mode (not hovered), only the bottom
              PEEK_PX strip is visible — this overlay sits right in that strip.
              When the card is hovered (fully visible), the overlay also shows
              at the bottom of the full card, acting as a caption.
            -->
            <div class="absolute bottom-0 inset-x-0 pointer-events-none">
              <div
                class="px-2 pb-1.5 pt-6
                       bg-gradient-to-t from-black/85 via-black/50 to-transparent"
              >
                <p class="text-white text-[11px] font-semibold truncate leading-snug drop-shadow-sm">
                  {row.card.card_name ?? 'Unknown'}
                </p>
                {#if row.count > 1}
                  <span class="text-white/70 text-[10px] tabular-nums font-mono">×{row.count}</span>
                {/if}
              </div>
            </div>

            <!-- Hover ring (visible glow on active card) -->
            {#if isHov}
              <div
                class="absolute inset-0 rounded-xl pointer-events-none
                       ring-2 ring-primary/80 ring-inset"
              ></div>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  {/each}
</div>
