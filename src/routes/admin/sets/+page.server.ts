import type { PageServerLoad } from './$types'
import { createAdminClient } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, max-age=60' })
  const adminClient = createAdminClient()

  const { data: sets, error } = await adminClient
    .from('sets')
    .select('set_code, set_name, set_type, sort_order, price, set_cards(count)')
    .order('sort_order', { ascending: true })
    .order('set_name', { ascending: true })

  if (error) {
    logger.error({ error }, 'Error fetching sets for admin')
    return { sets: [] }
  }

  return {
    sets: (sets ?? []).map((s) => ({
      set_code: s.set_code,
      set_name: s.set_name,
      set_type: (s.set_type as string) ?? 'Normal',
      sort_order: s.sort_order,
      price: s.price ?? null,
      card_count: Array.isArray(s.set_cards)
        ? ((s.set_cards[0] as { count: number } | undefined)?.count ?? 0)
        : 0
    }))
  }
}
