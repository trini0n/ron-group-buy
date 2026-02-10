/**
 * Unit tests for src/lib/server/search-utils.ts
 * Tests card matching and sorting logic
 */

import { describe, it, expect } from 'vitest'
import { getCacheKey, isFoil, sortMatches, type CardMatch } from '../search-utils'

// Helper to create mock card matches
function createMockCard(overrides: Partial<CardMatch> = {}): CardMatch {
  return {
    id: 'card-123',
    serial: 'N-001',
    card_name: 'Test Card',
    set_code: 'TST',
    set_name: 'Test Set',
    collector_number: '123',
    card_type: 'Normal',
    foil_type: null,
    is_in_stock: true,
    scryfall_id: 'abc123',
    type_line: 'Creature',
    language: 'en',
    ...overrides
  }
}

describe('getCacheKey', () => {
  it('converts to lowercase', () => {
    expect(getCacheKey('Lightning Bolt')).toBe('lightning bolt')
  })

  it('trims whitespace', () => {
    expect(getCacheKey('  Card Name  ')).toBe('card name')
  })

  it('handles already lowercase input', () => {
    expect(getCacheKey('card name')).toBe('card name')
  })
})

describe('isFoil', () => {
  it('returns true for Foil card type', () => {
    const card = createMockCard({ card_type: 'Foil' })
    expect(isFoil(card)).toBe(true)
  })

  it('returns true for Holo card type', () => {
    const card = createMockCard({ card_type: 'Holo' })
    expect(isFoil(card)).toBe(true)
  })

  it('returns true when foil_type is set', () => {
    const card = createMockCard({ card_type: 'Normal', foil_type: 'Surge Foil' })
    expect(isFoil(card)).toBe(true)
  })

  it('returns false for Normal cards without foil_type', () => {
    const card = createMockCard({ card_type: 'Normal', foil_type: null })
    expect(isFoil(card)).toBe(false)
  })
})

describe('sortMatches', () => {
  it('sorts in-stock cards first', () => {
    const cards = [
      createMockCard({ id: 'oos', is_in_stock: false }),
      createMockCard({ id: 'in-stock', is_in_stock: true })
    ]
    const sorted = sortMatches(cards)
    expect(sorted[0]!.id).toBe('in-stock')
    expect(sorted[1]!.id).toBe('oos')
  })

  it('preserves order when stock status is equal', () => {
    const cards = [
      createMockCard({ id: 'first', is_in_stock: true }),
      createMockCard({ id: 'second', is_in_stock: true })
    ]
    const sorted = sortMatches(cards)
    expect(sorted[0]!.id).toBe('first')
    expect(sorted[1]!.id).toBe('second')
  })

  it('prefers foil when preferFoil is true', () => {
    const cards = [
      createMockCard({ id: 'normal', card_type: 'Normal', is_in_stock: true }),
      createMockCard({ id: 'foil', card_type: 'Foil', is_in_stock: true })
    ]
    const sorted = sortMatches(cards, true)
    expect(sorted[0]!.id).toBe('foil')
  })

  it('ignores foil preference when preferFoil is false', () => {
    const cards = [
      createMockCard({ id: 'normal', card_type: 'Normal', is_in_stock: true }),
      createMockCard({ id: 'foil', card_type: 'Foil', is_in_stock: true })
    ]
    const sorted = sortMatches(cards, false)
    expect(sorted[0]!.id).toBe('normal') // Original order preserved
  })

  it('stock status takes priority over foil preference', () => {
    const cards = [
      createMockCard({ id: 'foil-oos', card_type: 'Foil', is_in_stock: false }),
      createMockCard({ id: 'normal-in', card_type: 'Normal', is_in_stock: true })
    ]
    const sorted = sortMatches(cards, true)
    expect(sorted[0]!.id).toBe('normal-in') // In-stock beats foil preference
  })

  it('does not modify original array', () => {
    const cards = [
      createMockCard({ id: 'oos', is_in_stock: false }),
      createMockCard({ id: 'in-stock', is_in_stock: true })
    ]
    const original = [...cards]
    sortMatches(cards)
    expect(cards[0]!.id).toBe(original[0]!.id)
  })
})
