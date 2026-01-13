/**
 * Deck Parsing Utilities
 * Extracted from import page for testability
 */

export interface DeckCard {
  quantity: number
  name: string
  set?: string
  collectorNumber?: string
  boardType?: 'commanders' | 'companions' | 'mainboard' | 'sideboard'
  typeLine?: string
  foil?: boolean
}

// Card type ordering (primary types extracted from type_line)
export const TYPE_ORDER: Record<string, number> = {
  Creature: 0,
  Planeswalker: 1,
  Artifact: 2,
  Enchantment: 3,
  Instant: 4,
  Sorcery: 5,
  Land: 6,
  Other: 7
}

/**
 * Extract the primary card type from a type line
 * Example: "Legendary Creature — Human Wizard" -> "Creature"
 */
export function extractPrimaryType(typeLine: string): string {
  if (!typeLine) return 'Other'

  // Remove everything after the em dash (subtypes)
  const mainPart = typeLine.split('—')[0].trim()
  // Remove supertypes
  const types = mainPart.replace(/\b(Legendary|Basic|Snow|World|Tribal)\b/gi, '').trim()

  // Check for primary types
  if (types.includes('Creature')) return 'Creature'
  if (types.includes('Planeswalker')) return 'Planeswalker'
  if (types.includes('Artifact')) return 'Artifact'
  if (types.includes('Enchantment')) return 'Enchantment'
  if (types.includes('Instant')) return 'Instant'
  if (types.includes('Sorcery')) return 'Sorcery'
  if (types.includes('Land')) return 'Land'

  return 'Other'
}

/**
 * Parse a deck list from plain text format
 * Supports formats:
 * - "1 Card Name"
 * - "1 Card Name (SET) 123"
 * - "1 Card Name (SET) 123 *F*"
 */
export function parseDeckList(text: string): DeckCard[] {
  const cards: DeckCard[] = []
  const lines = text.split('\n')

  // Regex logic: Priority for strictly formatted lines
  // ^(\d+) -> Quantity
  // \s+(.+?) -> Name (non-greedy)
  // (?:\s+\(([a-zA-Z0-9]+)\)(?:\s+([a-zA-Z0-9]+))?)? -> Optional Set group: (set) followed optionally by CN
  // (?:\s+\*(.+?)\*)? -> Optional Foil group
  // $ -> End of line check
  const regex = /^(\d+)\s+(.+?)(?:\s+\(([a-zA-Z0-9]+)\)(?:\s+([a-zA-Z0-9]+))?)?(?:\s+\*(.+?)\*)?$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(regex)
    if (match) {
      const [, qty, name, set, cn, foil] = match
      cards.push({
        quantity: parseInt(qty),
        name: name.trim(),
        set: set?.toUpperCase(),
        collectorNumber: cn,
        boardType: 'mainboard',
        foil: !!foil
      })
    } else {
      // Fallback for simple "1 Card Name"
      // Try to match simpler pattern "Qty Name"
      const simpleRegex = /^(\d+)\s+(.+)$/
      const simpleMatch = trimmed.match(simpleRegex)
      if (simpleMatch) {
        cards.push({
          quantity: parseInt(simpleMatch[1]),
          name: simpleMatch[2].trim(),
          boardType: 'mainboard'
        })
      }
    }
  }
  return cards
}
