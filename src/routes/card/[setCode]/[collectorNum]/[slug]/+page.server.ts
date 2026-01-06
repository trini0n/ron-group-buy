import type { PageServerLoad } from './$types'
import { error, redirect } from '@sveltejs/kit'
import { slugify } from '$lib/utils'

export const load: PageServerLoad = async ({ params, locals }) => {
  const { setCode, collectorNum, slug } = params

  // Query by set_code and collector_number (case-insensitive for set_code)
  const { data: card, error: dbError } = await locals.supabase
    .from('cards')
    .select('*')
    .ilike('set_code', setCode)
    .eq('collector_number', collectorNum)
    .single()

  if (dbError || !card) {
    throw error(404, 'Card not found')
  }

  // Verify slug matches (redirect if wrong for SEO)
  const expectedSlug = slugify(card.card_name)
  if (slug !== expectedSlug) {
    throw redirect(301, `/card/${setCode.toLowerCase()}/${collectorNum}/${expectedSlug}/`)
  }

  return { card }
}
