// Server-side Cart Service
// Handles all cart operations with proper validation and merge logic

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card } from './types'
import {
  type Cart,
  type CartItem,
  type CartValidationResult,
  type ValidatedCartItem,
  type InvalidCartItem,
  type PriceChange,
  type QuantityAdjustment,
  type MergeReport,
  type MergeAddedItem,
  type MergeCombinedItem,
  type MergeRemovedItem,
  type MergeQtyAdjusted,
  type CartMergeOptions,
  getCardPrice,
  generateCartHash,
  isCartFresh
} from './cart-types'

export class CartService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get or create a cart for a user or guest
   */
  async getOrCreateCart(userId?: string, guestId?: string): Promise<Cart> {
    if (!userId && !guestId) {
      throw new Error('Either userId or guestId must be provided')
    }

    // Try to find existing cart
    let query = this.supabase.from('carts').select('*')

    if (userId) {
      query = query.eq('user_id', userId)
    } else {
      query = query.eq('guest_id', guestId)
    }

    const { data: existingCart } = await query.maybeSingle()

    if (existingCart) {
      return existingCart as Cart
    }

    // Create new cart
    const { data: newCart, error } = await this.supabase
      .from('carts')
      .insert({
        user_id: userId || null,
        guest_id: guestId || null
      })
      .select()
      .single()

    if (error) throw error
    return newCart as Cart
  }

  /**
   * Get cart with items and full card data
   */
  async getCartWithItems(cartId: string): Promise<Cart & { items: (CartItem & { card: Card })[] }> {
    const { data: cart, error: cartError } = await this.supabase.from('carts').select('*').eq('id', cartId).single()

    if (cartError) throw cartError

    const { data: items, error: itemsError } = await this.supabase
      .from('cart_items')
      .select(
        `
        *,
        card:cards(*)
      `
      )
      .eq('cart_id', cartId)
      .order('added_at', { ascending: true })

    if (itemsError) throw itemsError

    return {
      ...cart,
      items: items || []
    } as Cart & { items: (CartItem & { card: Card })[] }
  }

  /**
   * Get cart by user ID with items
   */
  async getUserCart(userId: string): Promise<(Cart & { items: (CartItem & { card: Card })[] }) | null> {
    const { data: cart } = await this.supabase.from('carts').select('*').eq('user_id', userId).maybeSingle()

    if (!cart) return null

    return this.getCartWithItems(cart.id)
  }

  /**
   * Get cart by guest ID with items
   */
  async getGuestCart(guestId: string): Promise<(Cart & { items: (CartItem & { card: Card })[] }) | null> {
    const { data: cart } = await this.supabase
      .from('carts')
      .select('*')
      .eq('guest_id', guestId)
      .is('merged_into_cart_id', null) // Don't return merged carts
      .maybeSingle()

    if (!cart) return null

    return this.getCartWithItems(cart.id)
  }

  /**
   * Add item to cart with price snapshot
   */
  async addItem(
    cartId: string,
    cardId: string,
    quantity: number,
    expectedVersion?: number
  ): Promise<{ success: boolean; cart: Cart; error?: string }> {
    // Get current cart version
    const { data: cart, error: cartError } = await this.supabase
      .from('carts')
      .select('version')
      .eq('id', cartId)
      .single()

    if (cartError) {
      return { success: false, cart: null as any, error: 'Cart not found' }
    }

    // Optimistic concurrency check
    if (expectedVersion !== undefined && cart.version !== expectedVersion) {
      return {
        success: false,
        cart: null as any,
        error: `Version mismatch: expected ${expectedVersion}, got ${cart.version}`
      }
    }

    // Get card data for snapshot
    const { data: card, error: cardError } = await this.supabase.from('cards').select('*').eq('id', cardId).single()

    if (cardError || !card) {
      return { success: false, cart: null as any, error: 'Card not found' }
    }

    if (!card.is_in_stock) {
      return { success: false, cart: null as any, error: 'Card is out of stock' }
    }

    const price = getCardPrice(card.card_type)

    // Check if item already exists
    const { data: existingItem } = await this.supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('card_id', cardId)
      .maybeSingle()

    if (existingItem) {
      // Update quantity
      const { error: updateError } = await this.supabase
        .from('cart_items')
        .update({ quantity: existingItem.quantity + quantity })
        .eq('id', existingItem.id)

      if (updateError) {
        return { success: false, cart: null as any, error: updateError.message }
      }
    } else {
      // Insert new item with snapshot
      const { error: insertError } = await this.supabase.from('cart_items').insert({
        cart_id: cartId,
        card_id: cardId,
        quantity,
        price_at_add: price,
        card_name_snapshot: card.card_name,
        card_type_snapshot: card.card_type,
        is_in_stock_snapshot: card.is_in_stock
      })

      if (insertError) {
        return { success: false, cart: null as any, error: insertError.message }
      }
    }

    // Return updated cart
    const updatedCart = await this.getCartWithItems(cartId)
    return { success: true, cart: updatedCart }
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
    expectedVersion?: number
  ): Promise<{ success: boolean; cart: Cart; error?: string }> {
    // Get current cart version
    const { data: cart, error: cartError } = await this.supabase
      .from('carts')
      .select('version')
      .eq('id', cartId)
      .single()

    if (cartError) {
      return { success: false, cart: null as any, error: 'Cart not found' }
    }

    // Optimistic concurrency check
    if (expectedVersion !== undefined && cart.version !== expectedVersion) {
      return {
        success: false,
        cart: null as any,
        error: `Version mismatch: expected ${expectedVersion}, got ${cart.version}`
      }
    }

    if (quantity <= 0) {
      // Remove item
      const { error } = await this.supabase.from('cart_items').delete().eq('id', itemId).eq('cart_id', cartId)

      if (error) {
        return { success: false, cart: null as any, error: error.message }
      }
    } else {
      // Update quantity
      const { error } = await this.supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId)
        .eq('cart_id', cartId)

      if (error) {
        return { success: false, cart: null as any, error: error.message }
      }
    }

    const updatedCart = await this.getCartWithItems(cartId)
    return { success: true, cart: updatedCart }
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    cartId: string,
    itemId: string,
    expectedVersion?: number
  ): Promise<{ success: boolean; cart: Cart; error?: string }> {
    return this.updateItemQuantity(cartId, itemId, 0, expectedVersion)
  }

  /**
   * Clear all items from cart
   */
  async clearCart(cartId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase.from('cart_items').delete().eq('cart_id', cartId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Validate cart items against current inventory and prices
   */
  async validateCart(cartId: string): Promise<CartValidationResult> {
    const cart = await this.getCartWithItems(cartId)

    const valid_items: ValidatedCartItem[] = []
    const invalid_items: InvalidCartItem[] = []
    const price_changes: PriceChange[] = []
    const quantity_adjustments: QuantityAdjustment[] = []

    for (const item of cart.items) {
      const card = item.card

      if (!card) {
        // Card was deleted
        invalid_items.push({
          cart_item_id: item.id,
          card_id: item.card_id,
          card_name: item.card_name_snapshot || 'Unknown Card',
          reason: 'listing_removed',
          requested_quantity: item.quantity
        })
        continue
      }

      if (!card.is_in_stock) {
        // Card is now out of stock
        invalid_items.push({
          cart_item_id: item.id,
          card_id: item.card_id,
          card_name: card.card_name,
          reason: 'sold_out',
          requested_quantity: item.quantity
        })
        continue
      }

      const currentPrice = getCardPrice(card.card_type)

      // Check for price changes
      if (item.price_at_add && item.price_at_add !== currentPrice) {
        price_changes.push({
          cart_item_id: item.id,
          card_name: card.card_name,
          old_price: item.price_at_add,
          new_price: currentPrice,
          difference: currentPrice - item.price_at_add
        })
      }

      valid_items.push({
        cart_item_id: item.id,
        card,
        quantity: item.quantity,
        current_price: currentPrice,
        is_available: true
      })
    }

    return {
      valid_items,
      invalid_items,
      price_changes,
      quantity_adjustments
    }
  }

  /**
   * Check if merge should require user confirmation
   */
  async shouldPromptMerge(guestId: string, userId: string): Promise<boolean> {
    const guestCart = await this.getGuestCart(guestId)

    if (!guestCart || guestCart.items.length === 0) {
      return false // No guest cart or empty, no merge needed
    }

    // Check if guest cart was previously associated with this user
    if (guestCart.previous_user_id === userId) {
      return false // Auto-merge, same user
    }

    // Check freshness
    if (isCartFresh(guestCart.last_activity_at)) {
      return false // Auto-merge, cart is fresh
    }

    // Cart is stale and from unknown user - prompt
    return true
  }

  /**
   * Merge guest cart into user cart
   */
  async mergeGuestCart(guestId: string, userId: string, options: CartMergeOptions = {}): Promise<MergeReport> {
    const guestCart = await this.getGuestCart(guestId)

    if (!guestCart || guestCart.items.length === 0) {
      return {
        success: true,
        items_added: [],
        items_combined: [],
        items_removed: [],
        qty_adjusted: [],
        new_cart_version: 0
      }
    }

    // Get or create user cart
    const userCart = await this.getOrCreateCart(userId)
    const userCartWithItems = await this.getCartWithItems(userCart.id)

    const items_added: MergeAddedItem[] = []
    const items_combined: MergeCombinedItem[] = []
    const items_removed: MergeRemovedItem[] = []
    const qty_adjusted: MergeQtyAdjusted[] = []

    // Build a map of user cart items by card_id
    const userItemsByCard = new Map<string, CartItem & { card: Card }>()
    for (const item of userCartWithItems.items) {
      userItemsByCard.set(item.card_id, item)
    }

    // Process each guest cart item
    for (const guestItem of guestCart.items) {
      const card = guestItem.card

      if (!card) {
        items_removed.push({
          card_name: guestItem.card_name_snapshot || 'Unknown Card',
          quantity: guestItem.quantity,
          reason: 'listing_removed'
        })
        continue
      }

      if (!card.is_in_stock) {
        items_removed.push({
          card_name: card.card_name,
          quantity: guestItem.quantity,
          reason: 'sold_out'
        })
        continue
      }

      const currentPrice = getCardPrice(card.card_type)
      const existingUserItem = userItemsByCard.get(guestItem.card_id)

      if (!options.dry_run) {
        if (existingUserItem) {
          // Combine quantities
          const newQuantity = existingUserItem.quantity + guestItem.quantity

          await this.supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', existingUserItem.id)

          items_combined.push({
            card_name: card.card_name,
            previous_quantity: existingUserItem.quantity,
            added_quantity: guestItem.quantity,
            new_quantity: newQuantity
          })
        } else {
          // Add new item to user cart
          await this.supabase.from('cart_items').insert({
            cart_id: userCart.id,
            card_id: guestItem.card_id,
            quantity: guestItem.quantity,
            price_at_add: currentPrice,
            card_name_snapshot: card.card_name,
            card_type_snapshot: card.card_type,
            is_in_stock_snapshot: card.is_in_stock
          })

          items_added.push({
            card_name: card.card_name,
            quantity: guestItem.quantity,
            price: currentPrice
          })
        }
      } else {
        // Dry run - just report what would happen
        if (existingUserItem) {
          items_combined.push({
            card_name: card.card_name,
            previous_quantity: existingUserItem.quantity,
            added_quantity: guestItem.quantity,
            new_quantity: existingUserItem.quantity + guestItem.quantity
          })
        } else {
          items_added.push({
            card_name: card.card_name,
            quantity: guestItem.quantity,
            price: currentPrice
          })
        }
      }
    }

    // Mark guest cart as merged (don't delete for audit)
    if (!options.dry_run) {
      await this.supabase
        .from('carts')
        .update({
          merged_into_cart_id: userCart.id,
          previous_user_id: userId
        })
        .eq('id', guestCart.id)

      // Clear guest cart items
      await this.supabase.from('cart_items').delete().eq('cart_id', guestCart.id)

      // Record merge history
      await this.supabase.from('cart_merge_history').insert({
        target_cart_id: userCart.id,
        source_cart_id: guestCart.id,
        source_guest_id: guestId,
        user_id: userId,
        items_added: items_added.length,
        items_combined: items_combined.length,
        items_removed: items_removed.length,
        qty_adjusted: qty_adjusted.length,
        merge_details: { items_added, items_combined, items_removed, qty_adjusted }
      })
    }

    // Get final cart version
    const { data: finalCart } = await this.supabase.from('carts').select('version').eq('id', userCart.id).single()

    return {
      success: true,
      items_added,
      items_combined,
      items_removed,
      qty_adjusted,
      new_cart_version: finalCart?.version || 0
    }
  }

  /**
   * Convert guest cart to user cart on login (when no existing user cart)
   */
  async claimGuestCart(guestId: string, userId: string): Promise<Cart | null> {
    const { data: guestCart } = await this.supabase
      .from('carts')
      .select('*')
      .eq('guest_id', guestId)
      .is('merged_into_cart_id', null)
      .maybeSingle()

    if (!guestCart) return null

    // Convert guest cart to user cart
    const { data: claimedCart, error } = await this.supabase
      .from('carts')
      .update({
        user_id: userId,
        guest_id: null,
        expires_at: null,
        previous_user_id: userId
      })
      .eq('id', guestCart.id)
      .select()
      .single()

    if (error) throw error

    return claimedCart as Cart
  }

  /**
   * Create checkout session with drift detection
   */
  async createCheckoutSession(
    cartId: string,
    userId: string
  ): Promise<{ session_id: string; expires_at: string } | { error: string }> {
    const cart = await this.getCartWithItems(cartId)

    if (!cart || cart.items.length === 0) {
      return { error: 'Cart is empty' }
    }

    // Validate cart first
    const validation = await this.validateCart(cartId)

    if (validation.invalid_items.length > 0) {
      return { error: 'Cart contains invalid items. Please review your cart.' }
    }

    const cartHash = generateCartHash(cart.items)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    // Invalidate any existing active sessions
    await this.supabase
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('cart_id', cartId)
      .eq('status', 'active')

    const { data: session, error } = await this.supabase
      .from('checkout_sessions')
      .insert({
        cart_id: cartId,
        user_id: userId,
        cart_version_at_start: cart.version,
        cart_hash: cartHash,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    return {
      session_id: session.id,
      expires_at: session.expires_at
    }
  }

  /**
   * Validate checkout session (check for drift)
   */
  async validateCheckoutSession(
    sessionId: string
  ): Promise<{ valid: boolean; reason?: string; needs_refresh?: boolean }> {
    const { data: session, error } = await this.supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      return { valid: false, reason: 'Session not found' }
    }

    if (session.status !== 'active') {
      return { valid: false, reason: `Session is ${session.status}` }
    }

    if (new Date(session.expires_at) < new Date()) {
      await this.supabase.from('checkout_sessions').update({ status: 'expired' }).eq('id', sessionId)
      return { valid: false, reason: 'Session expired', needs_refresh: true }
    }

    // Check for cart drift
    const cart = await this.getCartWithItems(session.cart_id)
    const currentHash = generateCartHash(cart.items)

    if (cart.version !== session.cart_version_at_start || currentHash !== session.cart_hash) {
      await this.supabase.from('checkout_sessions').update({ status: 'invalidated' }).eq('id', sessionId)
      return { valid: false, reason: 'Cart was modified', needs_refresh: true }
    }

    return { valid: true }
  }

  /**
   * Complete checkout session
   */
  async completeCheckoutSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('checkout_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)
  }
}
