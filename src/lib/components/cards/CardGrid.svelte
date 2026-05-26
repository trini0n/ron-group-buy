<script lang="ts">
  import type { Card } from '$lib/server/types'
  import CardItem from './CardItem.svelte'
  import * as Pagination from '$components/ui/pagination'
  import { Button } from '$components/ui/button'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import { untrack } from 'svelte'
  import { getFinishLabel, FOIL_SUBTYPES } from '$lib/utils'
  import { matchesOracleTag, ORACLE_TAGS } from '$lib/data/oracle-tags'

  interface Filters {
    setCodes: string[]
    colorIdentity: string[]
    colorIdentityStrict: boolean
    priceCategories: string[]
    foilSubtypes: string[]
    nonFoilSubtypes: string[]
    cardTypes: string[]
    frameTypes: string[]
    inStockOnly: boolean
    isNew: boolean
    isMisprint: boolean
  }

  // Supertypes to ignore when matching card types
  const SUPERTYPES = ['basic', 'legendary', 'snow', 'world', 'ongoing', 'host']

  interface Props {
    cards: Card[]
    searchQuery: string
    filters: Filters
    currentPage?: number
    onPageChange?: (page: number) => void
    setReleaseDates?: Record<string, string>
  }

  let { cards, searchQuery, filters, currentPage: propPage = 1, onPageChange, setReleaseDates = {} }: Props = $props()

  const CARDS_PER_PAGE = 25
  let internalPage = $state(1)

  // Card groups stored as state for deferred updates
  interface CardGroup {
    primary: Card
    finishVariants: Card[]
  }

  let groupedCards = $state<CardGroup[]>([])

  // Sync internal page with prop when it changes
  $effect(() => {
    internalPage = propPage
  })

  const FINISH_ORDER: Record<string, number> = {
    Normal: 1,
    Holo: 2,
    Foil: 3,
    'Galaxy Foil': 4,
    'Surge Foil': 4,
    'Raised Foil': 5,
    Serialized: 6
  }

  // Filter function - pure, no side effects
  function filterAndGroupCards(
    allCards: Card[],
    query: string,
    f: Filters,
    releaseDates: Record<string, string>
  ): CardGroup[] {
    // Parse is:TAG tokens from the query (case-insensitive). Strip them to get text-only part.
    const isTokens = [...query.matchAll(/\bis:(\S+)/gi)].map((m) => m[1]?.toLowerCase() ?? '')
    // Only apply known tags — unknown/partial tokens (is:sh) are treated as no-ops.
    const knownIsTokens = isTokens.filter((t) => t in ORACLE_TAGS)
    const textQuery = query.replace(/\bis:\S+/gi, '').trim()

    // Filter cards
    const filtered = allCards.filter((card) => {
      // Oracle tag filter: card must match at least one known is:TAG token (OR across tokens).
      if (knownIsTokens.length > 0) {
        if (!knownIsTokens.some((tag) => matchesOracleTag(card.card_name, tag))) return false
      }
      // Text search with is:TAG tokens stripped out (AND with oracle tag filter above).
      if (textQuery) {
        const q = textQuery.toLowerCase()
        const nameMatch = card.card_name.toLowerCase().includes(q)
        const flavorMatch = card.flavor_name?.toLowerCase().includes(q)
        if (!nameMatch && !flavorMatch) return false
      }

      // Set filter
      if (f.setCodes.length > 0) {
        const cardSetCode = card.set_code?.toLowerCase() || ''
        if (!f.setCodes.includes(cardSetCode)) return false
      }

      // Color identity filter
      if (f.colorIdentity.length > 0) {
        const cardColors = (card.color_identity?.split(',').map((c: string) => c.trim()) || []).filter((c: string) => c)
        if (f.colorIdentityStrict) {
          const hasDisallowedColor = cardColors.some((c: string) => !f.colorIdentity.includes(c))
          if (hasDisallowedColor) return false
          // In strict mode, colorless cards only match if 'C' is explicitly selected
          if (cardColors.length === 0 && !f.colorIdentity.includes('C')) return false
        } else {
          const hasMatchingColor = f.colorIdentity.some((c: string) =>
            c === 'C' ? cardColors.length === 0 : cardColors.includes(c)
          )
          if (!hasMatchingColor) return false
        }
      }

      // Finish filter — hierarchical:
      //  Top level: 'Non-Foil', 'Foil' (the whole family), 'Serialized'
      //  Within Foil: narrow by foilSubtypes (default = all)
      const effectiveFinish = getFinishLabel(card) // foil_type || card_type
      const FOIL_FAMILY: readonly string[] = FOIL_SUBTYPES // ['Foil','Galaxy Foil','Raised Foil','Surge Foil']
      const isNonFoil = effectiveFinish === 'Normal' || effectiveFinish === 'Holo'
      const isFoilFamily = FOIL_FAMILY.includes(effectiveFinish)
      const isSerialized = effectiveFinish === 'Serialized'

      if (isNonFoil) {
        if (!f.priceCategories.includes('Non-Foil')) return false
        // Apply non-foil subtype filter (Normal = No Holostamp, Holo = Holostamped)
        if (!f.nonFoilSubtypes.includes(effectiveFinish)) return false
      }
      if (isFoilFamily) {
        if (!f.priceCategories.includes('Foil')) return false
        // Apply subtype filter within the foil family
        if (!f.foilSubtypes.includes(effectiveFinish)) return false
      }
      if (isSerialized && !f.priceCategories.includes('Serialized')) return false

      // Card type filter
      if (f.cardTypes.length > 0) {
        if (!card.type_line) return false
        const typeLine = card.type_line.toLowerCase()
        const parts = typeLine.split('—')
        const mainTypes = parts[0]?.trim() || ''
        const cardTypeWords = mainTypes.split(/\s+/).filter((t: string) => !SUPERTYPES.includes(t))
        const hasMatchingType = f.cardTypes.some((selectedType) => cardTypeWords.includes(selectedType.toLowerCase()))
        if (!hasMatchingType) return false
      }

      // Frame type filter
      if (f.frameTypes.length > 0) {
        const matchesFrameType = f.frameTypes.some((frameType) => {
          switch (frameType) {
            case 'retro':
              return card.is_retro === true
            case 'extended':
              return card.is_extended === true
            case 'borderless':
              return card.is_borderless === true
            case 'showcase':
              return card.is_showcase === true
            default:
              return false
          }
        })
        if (!matchesFrameType) return false
      }

      // In stock filter
      if (f.inStockOnly && !card.is_in_stock) return false

      // New cards filter
      if (f.isNew && !card.is_new) return false

      // Misprint exclusion — hide misprint cards unless filter is explicitly enabled
      if (f.isMisprint !== !!card.is_misprint) return false

      return true
    })

    // Group by set_code + collector_number + language
    const groups = new Map<string, CardGroup>()

    for (const card of filtered) {
      const groupKey = `${card.set_code?.toLowerCase() || ''}|${card.collector_number || ''}|${card.language?.toLowerCase() || 'en'}`

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { primary: card, finishVariants: [] })
      }

      const group = groups.get(groupKey)!
      // Use effective finish (foil_type || card_type) to deduplicate variants
      // Without this, Raised Foil (card_type='Foil', foil_type='Raised Foil') and regular Foil
      // (card_type='Foil', foil_type=null) would incorrectly merge into the same slot
      const effectiveFinish = getFinishLabel(card)
      const existingFinishIdx = group.finishVariants.findIndex((v) => getFinishLabel(v) === effectiveFinish)
      if (existingFinishIdx === -1) {
        group.finishVariants.push(card)
      } else {
        const existing = group.finishVariants[existingFinishIdx]
        if (existing && card.is_in_stock && !existing.is_in_stock) {
          group.finishVariants[existingFinishIdx] = card
        }
      }
    }

    // Sort finish variants and set primary
    for (const group of groups.values()) {
      group.finishVariants.sort((a, b) => {
        // Sort by effective finish label (foil_type || card_type) so Raised Foil sorts correctly
        const orderA = FINISH_ORDER[getFinishLabel(a)] ?? 99
        const orderB = FINISH_ORDER[getFinishLabel(b)] ?? 99
        return orderA - orderB
      })

      const inStock = group.finishVariants.find((v) => v.is_in_stock)
      group.primary = inStock || group.finishVariants[0]!
    }

    // Sort: new cards first, then alphabetically by name, then newest set first, then collector number asc
    return Array.from(groups.values()).sort((a, b) => {
      // 1. New cards first
      const aIsNew = a.primary.is_new ? 1 : 0
      const bIsNew = b.primary.is_new ? 1 : 0
      if (bIsNew !== aIsNew) return bIsNew - aIsNew

      // 2. Card name ascending
      const nameComp = a.primary.card_name.localeCompare(b.primary.card_name)
      if (nameComp !== 0) return nameComp

      // 3. Set release date descending (newest set first)
      const aSetCode = a.primary.set_code?.toLowerCase() || ''
      const bSetCode = b.primary.set_code?.toLowerCase() || ''
      const aReleased = releaseDates[aSetCode] || ''
      const bReleased = releaseDates[bSetCode] || ''
      if (aReleased !== bReleased) return bReleased.localeCompare(aReleased)

      // 4. Collector number ascending (numeric)
      const aNum = parseInt(a.primary.collector_number || '0') || 0
      const bNum = parseInt(b.primary.collector_number || '0') || 0
      return aNum - bNum
    })
  }

  // Deferred filter update - uses requestAnimationFrame to let UI paint first
  // Store the frame ID so we can cancel pending updates
  let pendingFrameId: number | null = null
  let initialLoadDone = false

  $effect(() => {
    // Read dependencies to establish tracking
    const currentCards = cards
    const currentQuery = searchQuery
    const currentReleaseDates = setReleaseDates
    // Create a snapshot of filters to avoid tracking nested changes
    const currentFilters = {
      setCodes: [...filters.setCodes],
      colorIdentity: [...filters.colorIdentity],
      colorIdentityStrict: filters.colorIdentityStrict,
      priceCategories: [...filters.priceCategories],
      foilSubtypes: [...filters.foilSubtypes],
      nonFoilSubtypes: [...filters.nonFoilSubtypes],
      cardTypes: [...filters.cardTypes],
      frameTypes: [...filters.frameTypes],
      inStockOnly: filters.inStockOnly,
      isNew: filters.isNew,
      isMisprint: filters.isMisprint
    }

    // Cancel any pending frame to prevent stacking updates
    if (pendingFrameId !== null) {
      cancelAnimationFrame(pendingFrameId)
    }

    // For initial load with cards, do it synchronously to avoid flash
    if (!initialLoadDone && currentCards.length > 0) {
      initialLoadDone = true
      untrack(() => {
        groupedCards = filterAndGroupCards(currentCards, currentQuery, currentFilters, currentReleaseDates)
      })
      return
    }

    // Use requestAnimationFrame to defer filtering after browser paint
    pendingFrameId = requestAnimationFrame(() => {
      pendingFrameId = null
      // Use untrack to avoid reading state during update
      untrack(() => {
        groupedCards = filterAndGroupCards(currentCards, currentQuery, currentFilters, currentReleaseDates)
      })
    })
  })

  const totalPages = $derived(Math.ceil(groupedCards.length / CARDS_PER_PAGE))

  // Use internal page bounded by total pages
  const currentPage = $derived(Math.min(internalPage, Math.max(1, totalPages)))

  const paginatedGroups = $derived.by(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE
    const end = start + CARDS_PER_PAGE
    return groupedCards.slice(start, end)
  })

  function goToPage(page: number) {
    const newPage = Math.max(1, Math.min(page, totalPages))
    internalPage = newPage
    onPageChange?.(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
</script>

{#if groupedCards.length === 0}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <p class="text-xl font-medium">No cards found</p>
    <p class="mt-2 text-muted-foreground">Try adjusting your search or filters</p>
  </div>
{:else}
  <!-- Results count and page info -->
  <div class="mb-4 flex items-center justify-between text-sm text-muted-foreground">
    <span>
      Showing {(currentPage - 1) * CARDS_PER_PAGE + 1}–{Math.min(currentPage * CARDS_PER_PAGE, groupedCards.length)} of {groupedCards.length}
      cards
    </span>
    {#if totalPages > 1}
      <span>Page {currentPage} of {totalPages}</span>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {#each paginatedGroups as group (group.primary.serial)}
      <CardItem card={group.primary} finishVariants={group.finishVariants} />
    {/each}
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-8 flex items-center justify-center gap-2">
      <Button variant="outline" size="icon" disabled={currentPage === 1} onclick={() => goToPage(currentPage - 1)}>
        <ChevronLeft class="h-4 w-4" />
      </Button>

      <div class="flex items-center gap-1">
        {#if totalPages <= 7}
          {#each Array(totalPages) as _, i}
            <Button variant={currentPage === i + 1 ? 'default' : 'outline'} size="icon" onclick={() => goToPage(i + 1)}>
              {i + 1}
            </Button>
          {/each}
        {:else}
          <!-- First page -->
          <Button variant={currentPage === 1 ? 'default' : 'outline'} size="icon" onclick={() => goToPage(1)}>1</Button>

          {#if currentPage > 3}
            <span class="px-2 text-muted-foreground">...</span>
          {/if}

          <!-- Pages around current -->
          {#each Array(5) as _, i}
            {@const page = currentPage - 2 + i}
            {#if page > 1 && page < totalPages}
              <Button variant={currentPage === page ? 'default' : 'outline'} size="icon" onclick={() => goToPage(page)}>
                {page}
              </Button>
            {/if}
          {/each}

          {#if currentPage < totalPages - 2}
            <span class="px-2 text-muted-foreground">...</span>
          {/if}

          <!-- Last page -->
          <Button
            variant={currentPage === totalPages ? 'default' : 'outline'}
            size="icon"
            onclick={() => goToPage(totalPages)}
          >
            {totalPages}
          </Button>
        {/if}
      </div>

      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === totalPages}
        onclick={() => goToPage(currentPage + 1)}
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>
  {/if}
{/if}
