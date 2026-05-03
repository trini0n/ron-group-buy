import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { FOIL_SUBTYPES } from '$lib/utils'
import { logger } from '$lib/server/logger'

// Helper to verify admin access
async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) {
    throw error(401, 'Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from('users')
    .select('discord_id')
    .eq('id', user.id)
    .single()

  if (!(await isAdmin(userData?.discord_id))) {
    throw error(403, 'Not authorized')
  }

  return { user, adminClient }
}

export interface CheckNewCardsRequest {
  cards: Array<{
    card_name: string
    set_code: string
    collector_number: string
  }>
  card_type: 'Normal' | 'Holo' | 'Foil'
}

export interface CheckNewCardsResponse {
  new_cards: Array<{
    card_name: string
    set_code: string
    collector_number: string
  }>
  new_count: number
  existing_count: number
  total_count: number
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  let body: CheckNewCardsRequest
  try {
    body = await request.json()
  } catch {
    throw error(400, 'Invalid JSON body')
  }

  const { cards, card_type } = body

  if (!Array.isArray(cards) || cards.length === 0) {
    throw error(400, 'cards must be a non-empty array')
  }

  if (!['Normal', 'Holo', 'Foil'].includes(card_type)) {
    throw error(400, 'card_type must be Normal, Holo, or Foil')
  }

  if (cards.length > 5000) {
    throw error(400, 'Maximum 5000 cards per request')
  }

  // Validate each card entry
  for (const card of cards) {
    if (
      typeof card.set_code !== 'string' ||
      typeof card.collector_number !== 'string' ||
      typeof card.card_name !== 'string'
    ) {
      throw error(400, 'Each card must have card_name, set_code, and collector_number strings')
    }
  }

  // Determine which card_type values to match in the DB
  const cardTypeValues: string[] =
    card_type === 'Foil' ? [...FOIL_SUBTYPES] : [card_type]

  // Collect unique (set_code, collector_number) pairs from input
  // Uppercase set codes to match DB storage (e.g. "2X2", "MH2"); keep lowercase for key comparison below
  const uniqueSetCodes = [...new Set(cards.map((c) => c.set_code.trim().toUpperCase()))]
  const uniqueCollectorNums = [...new Set(cards.map((c) => c.collector_number.trim()))]

  // Query DB: find all cards in this type family that match any of the input set_code values
  // We filter client-side by (set_code, collector_number) pair to avoid overly complex SQL
  let query = adminClient
    .from('cards')
    .select('set_code, collector_number, card_type')
    .in('card_type', cardTypeValues)
    .in('set_code', uniqueSetCodes)
    .in('collector_number', uniqueCollectorNums)

  const { data: existingCards, error: dbError } = await query

  if (dbError) {
    logger.error({ error: dbError }, 'Error checking new cards')
    throw error(500, 'Database error while checking cards')
  }

  // Build a lookup set of "set_code|collector_number" keys that exist in the DB
  const existingKeys = new Set(
    (existingCards ?? []).map(
      (c) => `${(c.set_code ?? '').toLowerCase()}|${c.collector_number ?? ''}`
    )
  )

  // Determine which input cards are NOT in the library
  const newCards = cards.filter(
    (c) => !existingKeys.has(`${c.set_code.trim().toLowerCase()}|${c.collector_number.trim()}`)
  )

  const response: CheckNewCardsResponse = {
    new_cards: newCards,
    new_count: newCards.length,
    existing_count: cards.length - newCards.length,
    total_count: cards.length
  }

  return json(response)
}
