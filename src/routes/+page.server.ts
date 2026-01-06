import type { PageServerLoad } from './$types'
import type { Card } from '$lib/server/types'

export const load: PageServerLoad = async ({ locals }) => {
  // Fetch ALL cards in batches (Supabase has a 1000 row limit per request)
  const batchSize = 1000
  let allCards: Card[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: batch, error } = await locals.supabase
      .from('cards')
      .select('*')
      .order('card_name', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('Error fetching cards:', error)
      break
    }

    if (batch && batch.length > 0) {
      allCards = [...allCards, ...batch]
      offset += batchSize
      hasMore = batch.length === batchSize
    } else {
      hasMore = false
    }
  }

  // Fetch unique set codes for filter dropdown
  const { data: setsData } = await locals.supabase
    .from('cards')
    .select('set_code, set_name')
    .not('set_code', 'is', null)

  // Deduplicate sets
  const setsMap = new Map<string, string>()
  setsData?.forEach((s) => {
    if (s.set_code && s.set_name) {
      setsMap.set(s.set_code, s.set_name)
    }
  })

  const sets = Array.from(setsMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    cards: allCards,
    sets
  }
}
