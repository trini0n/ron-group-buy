import type { PageServerLoad } from './$types'
import { createAdminClient } from '$lib/server/admin'
import { error } from '@sveltejs/kit'
import { logger } from '$lib/server/logger'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, max-age=30' })
  const adminClient = createAdminClient()

  // Fetch the set
  const { data: set, error: setError } = await adminClient
    .from('sets')
    .select('set_code, set_name, sort_order')
    .eq('set_code', params.setCode)
    .single()

  if (setError || !set) throw error(404, 'Set not found')

  // Fetch set_cards joined to card data
  const { data: setCards, error: cardsError } = await adminClient
    .from('set_cards')
    .select(
      'id, card_id, cards(id, card_name, set_code, collector_number, language, card_type, serial)'
    )
    .eq('set_code', params.setCode)
    .order('created_at', { ascending: true })

  if (cardsError) {
    logger.error({ error: cardsError }, 'Error fetching set cards for admin detail')
    return { set, cards: [] }
  }

  return {
    set,
    cards: (setCards ?? []).map((sc) => {
      const card = sc.cards as {
        id: string
        card_name: string
        set_code: string | null
        collector_number: string | null
        language: string | null
        card_type: string
        serial: string
      } | null
      return {
        set_card_id: sc.id,
        card_id: sc.card_id,
        card_name: card?.card_name ?? '—',
        set_code: card?.set_code ?? '—',
        collector_number: card?.collector_number ?? '—',
        language: card?.language ?? 'en',
        card_type: card?.card_type ?? '—',
        serial: card?.serial ?? '—'
      }
    })
  }
}
