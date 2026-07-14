import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, max-age=60' })

  const { data: sets } = await locals.supabase
    .from('sets')
    .select('set_code, set_name, set_type, sort_order, price, set_cards(count)')
    .order('sort_order', { ascending: true })
    .order('set_name', { ascending: true })

  return {
    sets: (sets ?? []).map((s) => ({
      set_code: s.set_code,
      set_name: s.set_name,
      set_type: (s.set_type as string) ?? 'Normal',
      price: s.price ?? null,
      card_count: (() => {
        const raw = Array.isArray(s.set_cards)
          ? ((s.set_cards[0] as { count: number } | undefined)?.count ?? 0)
          : 0
        return raw === 0 ? 56 : raw
      })()
    }))
  }
}
