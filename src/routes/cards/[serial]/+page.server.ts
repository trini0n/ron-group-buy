import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  // Cache card detail pages for 10 minutes, stale-while-revalidate for 2 hours
  // Card data rarely changes, so aggressive caching provides instant UX with background updates
  setHeaders({
    'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=7200'
  });

  const { serial } = params

  const { data: card, error: dbError } = await locals.supabase.from('cards').select('*').eq('serial', serial).single()

  if (dbError || !card) {
    throw error(404, 'Card not found')
  }

  return { card }
}
