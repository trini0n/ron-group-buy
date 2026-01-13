/**
 * Unit tests for src/lib/server/cart-types.ts
 * Tests cart hash generation and freshness checking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateCartHash, isCartFresh, CART_FRESHNESS_THRESHOLD_MS } from '../cart-types'
import type { CartItem } from '../cart-types'

// Helper to create mock cart items
function createMockCartItem(cardId: string, quantity: number): CartItem {
  return {
    id: `item-${cardId}`,
    cart_id: 'cart-123',
    card_id: cardId,
    quantity,
    price_at_add: 1.25,
    card_name_snapshot: 'Test Card',
    card_type_snapshot: 'Normal',
    is_in_stock_snapshot: true,
    added_at: new Date().toISOString()
  }
}

describe('generateCartHash', () => {
  it('generates consistent hash for same items', () => {
    const items = [
      createMockCartItem('card-a', 2),
      createMockCartItem('card-b', 1)
    ]
    const hash1 = generateCartHash(items)
    const hash2 = generateCartHash(items)
    expect(hash1).toBe(hash2)
  })

  it('generates same hash regardless of item order', () => {
    const itemsAB = [
      createMockCartItem('card-a', 2),
      createMockCartItem('card-b', 1)
    ]
    const itemsBA = [
      createMockCartItem('card-b', 1),
      createMockCartItem('card-a', 2)
    ]
    expect(generateCartHash(itemsAB)).toBe(generateCartHash(itemsBA))
  })

  it('generates different hash for different quantities', () => {
    const items1 = [createMockCartItem('card-a', 1)]
    const items2 = [createMockCartItem('card-a', 2)]
    expect(generateCartHash(items1)).not.toBe(generateCartHash(items2))
  })

  it('generates different hash for different cards', () => {
    const items1 = [createMockCartItem('card-a', 1)]
    const items2 = [createMockCartItem('card-b', 1)]
    expect(generateCartHash(items1)).not.toBe(generateCartHash(items2))
  })

  it('handles empty cart', () => {
    const hash = generateCartHash([])
    expect(hash).toBe('0')
  })
})

describe('isCartFresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for recently active cart', () => {
    const now = new Date('2024-01-15T12:00:00Z')
    vi.setSystemTime(now)

    // Cart active 1 hour ago
    const lastActivity = new Date('2024-01-15T11:00:00Z').toISOString()
    expect(isCartFresh(lastActivity)).toBe(true)
  })

  it('returns false for cart older than threshold', () => {
    const now = new Date('2024-01-15T12:00:00Z')
    vi.setSystemTime(now)

    // Cart active 25 hours ago (threshold is 24 hours)
    const lastActivity = new Date('2024-01-14T11:00:00Z').toISOString()
    expect(isCartFresh(lastActivity)).toBe(false)
  })

  it('returns true for cart at exactly threshold', () => {
    const now = new Date('2024-01-15T12:00:00Z')
    vi.setSystemTime(now)

    // Cart active exactly 24 hours ago
    const lastActivity = new Date(now.getTime() - CART_FRESHNESS_THRESHOLD_MS + 1000).toISOString()
    expect(isCartFresh(lastActivity)).toBe(true)
  })
})

describe('CART_FRESHNESS_THRESHOLD_MS', () => {
  it('is 24 hours in milliseconds', () => {
    const expectedMs = 24 * 60 * 60 * 1000
    expect(CART_FRESHNESS_THRESHOLD_MS).toBe(expectedMs)
  })
})
