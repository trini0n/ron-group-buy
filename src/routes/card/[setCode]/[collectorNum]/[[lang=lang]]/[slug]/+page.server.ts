import type { PageServerLoad } from './$types'
import { error, redirect } from '@sveltejs/kit'
import { slugify, isDefaultLanguage } from '$lib/utils'

// Finish order for sorting variants
const FINISH_ORDER: Record<string, number> = {
  'Normal': 0,
  'Holo': 1,
  'Foil': 2,
  'Surge Foil': 3
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const { setCode, collectorNum, lang, slug } = params

  // Determine the target language
  // If lang param is not provided, default to English-like languages (en, qya, ph)
  const targetLanguage = lang?.toLowerCase() || null
  const isDefaultLang = !targetLanguage

  // Build the query
  let query = locals.supabase
    .from('cards')
    .select('*')
    .ilike('set_code', setCode)
    .eq('collector_number', collectorNum)

  // Filter by language
  if (isDefaultLang) {
    // For default (no lang param), get cards with default languages (en, qya, ph) or null
    query = query.or('language.ilike.en,language.ilike.qya,language.ilike.ph,language.is.null')
  } else {
    // For specific language, filter by that language
    query = query.ilike('language', targetLanguage)
  }

  const { data: cards, error: dbError } = await query

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
    // Build the correct URL with or without language
    const langSegment = isDefaultLang ? '' : `${targetLanguage}/`
    throw redirect(301, `/card/${setCode.toLowerCase()}/${collectorNum}/${langSegment}${expectedSlug}/`)
  }

  // Check if we're on the right URL for the language
  const cardLang = card.language?.toLowerCase() || 'en'
  const shouldHaveLangParam = !isDefaultLanguage(cardLang)
  
  if (shouldHaveLangParam && isDefaultLang) {
    // Card is non-default language but we're on URL without lang param - redirect
    throw redirect(301, `/card/${setCode.toLowerCase()}/${collectorNum}/${cardLang}/${expectedSlug}/`)
  } else if (!shouldHaveLangParam && !isDefaultLang) {
    // Card is default language but we have lang param - redirect to remove it
    throw redirect(301, `/card/${setCode.toLowerCase()}/${collectorNum}/${expectedSlug}/`)
  }

  return { card, finishVariants: sortedCards }
}
