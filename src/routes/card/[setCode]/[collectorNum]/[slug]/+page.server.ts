import type { PageServerLoad } from './$types'
import { error, redirect } from '@sveltejs/kit'
import { slugify } from '$lib/utils'

// Finish order for sorting variants
const FINISH_ORDER: Record<string, number> = {
  'Normal': 0,
  'Holo': 1,
  'Foil': 2,
  'Surge Foil': 3
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const { setCode, collectorNum, slug } = params

  // Query by set_code and collector_number to get ALL finish variants
  const { data: cards, error: dbError } = await locals.supabase
    .from('cards')
    .select('*')
    .ilike('set_code', setCode)
    .eq('collector_number', collectorNum)

  if (dbError || !cards || cards.length === 0) {
    throw error(404, 'Card not found')
  }

  // Sort by finish order and prefer in-stock
  const sortedCards = cards.sort((a, b) => {
    const orderA = FINISH_ORDER[a.card_type] ?? 99
    const orderB = FINISH_ORDER[b.card_type] ?? 99
    if (orderA !== orderB) return orderA - orderB
    // Prefer in-stock
    if (a.is_in_stock && !b.is_in_stock) return -1
    if (!a.is_in_stock && b.is_in_stock) return 1
    return 0
  })

  // Primary card is first in-stock variant, or first overall
  const card = sortedCards.find(c => c.is_in_stock) || sortedCards[0]

  // Verify slug matches (redirect if wrong for SEO)
  const expectedSlug = slugify(card.card_name)
  if (slug !== expectedSlug) {
    throw redirect(301, `/card/${setCode.toLowerCase()}/${collectorNum}/${expectedSlug}/`)
  }

  return { card, finishVariants: sortedCards }
}

