import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchPrices } from '$lib/server/pricing'
import { getCardPrice } from '$lib/utils'
import { ensureUserRow } from '$lib/server/user-profile'
import { logger } from '$lib/server/logger'
import { z } from 'zod'
import { CartService } from '$lib/server/cart-service'

const AddressSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone_number: z.string().optional(),
  is_default: z.boolean().optional()
})

const OrderItemSchema = z.object({
  cardId: z.string().min(1),
  serial: z.string().min(1),
  name: z.string().min(1),
  cardType: z.string().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number(),
  setCode: z.string().nullable().optional(),
  collectorNumber: z.string().nullable().optional(),
  isFoil: z.boolean().optional(),
  isEtched: z.boolean().optional(),
  language: z.string().optional()
})

const CreateOrderSchema = z.object({
  addressId: z.string().optional(),
  newAddress: AddressSchema.optional(),
  shippingType: z.enum(['regular', 'express']).optional(),
  items: z.array(OrderItemSchema).min(1),
  action: z.enum(['replace', 'merge']).optional(),
  paypalEmail: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(1),
  discordUsername: z
    .string()
    .regex(/^[a-zA-Z0-9_.]{2,32}$/, 'Invalid Discord username format')
    .optional(),
  cartId: z.string().optional(),
  cartVersion: z.number().optional(),
  notes: z.string().optional(),
  checkout_session_id: z.string().optional()
})

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

interface OrderItem {
  cardId: string
  serial: string
  name: string
  cardType: string
  quantity: number
  unitPrice: number
  // Identity fields for stable matching across resyncs
  setCode?: string | null
  collectorNumber?: string | null
  isFoil?: boolean
  isEtched?: boolean
  language?: string
}

export const POST: RequestHandler = async ({ request, locals }) => {
  // Require authentication
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  const parseResult = CreateOrderSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const {
    addressId,
    newAddress,
    shippingType,
    items,
    action,
    paypalEmail,
    phoneNumber,
    discordUsername,
    cartId,
    cartVersion,
    notes,
    checkout_session_id
  } = parseResult.data

  let replaceOldOrderId: string | null = null

  const e164Regex = /^\+[1-9]\d{1,14}$/
  if (!e164Regex.test(String(phoneNumber).trim())) {
    throw error(400, 'Invalid phone number format. Must be E.164 (e.g. +15551234567)')
  }

  // Validate checkout session if provided (prevents cart drift between form open and submit)
  if (checkout_session_id) {
    const cartService = new CartService(locals.supabase)
    const sessionResult = await cartService.validateCheckoutSession(checkout_session_id)
    if (!sessionResult.valid) {
      return json(
        {
          error: sessionResult.reason ?? 'Checkout session invalid',
          needs_refresh: sessionResult.needs_refresh ?? false
        },
        { status: 409 }
      )
    }
  }

  // Fetch user data first to see if they already have Discord linked
  const { data: currentUserData } = await locals.supabase
    .from('users')
    .select('discord_id, discord_username')
    .eq('id', locals.user.id)
    .single()

  const hasDiscordLinked = Boolean(currentUserData?.discord_id || currentUserData?.discord_username)

  if (!hasDiscordLinked && (!discordUsername || !String(discordUsername).trim())) {
    throw error(400, 'Discord Username is required')
  }

  // Get active group buy
  const { data: activeGroupBuy } = await locals.supabase
    .from('group_buy_config')
    .select('id')
    .eq('is_active', true)
    .single()

  // Check for existing pending order in this group buy
  const { data: existingOrder } = activeGroupBuy
    ? await locals.supabase
        .from('orders')
        .select(
          `
      id, 
      order_number,
      order_items (
        id,
        quantity,
        unit_price
      )
    `
        )
        .eq('user_id', locals.user.id)
        .eq('group_buy_id', activeGroupBuy.id)
        .eq('status', 'pending')
        .single()
    : { data: null }

  // If there's an existing pending order
  if (existingOrder && activeGroupBuy) {
    // If no action specified, return confirmation request
    if (!action) {
      const itemCount =
        existingOrder.order_items?.reduce(
          (sum: number, item: { quantity: number | null }) => sum + (item.quantity ?? 1),
          0
        ) ?? 0
      const total =
        existingOrder.order_items?.reduce(
          (sum: number, item: { quantity: number | null; unit_price: number | string }) =>
            sum + (item.quantity ?? 1) * Number(item.unit_price),
          0
        ) ?? 0

      return json({
        requiresConfirmation: true,
        existingOrder: {
          id: existingOrder.id,
          orderNumber: existingOrder.order_number,
          itemCount,
          total
        }
      })
    }

    // Handle actions
    if (action === 'merge') {
      return await mergeIntoExistingOrder(existingOrder, items, locals)
    }

    if (action === 'replace') {
      // Track old order ID — the atomic RPC will handle deletion + creation together
      replaceOldOrderId = existingOrder.id
    }
  }

  // Validate address
  let shippingAddress

  if (addressId) {
    // Use existing address
    const { data: address, error: addressError } = await locals.supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', locals.user.id)
      .single()

    if (addressError || !address) {
      throw error(400, 'Invalid address')
    }

    // Update the existing address with the new phone number
    if (address.phone_number !== String(phoneNumber).trim()) {
      const { error: updateError } = await locals.supabase
        .from('addresses')
        .update({ phone_number: String(phoneNumber).trim() })
        .eq('id', addressId)

      if (updateError) {
        logger.warn({ error: updateError }, 'Error updating address phone number')
      } else {
        address.phone_number = String(phoneNumber).trim()
      }
    }

    shippingAddress = address
  } else if (newAddress) {
    // Validate new address fields
    if (!newAddress.name || !newAddress.line1 || !newAddress.city || !newAddress.postal_code || !newAddress.country) {
      throw error(400, 'Missing required address fields')
    }

    // Verify user exists in users table - if not, create it (handles auth callback sync failures)
    await ensureUserRow(locals.supabase, locals.user)

    // Save the new address
    const { data: savedAddress, error: saveError } = await locals.supabase
      .from('addresses')
      .insert({
        user_id: locals.user.id,
        ...newAddress,
        phone_number: String(phoneNumber).trim(),
        is_default: true
      })
      .select()
      .single()

    if (saveError) {
      logger.error(
        {
          error: saveError,
          errorCode: saveError.code,
          errorMessage: saveError.message,
          errorDetails: saveError.details,
          errorHint: saveError.hint,
          userId: locals.user.id,
          addressData: newAddress
        },
        'Failed to save address'
      )
      throw error(500, `Failed to save address: ${saveError.message || 'Unknown error'}`)
    }
    shippingAddress = savedAddress
  } else {
    throw error(400, 'No address provided')
  }

  // Update user's PayPal email and Discord username
  const updateData: { paypal_email: string; discord_username?: string } = { paypal_email: String(paypalEmail).trim() }
  if (discordUsername && String(discordUsername).trim()) {
    updateData.discord_username = String(discordUsername).trim()
  }

  // Check if user has discord_id or if we are skipping discord validation for local testing?
  // The client enforces the discord username check, we will trust the client for now but update the profile unconditionally if string provided.

  const { error: profileError } = await locals.supabase.from('users').update(updateData).eq('id', locals.user.id)

  if (profileError) {
    logger.error(
      { error: profileError, userId: locals.user.id },
      'Error updating user profile (paypal_email/discord_username)'
    )
    // This is not a critical error to stop the order, but log it.
  }

  // Resolve prices and card types server-side (security: never trust client-supplied unitPrice)
  // Fetch foil_type alongside card_type so we can compute the effective finish for pricing
  const prices = await fetchPrices(locals.supabase)
  const cardIds = items.map((item: OrderItem) => item.cardId)
  const { data: cardRows, error: cardFetchErr } = await locals.supabase
    .from('cards')
    .select('id, card_type, foil_type')
    .in('id', cardIds)
  if (cardFetchErr) {
    throw error(500, 'Failed to fetch card pricing data')
  }
  // Map card_id -> base card_type (for the card_type column in order_items)
  const serverCardTypeMap = new Map(cardRows?.map((r: { id: string; card_type: string }) => [r.id, r.card_type]) ?? [])
  // Map card_id -> effective finish (foil_type ?? card_type) used for price resolution
  const serverFinishMap = new Map(
    cardRows?.map((r: { id: string; card_type: string; foil_type?: string | null }) => [
      r.id,
      r.foil_type ?? r.card_type
    ]) ?? []
  )

  // Build items payload for the RPC — no order_id, the DB function sets it
  const rpcItems = items.map((item: OrderItem) => ({
    card_id: item.cardId,
    card_serial: item.serial,
    card_name: item.name,
    // Use server-verified card_type (base type stored in DB) to prevent client spoofing
    card_type: serverCardTypeMap.get(item.cardId) ?? item.cardType,
    quantity: item.quantity,
    // Use effective finish (foil_type ?? card_type) for pricing — Raised Foil = $3.00, etc.
    unit_price: getCardPrice(serverFinishMap.get(item.cardId) ?? item.cardType, prices),
    set_code: item.setCode || null,
    collector_number: item.collectorNumber || null,
    is_foil: item.isFoil ?? false,
    is_etched: item.isEtched ?? false,
    language: item.language || 'en'
  }))

  if (replaceOldOrderId) {
    const { data: rpcResult, error: rpcError } = await locals.supabase.rpc('replace_order' as any, {
      p_user_id: locals.user.id,
      p_old_order_id: replaceOldOrderId,
      p_order_number: generateOrderNumber(),
      p_group_buy_id: activeGroupBuy?.id ?? null,
      p_shipping_type: shippingType || 'regular',
      p_shipping_name: shippingAddress.name,
      p_shipping_line1: shippingAddress.line1,
      p_shipping_line2: shippingAddress.line2 ?? null,
      p_shipping_city: shippingAddress.city,
      p_shipping_state: shippingAddress.state ?? null,
      p_shipping_postal_code: shippingAddress.postal_code,
      p_shipping_country: shippingAddress.country,
      p_shipping_phone_number: String(phoneNumber).trim(),
      p_notes: notes || null,
      p_items: rpcItems
    })
    if (rpcError || !rpcResult) {
      logger.error(
        { error: rpcError, userId: locals.user.id, oldOrderId: replaceOldOrderId },
        'replace_order RPC failed'
      )
      throw error(500, 'Failed to replace order')
    }
    const replaceResult = rpcResult as { order_id: string; order_number: string }
    return json({ orderId: replaceResult.order_id, orderNumber: replaceResult.order_number })
  }

  const { data: rpcResult, error: rpcError } = await locals.supabase.rpc('create_order_with_items' as any, {
    p_user_id: locals.user.id,
    p_order_number: generateOrderNumber(),
    p_group_buy_id: activeGroupBuy?.id ?? null,
    p_shipping_type: shippingType || 'regular',
    p_shipping_name: shippingAddress.name,
    p_shipping_line1: shippingAddress.line1,
    p_shipping_line2: shippingAddress.line2 ?? null,
    p_shipping_city: shippingAddress.city,
    p_shipping_state: shippingAddress.state ?? null,
    p_shipping_postal_code: shippingAddress.postal_code,
    p_shipping_country: shippingAddress.country,
    p_shipping_phone_number: String(phoneNumber).trim(),
    p_notes: notes || null,
    p_items: rpcItems
  })
  if (rpcError || !rpcResult) {
    logger.error(
      { error: rpcError, userId: locals.user.id, itemCount: rpcItems.length },
      'create_order_with_items RPC failed'
    )
    throw error(500, 'Failed to create order')
  }
  const createResult = rpcResult as { order_id: string; order_number: string }
  return json({ orderId: createResult.order_id, orderNumber: createResult.order_number })
}

/**
 * Merge new items into an existing pending order.
 * For duplicate cards, quantities are summed.
 */
async function mergeIntoExistingOrder(
  existingOrder: { id: string; order_number: string },
  newItems: OrderItem[],
  locals: App.Locals
) {
  // Resolve prices server-side for new items (security: never trust client-supplied unitPrice)
  // Fetch foil_type so we can compute the effective finish for pricing
  const mergePrices = await fetchPrices(locals.supabase)
  const newCardIds = newItems.map((i) => i.cardId)
  const { data: mergeCardRows } = await locals.supabase
    .from('cards')
    .select('id, card_type, foil_type')
    .in('id', newCardIds)
  const mergeCardTypeMap = new Map(
    mergeCardRows?.map((r: { id: string; card_type: string }) => [r.id, r.card_type]) ?? []
  )
  // Effective finish map for pricing (foil_type ?? card_type)
  const mergeFinishMap = new Map(
    mergeCardRows?.map((r: { id: string; card_type: string; foil_type?: string | null }) => [
      r.id,
      r.foil_type ?? r.card_type
    ]) ?? []
  )

  // Get existing order items
  const { data: existingItems, error: fetchError } = await locals.supabase
    .from('order_items')
    .select('id, card_id, card_serial, quantity')
    .eq('order_id', existingOrder.id)

  if (fetchError) {
    logger.error({ error: fetchError }, 'Error fetching existing items')
    throw error(500, 'Failed to fetch existing order')
  }

  // Create a map of existing items by card_id for quick lookup
  const existingItemsMap = new Map(existingItems?.map((item) => [item.card_id, item]) ?? [])

  const itemsToInsert: Array<{
    order_id: string
    card_id: string
    card_serial: string
    card_name: string
    card_type: string
    quantity: number
    unit_price: number
    set_code: string | null
    collector_number: string | null
    is_foil: boolean
    is_etched: boolean
    language: string
  }> = []
  const itemsToUpdate: Array<{ id: string; quantity: number }> = []

  for (const newItem of newItems) {
    const existing = existingItemsMap.get(newItem.cardId)

    if (existing) {
      // Sum quantities for duplicate cards
      itemsToUpdate.push({
        id: existing.id,
        quantity: (existing.quantity ?? 0) + newItem.quantity
      })
    } else {
      // New card, insert it — include identity fields for stable merge matching
      itemsToInsert.push({
        order_id: existingOrder.id,
        card_id: newItem.cardId,
        card_serial: newItem.serial,
        card_name: newItem.name,
        card_type: newItem.cardType,
        quantity: newItem.quantity,
        unit_price: getCardPrice(mergeFinishMap.get(newItem.cardId) ?? newItem.cardType, mergePrices),
        set_code: newItem.setCode ?? null,
        collector_number: newItem.collectorNumber ?? null,
        is_foil: newItem.isFoil ?? false,
        is_etched: newItem.isEtched ?? false,
        language: newItem.language ?? 'en'
      })
    }
  }

  // Batch-update existing items with new quantities (concurrent, not sequential)
  if (itemsToUpdate.length > 0) {
    const updateResults = await Promise.all(
      itemsToUpdate.map((u) => locals.supabase.from('order_items').update({ quantity: u.quantity }).eq('id', u.id))
    )
    const batchUpdateError = updateResults.find((r) => r.error)?.error
    if (batchUpdateError) {
      logger.error({ error: batchUpdateError }, 'Error updating item quantities')
      throw error(500, 'Failed to update order items')
    }
  }

  // Insert new items
  if (itemsToInsert.length > 0) {
    const { error: insertError } = await locals.supabase.from('order_items').insert(itemsToInsert)

    if (insertError) {
      logger.error({ error: insertError }, 'Error inserting new items')
      throw error(500, 'Failed to add new items to order')
    }
  }

  // Update the order's timestamps (created_at for most recent submission, updated_at for tracking)
  const now = new Date().toISOString()
  await locals.supabase
    .from('orders')
    .update({
      created_at: now,
      updated_at: now
    })
    .eq('id', existingOrder.id)

  return json({
    orderId: existingOrder.id,
    orderNumber: existingOrder.order_number,
    merged: true,
    itemsAdded: itemsToInsert.length,
    itemsUpdated: itemsToUpdate.length
  })
}
