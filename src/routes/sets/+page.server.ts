import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' })

  const { data: sets } = await locals.supabase
    .from('sets')
    .select('set_code, set_name, sort_order, price, set_cards(count)')
    .order('sort_order', { ascending: true })
    .order('set_name', { ascending: true })

  return {
    sets: (sets ?? []).map((s) => ({
      set_code: s.set_code,
      set_name: s.set_name,
      price: s.price ?? null,
      card_count: Array.isArray(s.set_cards)
        ? ((s.set_cards[0] as { count: number } | undefined)?.count ?? 0)
        : 0
    }))
  }
}
