import type { PageServerLoad } from './$types'
import { createAdminClient } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

interface SetRow {
  set_code: string
  set_name: string
  sort_order: number
  set_cards: { count: number }[]
}

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, max-age=60' })
  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sets, error } = await (adminClient as any)
    .from('sets')
    .select('set_code, set_name, sort_order, set_cards(count)')
    .order('sort_order', { ascending: true })
    .order('set_name', { ascending: true })

  if (error) {
    logger.error({ error }, 'Error fetching sets for admin')
    return { sets: [] }
  }

  return {
    sets: ((sets ?? []) as SetRow[]).map((s) => ({
      set_code: s.set_code,
      set_name: s.set_name,
      sort_order: s.sort_order,
      card_count: s.set_cards?.[0]?.count ?? 0
    }))
  }
}
