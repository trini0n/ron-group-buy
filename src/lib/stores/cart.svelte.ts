// Server-synced Cart Store
// Manages local state while syncing with server-side cart

import type { Card } from '$lib/server/types'
import { browser } from '$app/environment'

// Types
export interface CartItem {
  id: string // Server-side item ID
  card: Card
  quantity: number
  price_at_add?: number
  added_at?: string
}

export interface CartValidation {
  valid_items: Array<{
    cart_item_id: string
    card: Card
    quantity: number
    current_price: number
    is_available: boolean
  }>
  invalid_items: Array<{
    cart_item_id: string
    card_id: string
    card_name: string
    reason: 'sold_out' | 'listing_removed' | 'quantity_exceeded'
    requested_quantity: number
    available_quantity?: number
  }>
  price_changes: Array<{
    cart_item_id: string
    card_name: string
    old_price: number
    new_price: number
    difference: number
  }>
  quantity_adjustments: Array<{
    cart_item_id: string
    card_name: string
    requested_quantity: number
    adjusted_quantity: number
    reason: string
  }>
}

export interface MergeReport {
  items_added: Array<{ card_name: string; quantity: number; price: number }>
  items_combined: Array<{
    card_name: string
    previous_quantity: number
    added_quantity: number
    new_quantity: number
  }>
  items_removed: Array<{ card_name: string; quantity: number; reason: string }>
  qty_adjusted: Array<{
    card_name: string
    requested_quantity: number
    adjusted_quantity: number
    reason: string
  }>
}

export interface MergeStatus {
  merge_needed: boolean
  requires_confirmation: boolean
  user_has_cart: boolean
  guest_cart_items: number
  preview?: {
    items_to_add: number
    items_to_combine: number
    items_to_remove: number
    details: MergeReport
  }
}

const LOCAL_CART_KEY = 'group-buy-cart-local'

function createCartStore() {
  // State
  let items = $state<CartItem[]>([])
  let cartId = $state<string | null>(null)
  let version = $state(0)
  let isLoading = $state(false)
  let isSyncing = $state(false)
  let lastError = $state<string | null>(null)
  let validation = $state<CartValidation | null>(null)
  let pendingMerge = $state<MergeStatus | null>(null)

  // Load local cache on init (for instant UX before server sync)
  if (browser) {
    const cached = localStorage.getItem(LOCAL_CART_KEY)
    if (cached) {
      try {
        const data = JSON.parse(cached)
        items = data.items || []
        version = data.version || 0
      } catch {
        // Ignore invalid cache
      }
    }
  }

  // Persist to local storage for instant UI
  function persistLocal() {
    if (browser) {
      localStorage.setItem(
        LOCAL_CART_KEY,
        JSON.stringify({
          items,
          version,
          cartId
        })
      )
    }
  }

  // Clear local storage
  function clearLocal() {
    if (browser) {
      localStorage.removeItem(LOCAL_CART_KEY)
    }
  }

  /**
   * Fetch cart from server and sync local state
   */
  async function syncFromServer(): Promise<void> {
    if (!browser) return

    isSyncing = true
    lastError = null

    try {
      const response = await fetch('/api/cart')

      if (!response.ok) {
        throw new Error('Failed to fetch cart')
      }

      const data = await response.json()

      if (data.cart) {
        cartId = data.cart.id
        version = data.version || 0
      } else {
        cartId = null
        version = 0
      }

      items = data.items || []
      validation = data.validation || null

      persistLocal()
    } catch (err) {
      console.error('Cart sync error:', err)
      lastError = 'Failed to sync cart'
    } finally {
      isSyncing = false
    }
  }

  /**
   * Add item to cart (server-synced)
   */
  async function addItem(card: Card, quantity: number = 1): Promise<boolean> {
    if (!browser) return false

    // Optimistic update
    const existingIndex = items.findIndex((i) => i.card.id === card.id)
    const previousItems = [...items]

    if (existingIndex >= 0) {
      items[existingIndex].quantity += quantity
      items = [...items]
    } else {
      items = [
        ...items,
        {
          id: 'pending-' + Date.now(),
          card,
          quantity
        }
      ]
    }
    persistLocal()

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          quantity,
          expected_version: version > 0 ? version : undefined
        })
      })

      if (response.status === 409) {
        // Version conflict - resync
        await syncFromServer()
        // Retry once
        return addItem(card, quantity)
      }

      if (!response.ok) {
        throw new Error('Failed to add item')
      }

      const data = await response.json()

      if (data.cart) {
        cartId = data.cart.id
        version = data.cart.version
      }
      items = data.items || []
      persistLocal()

      return true
    } catch (err) {
      // Rollback
      items = previousItems
      persistLocal()
      console.error('Add to cart error:', err)
      lastError = 'Failed to add item to cart'
      return false
    }
  }

  /**
   * Add multiple items to cart (bulk operation, server-synced)
   */
  async function addItems(cardsWithQuantity: Array<{ card: Card; quantity: number }>): Promise<boolean> {
    if (!browser) return false

    // Optimistic update - add all items locally
    const previousItems = [...items]
    const newItems = [...items]

    for (const { card, quantity } of cardsWithQuantity) {
      const existingIndex = newItems.findIndex((i) => i.card.id === card.id)

      if (existingIndex >= 0) {
        newItems[existingIndex].quantity += quantity
      } else {
        newItems.push({
          id: 'pending-' + Date.now() + '-' + Math.random(),
          card,
          quantity
        })
      }
    }

    items = newItems
    persistLocal()

    try {
      const response = await fetch('/api/cart/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cardsWithQuantity.map(({ card, quantity }) => ({
            card_id: card.id,
            quantity
          })),
          expected_version: version > 0 ? version : undefined
        })
      })

      if (response.status === 409) {
        // Version conflict - resync
        await syncFromServer()
        // Retry once
        return addItems(cardsWithQuantity)
      }

      if (!response.ok) {
        throw new Error('Failed to add items')
      }

      const data = await response.json()

      if (data.cart) {
        cartId = data.cart.id
        version = data.cart.version
      }
      items = data.items || []
      persistLocal()

      return true
    } catch (err) {
      // Rollback
      items = previousItems
      persistLocal()
      console.error('Bulk add to cart error:', err)
      lastError = 'Failed to add items to cart'
      return false
    }
  }


  /**
   * Update item quantity (server-synced)
   */
  async function updateQuantity(itemId: string, quantity: number): Promise<boolean> {
    if (!browser) return false

    // Optimistic update - create new objects to ensure reactivity
    const previousItems = [...items]
    const itemIndex = items.findIndex((i) => i.id === itemId)

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        // Remove item
        items = items.filter((i) => i.id !== itemId)
      } else {
        // Create new array with updated item (new object reference for reactivity)
        items = items.map((i, idx) => 
          idx === itemIndex ? { ...i, quantity } : i
        )
      }
      persistLocal()
    }

    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          expected_version: version > 0 ? version : undefined
        })
      })

      if (response.status === 409) {
        await syncFromServer()
        return updateQuantity(itemId, quantity)
      }

      if (!response.ok) {
        throw new Error('Failed to update item')
      }

      const data = await response.json()

      if (data.cart) {
        version = data.cart.version
      }
      items = data.items || []
      persistLocal()

      return true
    } catch (err) {
      items = previousItems
      persistLocal()
      console.error('Update quantity error:', err)
      lastError = 'Failed to update quantity'
      return false
    }
  }

  /**
   * Remove item from cart
   */
  async function removeItem(itemId: string): Promise<boolean> {
    return updateQuantity(itemId, 0)
  }

  /**
   * Clear entire cart
   */
  async function clear(): Promise<boolean> {
    if (!browser) return false

    const previousItems = [...items]
    items = []
    persistLocal()

    try {
      const response = await fetch('/api/cart', { method: 'DELETE' })

      if (!response.ok) {
        throw new Error('Failed to clear cart')
      }

      version = 0
      clearLocal()
      return true
    } catch (err) {
      items = previousItems
      persistLocal()
      console.error('Clear cart error:', err)
      lastError = 'Failed to clear cart'
      return false
    }
  }

  /**
   * Check for pending merge after login
   */
  async function checkMergeStatus(): Promise<MergeStatus | null> {
    if (!browser) return null

    try {
      const response = await fetch('/api/cart/merge')
      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in, no merge needed
          return null
        }
        throw new Error('Failed to check merge status')
      }

      const data = await response.json()
      pendingMerge = data.merge_needed ? data : null
      return pendingMerge
    } catch (err) {
      console.error('Check merge error:', err)
      return null
    }
  }

  /**
   * Execute cart merge
   */
  async function executeMerge(confirm: boolean = false): Promise<MergeReport | null> {
    if (!browser) return null

    try {
      const response = await fetch('/api/cart/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm })
      })

      if (!response.ok) {
        throw new Error('Failed to merge cart')
      }

      const data = await response.json()
      pendingMerge = null

      // Resync after merge
      await syncFromServer()

      return data.report || null
    } catch (err) {
      console.error('Merge cart error:', err)
      return null
    }
  }

  /**
   * Skip merge (discard guest cart)
   */
  async function skipMerge(): Promise<void> {
    if (!browser) return

    try {
      await fetch('/api/cart/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true })
      })

      pendingMerge = null
      await syncFromServer()
    } catch (err) {
      console.error('Skip merge error:', err)
    }
  }

  /**
   * Validate cart (check for changes)
   */
  async function validate(): Promise<CartValidation | null> {
    if (!browser) return null

    try {
      const response = await fetch('/api/cart/validate', { method: 'POST' })

      if (!response.ok) {
        throw new Error('Failed to validate cart')
      }

      const data = await response.json()
      validation = data.validation
      return validation
    } catch (err) {
      console.error('Validate cart error:', err)
      return null
    }
  }

  /**
   * Handle auth state change - check for merge
   */
  async function onAuthChange(isLoggedIn: boolean): Promise<void> {
    if (isLoggedIn) {
      // User just logged in - check for merge
      await checkMergeStatus()
      await syncFromServer()
    } else {
      // User logged out - sync from server (will get empty or guest cart)
      await syncFromServer()
    }
  }

  // Computed values
  function getTotal(): number {
    return items.reduce((total, item) => {
      const price = item.card.card_type === 'Foil' ? 1.5 : 1.25
      return total + price * item.quantity
    }, 0)
  }

  function getItemCount(): number {
    return items.reduce((count, item) => count + item.quantity, 0)
  }

  return {
    // State (read-only)
    get items() {
      return items
    },
    get cartId() {
      return cartId
    },
    get version() {
      return version
    },
    get isLoading() {
      return isLoading
    },
    get isSyncing() {
      return isSyncing
    },
    get lastError() {
      return lastError
    },
    get validation() {
      return validation
    },
    get pendingMerge() {
      return pendingMerge
    },

    // Computed
    get total() {
      return getTotal()
    },
    get itemCount() {
      return getItemCount()
    },

    // Actions
    syncFromServer,
    addItem,
    addItems,
    updateQuantity,
    removeItem,
    clear,
    checkMergeStatus,
    executeMerge,
    skipMerge,
    validate,
    onAuthChange
  }
}

export const cartStore = createCartStore()
