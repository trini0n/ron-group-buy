// Server-synced Cart Store
// Manages local state while syncing with server-side cart

import type { Card } from '$lib/server/types'
import { browser } from '$app/environment'
import { cartRequestQueue } from '$lib/utils/request-queue'

// Types
export interface CartItem {
  id: string // Server-side item ID
  card: Card
  quantity: number
  price_at_add?: number
  added_at?: string
}

export interface CartBundle {
  id: string
  set_code: string
  quantity: number
  added_at?: string
  set: { set_code: string; set_name: string; price: number | null }
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
  let bundles = $state<CartBundle[]>([])
  let cartId = $state<string | null>(null)
  let version = $state(0)
  let isLoading = $state(false)
  let isSyncing = $state(false)
  let lastError = $state<string | null>(null)
  let validation = $state<CartValidation | null>(null)
  let pendingMerge = $state<MergeStatus | null>(null)
  let lastSyncAt = $state(0) // unix ms, updated after every successful syncFromServer

  // Monotonically-increasing generation counter for syncFromServer().
  // Prevents a stale in-flight fetch from writing to $state signals after
  // SvelteKit's invalidateAll() has torn down and rebuilt the reactive graph,
  // which causes the "can't access property 'prev', C is undefined" Svelte 5 crash.
  let syncGeneration = 0

  // Track item IDs whose removal has been optimistically applied but not yet
  // confirmed by the server. Prevents server responses from reinstating items
  // the user has already removed (CART-02).
  const pendingRemovals = new Set<string>()

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

  /**
   * Merge a server-returned item list into local state while preserving:
   * (a) existing display order (CART-03) — retained items stay at their current positions
   * (b) optimistic removals (CART-02) — items in pendingRemovals are filtered out even
   *     if the server still shows them (their DELETE request is still in flight)
   *
   * New items from the server (not currently in local list) are appended at the end.
   */
  function applyServerItems(serverItems: CartItem[]): void {
    const serverMap = new Map(serverItems.map((i) => [i.id, i]))

    // Preserve display order: keep items that exist on server and are not pending removal
    const retained = items
      .filter((i) => serverMap.has(i.id) && !pendingRemovals.has(i.id))
      .map((i) => serverMap.get(i.id)!)

    // Append genuinely new items from server (not in current local list)
    const existingIds = new Set(items.map((i) => i.id))
    const appended = serverItems.filter((i) => !existingIds.has(i.id) && !pendingRemovals.has(i.id))

    items = [...retained, ...appended]
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
   * Fetch cart from server and sync local state.
   *
   * Uses a generation counter so that if a newer syncFromServer() call starts
   * before this one completes (e.g. triggered by invalidateAll()), the stale
   * response is silently discarded instead of writing to $state signals that
   * may be in an inconsistent state — preventing the Svelte 5 signal crash:
   * "can't access property 'prev', C is undefined"
   */
  async function syncFromServer(): Promise<void> {
    if (!browser) return

    const myGeneration = ++syncGeneration
    isSyncing = true
    lastError = null

    try {
      const response = await fetch('/api/cart', { cache: 'no-store' })

      // A newer sync has already started — drop this stale response
      if (myGeneration !== syncGeneration) return

      if (!response.ok) {
        throw new Error('Failed to fetch cart')
      }

      const data = await response.json()

      // Check generation again after the second await
      if (myGeneration !== syncGeneration) return

      if (data.cart) {
        cartId = data.cart.id
        version = data.version || 0
      } else {
        cartId = null
        version = 0
      }

      applyServerItems(data.items || [])
      bundles = data.bundles || []
      validation = data.validation || null
      lastSyncAt = Date.now()

      persistLocal()
    } catch (err) {
      if (myGeneration !== syncGeneration) return
      console.error('Cart sync error:', err)
      lastError = 'Failed to sync cart'
    } finally {
      // Only clear isSyncing if we're still the active generation
      if (myGeneration === syncGeneration) {
        isSyncing = false
      }
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
      const existingItem = items[existingIndex]
      if (existingItem) {
        existingItem.quantity += quantity
        items = [...items]
      }
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

    // Queue the server sync to prevent concurrent modification conflicts
    return cartRequestQueue.enqueue(async () => {
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
          // Version conflict - resync and notify
          await syncFromServer()
          throw new Error('Version conflict - please try again')
        }

        if (!response.ok) {
          throw new Error('Failed to add item')
        }

        const data = await response.json()

        if (data.cart) {
          cartId = data.cart.id
          version = data.cart.version
        }
        applyServerItems(data.items || [])
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
    })
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
        const existingItem = newItems[existingIndex]
        if (existingItem) {
          existingItem.quantity += quantity
        }
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

    // Queue the server sync to prevent concurrent modification conflicts
    return cartRequestQueue.enqueue(async () => {
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
          // Version conflict - resync and notify
          await syncFromServer()
          throw new Error('Version conflict - please try again')
        }

        if (!response.ok) {
          throw new Error('Failed to add items')
        }

        const data = await response.json()

        if (data.cart) {
          cartId = data.cart.id
          version = data.cart.version
        }
        applyServerItems(data.items || [])
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
    })
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
        pendingRemovals.add(itemId) // Track until server confirms (CART-02)
      } else {
        // Create new array with updated item (new object reference for reactivity)
        items = items.map((i, idx) => (idx === itemIndex ? { ...i, quantity } : i))
      }
      persistLocal()
    }

    // Queue the server sync to prevent concurrent modification conflicts
    return cartRequestQueue.enqueue(async () => {
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
          // Version conflict - resync and retry
          pendingRemovals.delete(itemId)
          await syncFromServer()
          // Retry is already queued, don't call recursively
          throw new Error('Version conflict - please try again')
        }

        if (!response.ok) {
          throw new Error('Failed to update item')
        }

        const data = await response.json()

        if (data.cart) {
          version = data.cart.version
        }
        pendingRemovals.delete(itemId)
        applyServerItems(data.items || [])
        persistLocal()

        return true
      } catch (err) {
        pendingRemovals.delete(itemId)
        items = previousItems
        persistLocal()
        console.error('Update quantity error:', err)
        lastError = 'Failed to update quantity'
        return false
      }
    })
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
   * Apply a merge response from the pending endpoint directly to store state.
   * Avoids a syncFromServer() round-trip when the endpoint already returns cart state.
   */
  function applyMergeResponse(result: { cart: { id: string; version: number }; items: CartItem[] }): void {
    cartId = result.cart.id
    version = result.cart.version
    items = result.items
    persistLocal()
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
    const cardTotal = items.reduce((total, item) => {
      const price = item.price_at_add ?? 1.25
      return total + price * item.quantity
    }, 0)
    const bundleTotal = bundles.reduce((total, b) => {
      return total + (b.set.price ?? 0) * b.quantity
    }, 0)
    return cardTotal + bundleTotal
  }

  function getItemCount(): number {
    const cardCount = items.reduce((count, item) => count + item.quantity, 0)
    const bundleCount = bundles.reduce((count, b) => count + b.quantity, 0)
    return cardCount + bundleCount
  }

  function isInCart(cardId: string): boolean {
    return items.some((item) => item.card.id === cardId)
  }

  function isSetInCart(setCode: string): boolean {
    return bundles.some((b) => b.set_code === setCode)
  }

  /**
   * Add a set bundle to cart
   */
  async function addBundle(setCode: string, quantity: number = 1): Promise<boolean> {
    if (!browser) return false
    try {
      const response = await fetch('/api/cart/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_code: setCode, quantity })
      })
      if (!response.ok) throw new Error('Failed to add bundle')
      const data = await response.json()
      bundles = data.bundles || []
      return true
    } catch (err) {
      console.error('Add bundle error:', err)
      lastError = 'Failed to add set to cart'
      return false
    }
  }

  /**
   * Remove a bundle from cart
   */
  async function removeBundle(bundleId: string): Promise<boolean> {
    if (!browser) return false
    // Optimistic remove
    const previous = [...bundles]
    bundles = bundles.filter((b) => b.id !== bundleId)
    try {
      const response = await fetch(`/api/cart/bundles/${bundleId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to remove bundle')
      const data = await response.json()
      bundles = data.bundles || []
      return true
    } catch (err) {
      bundles = previous
      console.error('Remove bundle error:', err)
      lastError = 'Failed to remove set from cart'
      return false
    }
  }

  /**
   * Update bundle quantity (0 removes it)
   */
  async function updateBundleQuantity(bundleId: string, quantity: number): Promise<boolean> {
    if (!browser) return false
    if (quantity <= 0) return removeBundle(bundleId)
    // Optimistic update
    const previous = [...bundles]
    bundles = bundles.map((b) => b.id === bundleId ? { ...b, quantity } : b)
    try {
      const response = await fetch(`/api/cart/bundles/${bundleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      })
      if (!response.ok) throw new Error('Failed to update bundle')
      const data = await response.json()
      bundles = data.bundles || []
      return true
    } catch (err) {
      bundles = previous
      console.error('Update bundle error:', err)
      lastError = 'Failed to update set quantity'
      return false
    }
  }

  return {
    // State (read-only)
    get items() {
      return items
    },
    get bundles() {
      return bundles
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
    get lastSyncAt() {
      return lastSyncAt
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
    onAuthChange,
    applyMergeResponse,
    addBundle,
    removeBundle,
    updateBundleQuantity,

    // Helpers
    isInCart,
    isSetInCart
  }
}

export const cartStore = createCartStore()
