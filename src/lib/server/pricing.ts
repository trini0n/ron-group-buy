/**
 * Server-side pricing helper
 *
 * Fetches card type prices from the database. Falls back to hardcoded defaults
 * if the table is unavailable (e.g. before migration runs).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'

export type CardPrices = Record<string, number>

/** Hardcoded fallback prices — matches the DB seed data */
export const FALLBACK_PRICES: CardPrices = {
  Normal: 1.25,
  Holo: 1.25,
  Foil: 1.5,
  'Raised Foil': 3.0,
  Serialized: 2.5
}

/**
 * Fetch current card type prices from the database.
 * Returns FALLBACK_PRICES if the query fails.
 */
export async function fetchPrices(supabase: SupabaseClient<Database>): Promise<CardPrices> {
  const { data, error } = await supabase.from('card_type_pricing').select('card_type, price')

  if (error || !data?.length) {
    console.warn({ error }, 'Failed to fetch card_type_pricing, using fallback prices')
    return FALLBACK_PRICES
  }

  return Object.fromEntries(data.map((row: { card_type: string; price: number }) => [row.card_type, Number(row.price)]))
}
