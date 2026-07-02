import type { PageServerLoad } from './$types'
import { createAdminClient } from '$lib/server/admin'
import type { Card } from '$lib/server/types'
import { logger } from '$lib/server/logger'

// In-memory cache for cards and sets
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const SCRYFALL_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours — set release dates rarely change
let cardsCache: CacheEntry<Card[]> | null = null
let setsCache: CacheEntry<{ code: string; name: string }[]> | null = null
let scryfallSetsCache: CacheEntry<Record<string, string>> | null = null

function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS
}

async function fetchCards(): Promise<Card[]> {
  if (isCacheValid(cardsCache)) {
    return cardsCache.data
  }

  const adminClient = createAdminClient()
  const allCards: Card[] = []
  const batchSize = 1000
  let offset = 0
  let hasMore = true

  // Fetch all cards with pagination (Supabase has 1000 row limit)
  while (hasMore) {
    const { data: batch, error } = await adminClient
      .from('cards')
      .select(
        'id, serial, card_name, flavor_name, set_code, set_name, collector_number, language, color_identity, card_type, foil_type, type_line, mana_cost, is_retro, is_extended, is_borderless, is_showcase, is_in_stock, is_new, is_misprint, ron_image_url, scryfall_id'
      )
      .range(offset, offset + batchSize - 1)

    if (error) {
      logger.error({ error }, 'Error fetching cards')
      break
    }

    if (batch && batch.length > 0) {
      allCards.push(...(batch as Card[]))
      offset += batchSize
      hasMore = batch.length === batchSize
    } else {
      hasMore = false
    }
  }

  // Update cache
  cardsCache = { data: allCards, timestamp: Date.now() }
  return allCards
}

async function fetchSets(): Promise<{ code: string; name: string }[]> {
  if (isCacheValid(setsCache)) {
    return setsCache.data
  }

  const adminClient = createAdminClient()
  const setsMap = new Map<string, string>()
  const batchSize = 1000
  let offset = 0
  let hasMore = true

  // Fetch all cards with pagination to get all unique sets
  // (Supabase has a 1000 row limit by default)
  while (hasMore) {
    const { data: batch, error } = await adminClient
      .from('cards')
      .select('set_code, set_name')
      .not('set_code', 'is', null)
      .range(offset, offset + batchSize - 1)

    if (error) {
      logger.error({ error }, 'Error fetching sets')
      break
    }

    if (batch && batch.length > 0) {
      batch.forEach((card) => {
        if (card.set_code && !setsMap.has(card.set_code)) {
          setsMap.set(card.set_code, card.set_name || card.set_code)
        }
      })
      offset += batchSize
      hasMore = batch.length === batchSize
    } else {
      hasMore = false
    }
  }

  // Sort alphabetically by set name for better searchability in the dropdown
  const sets = Array.from(setsMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Update cache
  setsCache = { data: sets, timestamp: Date.now() }
  return sets
}

// Returns a map of lowercase set_code -> released_at (YYYY-MM-DD) from Scryfall
async function fetchScryfallSetDates(): Promise<Record<string, string>> {
  if (scryfallSetsCache !== null && Date.now() - scryfallSetsCache.timestamp < SCRYFALL_CACHE_TTL_MS) {
    return scryfallSetsCache.data
  }

  try {
    const res = await fetch('https://api.scryfall.com/sets', {
      headers: { 'User-Agent': 'RonGroupBuy/1.0' }
    })
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Scryfall /sets returned non-OK status')
      return scryfallSetsCache?.data ?? {}
    }
    const json = (await res.json()) as { data: { code: string; released_at: string }[] }
    const dates: Record<string, string> = {}
    for (const s of json.data) {
      if (s.code && s.released_at) {
        dates[s.code.toLowerCase()] = s.released_at
      }
    }
    scryfallSetsCache = { data: dates, timestamp: Date.now() }
    return dates
  } catch (err) {
    logger.error({ err }, 'Failed to fetch Scryfall set dates')
    return scryfallSetsCache?.data ?? {}
  }
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  // Cache homepage for 5 minutes on CDN, allow 30 minutes of stale content with background revalidation
  // This dramatically improves UX by serving cached content instantly while updating in background
  setHeaders({
    'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=1800'
  })

  // Parse initial filter state from URL
  const VALID_SORTS = ['name-asc', 'name-desc', 'price-asc', 'price-desc', 'release-newest', 'release-oldest', 'set-collector'] as const
  type SortBy = typeof VALID_SORTS[number]
  const sortParam = url.searchParams.get('sort') ?? 'name-asc'
  const initialFilters = {
    search: url.searchParams.get('q') || '',
    setCodes:
      url.searchParams
        .get('sets')
        ?.split(',')
        .filter(Boolean)
        .map((s) => s.toLowerCase()) || [],
    colorIdentity: url.searchParams.get('colors')?.split(',').filter(Boolean) || [],
    colorIdentityStrict: url.searchParams.get('strict') !== '0',
    priceCategories: url.searchParams.get('price')?.split(',').filter(Boolean) || ['Non-Foil', 'Foil', 'Serialized'],
    // Foil subtype filter (only relevant when 'Foil' is in priceCategories)
    foilSubtypes: url.searchParams.get('foilsubs')?.split(',').filter(Boolean) || [
      'Foil',
      'Galaxy Foil',
      'Raised Foil',
      'Surge Foil'
    ],
    // Non-Foil subtype filter (only relevant when 'Non-Foil' is in priceCategories)
    nonFoilSubtypes: url.searchParams.get('nfsubs')?.split(',').filter(Boolean) || ['Normal', 'Holo'],
    cardTypes: url.searchParams.get('types')?.split(',').filter(Boolean) || [],
    frameTypes: url.searchParams.get('frames')?.split(',').filter(Boolean) || [],
    inStockOnly: url.searchParams.get('stock') === '1',
    isNew: url.searchParams.get('new') === '1',
    isMisprint: url.searchParams.get('misprint') === '1',
    view: (url.searchParams.get('view') as 'grid' | 'table') || 'grid',
    page: parseInt(url.searchParams.get('page') || '1') || 1,
    sortBy: (VALID_SORTS.includes(sortParam as SortBy) ? sortParam : 'name-asc') as SortBy
  }

  // Use streaming to return immediately while data loads
  return {
    initialFilters,
    streamed: {
      cardsData: Promise.all([fetchCards(), fetchSets(), fetchScryfallSetDates()]).then(
        ([cards, sets, setReleaseDates]) => ({ cards, sets, setReleaseDates })
      )
    }
  }
}
