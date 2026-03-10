/**
 * Unit tests for CartService
 * Focuses on batch operations and price cache efficiency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CartService } from '../cart-service'
import * as pricingModule from '../pricing'
import { FALLBACK_PRICES } from '../pricing'

// ─── Supabase mock builder ──────────────────────────────────────────────────

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  // Default chainable query mock
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis()
  }

  return {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
    ...overrides
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeCard(id: string, type = 'Normal') {
  return {
    id,
    card_name: `Card ${id}`,
    card_type: type,
    is_in_stock: true,
    set_code: 'TST',
    collector_number: '1',
    language: 'en',
    color_identity: null,
    mana_cost: null,
    type_line: null,
    flavor_name: null,
    is_retro: false,
    is_extended: false,
    is_borderless: false,
    is_showcase: false,
    is_new: false,
    serial: id + '-serial',
    scryfall_id: null,
    ron_image_url: null
  }
}

// ─── CartService.addItems — price cache efficiency ───────────────────────────

describe('CartService.addItems — price cache efficiency', () => {
  beforeEach(() => {
    vi.spyOn(pricingModule, 'fetchPrices').mockResolvedValue(FALLBACK_PRICES)
  })

  it('calls fetchPrices exactly once regardless of how many items are in the batch', async () => {
    const cards = [makeCard('a', 'Normal'), makeCard('b', 'Foil'), makeCard('c', 'Raised Foil')]

    // Build a mock that returns all three cards on the .in() query
    const supabase = buildSupabaseMock()
    const chain = supabase._chain

    // Sequence of calls made by addItems:
    // 1. carts.select('version').eq(...).single() → cart exists
    // 2. cards.select('*').in('id', [...]) → card data
    // 3. cart_items.select(...).eq(...) → existing items
    // 4. cart_items.insert(...)

    let callCount = 0
    chain.single.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First call: get cart version
        return Promise.resolve({ data: { version: 1 }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    // .in() returns the card list
    chain.in.mockResolvedValue({ data: cards, error: null })

    // existing cart items – none
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    chain.eq.mockReturnThis()

    // For getCartWithItems called at the end
    const finalChain = buildSupabaseMock()
    finalChain._chain.single.mockResolvedValue({
      data: { id: 'cart-1', version: 2 },
      error: null
    })
    finalChain._chain.eq.mockReturnThis()
    finalChain._chain.order.mockResolvedValue({ data: [], error: null })

    // Make each `from()` call return the right thing based on table name
    supabase.from.mockImplementation((table: string) => {
      if (table === 'carts') return finalChain._chain
      return chain
    })

    const service = new CartService(supabase as any)
    await service.addItems('cart-1', [
      { card_id: 'a', quantity: 1 },
      { card_id: 'b', quantity: 2 },
      { card_id: 'c', quantity: 1 }
    ])

    // fetchPrices should be called ONCE to warm the cache, then NOT again per-card
    expect(vi.mocked(pricingModule.fetchPrices)).toHaveBeenCalledTimes(1)
  })
})

// ─── CartService.addItems — batch insert vs individual ──────────────────────

describe('CartService.addItems — batch inserts', () => {
  it('inserts all new items in a single DB call, not N separate calls', async () => {
    vi.spyOn(pricingModule, 'fetchPrices').mockResolvedValue(FALLBACK_PRICES)

    const cards = [makeCard('x', 'Normal'), makeCard('y', 'Foil')]

    const supabase = buildSupabaseMock()
    const chain = supabase._chain

    let cartSingleCalled = false
    chain.single.mockImplementation(() => {
      if (!cartSingleCalled) {
        cartSingleCalled = true
        return Promise.resolve({ data: { version: 0 }, error: null })
      }
      // getCartWithItems final fetch
      return Promise.resolve({ data: { id: 'cart-1', version: 1 }, error: null })
    })

    chain.in.mockResolvedValue({ data: cards, error: null })
    chain.eq.mockReturnThis()
    chain.order.mockResolvedValue({ data: [], error: null })

    // No existing items
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })

    supabase.from.mockReturnValue(chain)

    const service = new CartService(supabase as any)
    await service.addItems('cart-1', [
      { card_id: 'x', quantity: 1 },
      { card_id: 'y', quantity: 1 }
    ])

    // insert should be called once with both items, not twice
    const insertCalls = chain.insert.mock.calls
    const cartItemInserts = insertCalls.filter(
      (call: unknown[]) => Array.isArray(call[0]) && (call[0] as unknown[]).length > 0
    )
    expect(cartItemInserts.length).toBe(1)
    expect((cartItemInserts[0] as unknown[][])[0]).toHaveLength(2)
  })
})
