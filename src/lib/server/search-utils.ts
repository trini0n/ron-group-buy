/**
 * Search Utilities for Import API
 * Extracted for testability
 */

export interface CardMatch {
  id: string
  serial: string
  card_name: string
  set_code: string | null
  set_name: string | null
  collector_number: string | null
  card_type: string
  foil_type: string | null
  is_in_stock: boolean | null
  scryfall_id: string | null
  type_line: string | null
  language: string | null
}

/**
 * Generate a cache key from a card name
 * Normalizes to lowercase and trims whitespace
 */
export function getCacheKey(name: string): string {
  return name.toLowerCase().trim()
}

/**
 * Check if a card is a foil variant
 * Returns true for Foil, Holo, or any card with a foil_type
 */
export function isFoil(card: CardMatch): boolean {
  return card.card_type === 'Foil' || card.card_type === 'Holo' || !!card.foil_type
}

/**
 * Sort card matches by priority
 * Priority order:
 * 1. In stock first
 * 2. Foil preference (if specified)
 */
export function sortMatches(matches: CardMatch[], preferFoil?: boolean): CardMatch[] {
  return [...matches].sort((a, b) => {
    // 1. Stock status - in stock first
    if (a.is_in_stock !== b.is_in_stock) return a.is_in_stock ? -1 : 1

    // 2. Foil preference if specified
    if (preferFoil) {
      const aFoil = isFoil(a)
      const bFoil = isFoil(b)
      if (aFoil !== bFoil) return aFoil ? -1 : 1
    }

    return 0
  })
}
