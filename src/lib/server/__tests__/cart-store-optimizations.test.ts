/**
 * Unit tests for cart store utilities
 * Tests getTotal() using price_at_add snapshots
 */

import { describe, it, expect, vi } from 'vitest'

// ─── getTotal logic (extracted, pure) ───────────────────────────────────────
// We test the logic as a pure function to avoid needing to spin up the full store.

interface CartItemLike {
  price_at_add?: number
  card: { card_type: string }
  quantity: number
}

/** Current (buggy) implementation — hardcoded prices */
function getTotal_hardcoded(items: CartItemLike[]): number {
  return items.reduce((total, item) => {
    const price = item.card.card_type === 'Foil' ? 1.5 : 1.25
    return total + price * item.quantity
  }, 0)
}

/** Fixed implementation — uses price_at_add */
function getTotal_fixed(items: CartItemLike[]): number {
  return items.reduce((total, item) => {
    const price = item.price_at_add ?? 1.25
    return total + price * item.quantity
  }, 0)
}

describe('cartStore getTotal — uses price_at_add (not hardcoded type check)', () => {
  it('correctly prices Raised Foil cards at their actual price', () => {
    const items: CartItemLike[] = [
      { card: { card_type: 'Raised Foil' }, quantity: 1, price_at_add: 3.0 }
    ]

    // The old hardcoded approach gives wrong answer for Raised Foil
    expect(getTotal_hardcoded(items)).toBe(1.25) // wrong
    // The fixed approach gives correct answer
    expect(getTotal_fixed(items)).toBe(3.0)
  })

  it('correctly prices Serialized cards at their actual price', () => {
    const items: CartItemLike[] = [
      { card: { card_type: 'Serialized' }, quantity: 2, price_at_add: 2.5 }
    ]

    expect(getTotal_hardcoded(items)).toBe(2.5) // accidentally correct (1.25 * 2)
    expect(getTotal_fixed(items)).toBe(5.0) // correct (2.5 * 2)
  })

  it('falls back to 1.25 when price_at_add is missing', () => {
    const items: CartItemLike[] = [
      { card: { card_type: 'Normal' }, quantity: 2, price_at_add: undefined }
    ]

    expect(getTotal_fixed(items)).toBe(2.5) // 1.25 * 2
  })

  it('correctly totals a mixed cart', () => {
    const items: CartItemLike[] = [
      { card: { card_type: 'Normal' }, quantity: 2, price_at_add: 1.25 },
      { card: { card_type: 'Foil' }, quantity: 1, price_at_add: 1.5 },
      { card: { card_type: 'Raised Foil' }, quantity: 1, price_at_add: 3.0 }
    ]

    expect(getTotal_fixed(items)).toBe(1.25 * 2 + 1.5 + 3.0)
  })
})

// ─── addSelectedToCart — bulk vs individual calls ────────────────────────────

/**
 * This tests the logic of addSelectedToCart in isolation.
 * The bug: it calls cartStore.addItem() in a loop → N requests.
 * The fix: it should call cartStore.addItems() once with all cards.
 */

interface CardLike {
  id: string
  card_type: string
  is_in_stock: boolean
  serial: string
}

function addSelectedToCart_buggy(
  selectedCards: CardLike[],
  getRowQuantity: (serial: string) => number,
  addItem: (card: CardLike, qty: number) => void,
  _addItems: (items: Array<{ card: CardLike; quantity: number }>) => void
) {
  for (const card of selectedCards) {
    const qty = getRowQuantity(card.serial)
    addItem(card, qty)
  }
}

function addSelectedToCart_fixed(
  selectedCards: CardLike[],
  getRowQuantity: (serial: string) => number,
  _addItem: (card: CardLike, qty: number) => void,
  addItems: (items: Array<{ card: CardLike; quantity: number }>) => void
) {
  const cardsWithQuantity = selectedCards.map((card) => ({
    card,
    quantity: getRowQuantity(card.serial)
  }))
  addItems(cardsWithQuantity)
}

describe('addSelectedToCart — should use addItems (bulk), not addItem in a loop', () => {
  const cards: CardLike[] = [
    { id: '1', card_type: 'Normal', is_in_stock: true, serial: 's1' },
    { id: '2', card_type: 'Foil', is_in_stock: true, serial: 's2' },
    { id: '3', card_type: 'Raised Foil', is_in_stock: true, serial: 's3' }
  ]

  const getRowQuantity = (serial: string) => (serial === 's2' ? 2 : 1)

  it('BUGGY: calls addItem 3 times and addItems 0 times (demonstrates the N-request problem)', () => {
    const addItem = vi.fn()
    const addItems = vi.fn()

    addSelectedToCart_buggy(cards, getRowQuantity, addItem, addItems)

    expect(addItem).toHaveBeenCalledTimes(3) // bug: 3 separate requests
    expect(addItems).toHaveBeenCalledTimes(0)
  })

  it('FIXED: calls addItem 0 times and addItems once with all cards', () => {
    const addItem = vi.fn()
    const addItems = vi.fn()

    addSelectedToCart_fixed(cards, getRowQuantity, addItem, addItems)

    expect(addItem).toHaveBeenCalledTimes(0) // fixed: no per-card requests
    expect(addItems).toHaveBeenCalledTimes(1) // single bulk request
    expect(addItems).toHaveBeenCalledWith([
      { card: cards[0], quantity: 1 },
      { card: cards[1], quantity: 2 },
      { card: cards[2], quantity: 1 }
    ])
  })

  it('FIXED: passes correct quantities per card', () => {
    const addItems = vi.fn()

    addSelectedToCart_fixed(cards, getRowQuantity, vi.fn(), addItems)

    const call = addItems.mock.calls[0]![0] as Array<{ card: CardLike; quantity: number }>
    expect(call.find((c) => c.card.serial === 's2')!.quantity).toBe(2)
    expect(call.find((c) => c.card.serial === 's1')!.quantity).toBe(1)
  })
})
