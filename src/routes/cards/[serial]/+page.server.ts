import type { PageServerLoad } from './$types'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  // Private cache only — no CDN caching (root layout includes user-specific SSR data)
  setHeaders({
    'Cache-Control': 'private, max-age=120'
  });

  const { serial } = params

  const { data: card, error: dbError } = await locals.supabase.from('cards').select('*').eq('serial', serial).single()

  if (dbError || !card) {
    throw error(404, 'Card not found')
  }

  return { card }
}
