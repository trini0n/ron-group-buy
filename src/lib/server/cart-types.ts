// Cart Types and Interfaces

import type { Card } from './types'

export interface CartItem {
  id: string
  cart_id: string
  card_id: string
  quantity: number
  price_at_add: number | null
  card_name_snapshot: string | null
  card_type_snapshot: string | null
  is_in_stock_snapshot: boolean
  added_at: string
  // Joined card data
  card?: Card
}

export interface Cart {
  id: string
  user_id: string | null
  guest_id: string | null
  version: number
  last_activity_at: string
  expires_at: string | null
  merged_into_cart_id: string | null
  previous_user_id: string | null
  created_at: string
  updated_at: string
  // Items with card data
  items?: CartItem[]
}

export interface CartValidationResult {
  valid_items: ValidatedCartItem[]
  invalid_items: InvalidCartItem[]
  price_changes: PriceChange[]
  quantity_adjustments: QuantityAdjustment[]
}

export interface ValidatedCartItem {
  cart_item_id: string
  card: Card
  quantity: number
  current_price: number
  is_available: boolean
}

export interface InvalidCartItem {
  cart_item_id: string
  card_id: string
  card_name: string
  reason: 'sold_out' | 'listing_removed' | 'quantity_exceeded'
  requested_quantity: number
  available_quantity?: number
}

export interface PriceChange {
  cart_item_id: string
  card_name: string
  old_price: number
  new_price: number
  difference: number
}

export interface QuantityAdjustment {
  cart_item_id: string
  card_name: string
  requested_quantity: number
  adjusted_quantity: number
  reason: string
}

export interface MergeReport {
  success: boolean
  items_added: MergeAddedItem[]
  items_combined: MergeCombinedItem[]
  items_removed: MergeRemovedItem[]
  qty_adjusted: MergeQtyAdjusted[]
  new_cart_version: number
}

export interface MergeAddedItem {
  card_name: string
  quantity: number
  price: number
}

export interface MergeCombinedItem {
  card_name: string
  previous_quantity: number
  added_quantity: number
  new_quantity: number
}

export interface MergeRemovedItem {
  card_name: string
  quantity: number
  reason: 'sold_out' | 'listing_removed' | 'duplicate_limit'
}

export interface MergeQtyAdjusted {
  card_name: string
  requested_quantity: number
  adjusted_quantity: number
  reason: string
}

export interface CartMergeOptions {
  force?: boolean // Skip freshness check
  dry_run?: boolean // Return report without applying
}

export interface CheckoutSession {
  id: string
  cart_id: string
  user_id: string
  cart_version_at_start: number
  cart_hash: string
  status: 'active' | 'completed' | 'expired' | 'invalidated'
  expires_at: string
  created_at: string
  completed_at: string | null
}

// API Request/Response types

export interface AddToCartRequest {
  card_id: string
  quantity: number
  guest_id?: string
}

export interface UpdateCartItemRequest {
  quantity: number
  expected_version?: number
}

export interface CartResponse {
  cart: Cart
  validation?: CartValidationResult
  version: number
}

export interface MergeCartRequest {
  guest_id: string
  options?: CartMergeOptions
}

export interface MergeCartResponse {
  success: boolean
  merged: boolean
  requires_confirmation: boolean
  report?: MergeReport
  message?: string
}

// Utility: Calculate price for a card type
export function getCardPrice(cardType: string): number {
  return cardType === 'Foil' ? 1.5 : 1.25
}

// Utility: Generate cart hash for drift detection
export function generateCartHash(items: CartItem[]): string {
  const sorted = [...items].sort((a, b) => a.card_id.localeCompare(b.card_id))
  const data = sorted.map((i) => `${i.card_id}:${i.quantity}`).join('|')
  // Simple hash - in production use crypto
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}

// Freshness threshold for auto-merge (24 hours)
export const CART_FRESHNESS_THRESHOLD_MS = 24 * 60 * 60 * 1000

// Check if a guest cart is "fresh" enough for auto-merge
export function isCartFresh(lastActivityAt: string): boolean {
  const lastActivity = new Date(lastActivityAt).getTime()
  const now = Date.now()
  return now - lastActivity < CART_FRESHNESS_THRESHOLD_MS
}
