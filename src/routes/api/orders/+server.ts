import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { fetchPrices } from '$lib/server/pricing'
import { getCardPrice } from '$lib/utils'
import { ensureUserRow } from '$lib/server/user-profile'

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

  const body = await request.json()
  const { addressId, newAddress, shippingType, items, action, paypalEmail, phoneNumber, discordUsername, cartId, cartVersion, notes } = body

  if (!items || items.length === 0) {
    throw error(400, 'Cart is empty')
  }

  // Phone number, PayPal email, and Discord username are required
  if (!phoneNumber || !String(phoneNumber).trim()) {
    throw error(400, 'Phone number is required')
  }
  if (!paypalEmail || !String(paypalEmail).trim()) {
    throw error(400, 'PayPal Email is required')
  }

  // Fetch user data first to see if they already have Discord linked
  const { data: currentUserData } = await locals.supabase
    .from('users')
    .select('discord_id, discord_username')
    .eq('id', locals.user.id)
    .single();

  const hasDiscordLinked = Boolean(currentUserData?.discord_id || currentUserData?.discord_username);

  if (!hasDiscordLinked && (!discordUsername || !String(discordUsername).trim())) {
    throw error(400, 'Discord Username is required')
  }

  // Validate shipping type
  if (shippingType && !['regular', 'express'].includes(shippingType)) {
    throw error(400, 'Invalid shipping type')
  }

  // Validate action if provided
  if (action && !['replace', 'merge'].includes(action)) {
    throw error(400, 'Invalid action')
  }

  // Get active group buy
  const { data: activeGroupBuy } = await locals.supabase
    .from('group_buy_config')
    .select('id')
    .eq('is_active', true)
    .single()

  // Check for existing pending order in this group buy
  const { data: existingOrder } = activeGroupBuy ? await locals.supabase
    .from('orders')
    .select(`
      id, 
      order_number,
      order_items (
        id,
        quantity,
        unit_price
      )
    `)
    .eq('user_id', locals.user.id)
    .eq('group_buy_id', activeGroupBuy.id)
    .eq('status', 'pending')
    .single() : { data: null }

  // If there's an existing pending order
  if (existingOrder && activeGroupBuy) {
    // If no action specified, return confirmation request
    if (!action) {
      const itemCount = existingOrder.order_items?.reduce(
        (sum: number, item: { quantity: number | null }) => sum + (item.quantity ?? 1), 0
      ) ?? 0
      const total = existingOrder.order_items?.reduce(
        (sum: number, item: { quantity: number | null; unit_price: number | string }) => 
          sum + (item.quantity ?? 1) * Number(item.unit_price), 0
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
      // Delete existing order and items first
      await locals.supabase
        .from('order_items')
        .delete()
        .eq('order_id', existingOrder.id)

      await locals.supabase
        .from('orders')
        .delete()
        .eq('id', existingOrder.id)

      // Fall through to create new order
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
    // @ts-ignore: phone_number not yet typed in generated types
    if (address.phone_number !== String(phoneNumber).trim()) {
      const { error: updateError } = await locals.supabase
        .from('addresses')
        // @ts-ignore: phone_number not yet typed in generated types
        .update({ phone_number: String(phoneNumber).trim() })
        .eq('id', addressId)
        
      if (updateError) {
        console.error('Error updating address phone number:', updateError)
      } else {
        // @ts-ignore: phone_number not yet typed in generated types
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
        // @ts-ignore: phone_number not yet typed in generated types
        phone_number: String(phoneNumber).trim(),
        is_default: true
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving address in checkout:', {
        error: saveError,
        errorCode: saveError.code,
        errorMessage: saveError.message,
        errorDetails: saveError.details,
        errorHint: saveError.hint,
        userId: locals.user.id,
        addressData: newAddress
      })
      throw error(500, `Failed to save address: ${saveError.message || 'Unknown error'}`)
    }
    shippingAddress = savedAddress
  } else {
    throw error(400, 'No address provided')
  }

  // Update user's PayPal email and Discord username
  const updateData: { paypal_email: string, discord_username?: string } = { paypal_email: String(paypalEmail).trim() }
  if (discordUsername && String(discordUsername).trim()) {
     updateData.discord_username = String(discordUsername).trim();
  }
  
  // Check if user has discord_id or if we are skipping discord validation for local testing?
  // The client enforces the discord username check, we will trust the client for now but update the profile unconditionally if string provided.
  
  const { error: profileError } = await locals.supabase
    .from('users')
    .update(updateData)
    .eq('id', locals.user.id)

  if (profileError) {
    console.error('Error updating user profile (paypal_email/discord_username):', profileError);
    // This is not a critical error to stop the order, but log it.
  }

  // Create order with group_buy_id
  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .insert({
      user_id: locals.user.id,
      order_number: generateOrderNumber(),
      status: 'pending',
      group_buy_id: activeGroupBuy?.id ?? null,
      shipping_type: shippingType || 'regular',
      shipping_name: shippingAddress.name,
      shipping_line1: shippingAddress.line1,
      shipping_line2: shippingAddress.line2,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_postal_code: shippingAddress.postal_code,
      shipping_country: shippingAddress.country,
      // @ts-ignore: shipping_phone_number not yet typed in generated types
      shipping_phone_number: String(phoneNumber).trim(),
      notes: notes || null
    })
    .select()
    .single()

  if (orderError || !order) {
    console.error('Order creation error:', orderError)
    throw error(500, 'Failed to create order')
  }

  // Resolve prices and card types server-side (security: never trust client-supplied unitPrice)
  const prices = await fetchPrices(locals.supabase)
  const cardIds = items.map((item: OrderItem) => item.cardId)
  const { data: cardRows, error: cardFetchErr } = await locals.supabase
    .from('cards')
    .select('id, card_type')
    .in('id', cardIds)
  if (cardFetchErr) {
    throw error(500, 'Failed to fetch card pricing data')
  }
  const serverCardTypeMap = new Map(cardRows?.map((r: { id: string; card_type: string }) => [r.id, r.card_type]) ?? [])

  // Create order items with identity snapshot
  const orderItems = items.map((item: OrderItem) => ({
    order_id: order.id,
    card_id: item.cardId,
    card_serial: item.serial,
    card_name: item.name,
    card_type: item.cardType,
    quantity: item.quantity,
    unit_price: getCardPrice(serverCardTypeMap.get(item.cardId) ?? item.cardType, prices),
    // Snapshot card identity for future merge operations
    set_code: item.setCode || null,
    collector_number: item.collectorNumber || null,
    is_foil: item.isFoil ?? false,
    is_etched: item.isEtched ?? false,
    language: item.language || 'en'
  }))

  const { error: itemsError } = await locals.supabase.from('order_items').insert(orderItems)

  if (itemsError) {
    console.error('Order items error:', itemsError)
    // Rollback order
    await locals.supabase.from('orders').delete().eq('id', order.id)
    throw error(500, 'Failed to create order items')
  }

  return json({
    orderId: order.id,
    orderNumber: order.order_number
  })
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
  const mergePrices = await fetchPrices(locals.supabase)
  const newCardIds = newItems.map(i => i.cardId)
  const { data: mergeCardRows } = await locals.supabase
    .from('cards')
    .select('id, card_type')
    .in('id', newCardIds)
  const mergeCardTypeMap = new Map(mergeCardRows?.map((r: { id: string; card_type: string }) => [r.id, r.card_type]) ?? [])

  // Get existing order items
  const { data: existingItems, error: fetchError } = await locals.supabase
    .from('order_items')
    .select('id, card_id, card_serial, quantity')
    .eq('order_id', existingOrder.id)

  if (fetchError) {
    console.error('Error fetching existing items:', fetchError)
    throw error(500, 'Failed to fetch existing order')
  }

  // Create a map of existing items by card_id for quick lookup
  const existingItemsMap = new Map(
    existingItems?.map(item => [item.card_id, item]) ?? []
  )

  const itemsToInsert: Array<{
    order_id: string
    card_id: string
    card_serial: string
    card_name: string
    card_type: string
    quantity: number
    unit_price: number
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
      // New card, insert it
      itemsToInsert.push({
        order_id: existingOrder.id,
        card_id: newItem.cardId,
        card_serial: newItem.serial,
        card_name: newItem.name,
        card_type: newItem.cardType,
        quantity: newItem.quantity,
        unit_price: getCardPrice(mergeCardTypeMap.get(newItem.cardId) ?? newItem.cardType, mergePrices)
      })
    }
  }

  // Batch-update existing items with new quantities (concurrent, not sequential)
  if (itemsToUpdate.length > 0) {
    const updateResults = await Promise.all(
      itemsToUpdate.map(u =>
        locals.supabase.from('order_items').update({ quantity: u.quantity }).eq('id', u.id)
      )
    )
    const batchUpdateError = updateResults.find(r => r.error)?.error
    if (batchUpdateError) {
      console.error('Error updating item quantities:', batchUpdateError)
      throw error(500, 'Failed to update order items')
    }
  }

  // Insert new items
  if (itemsToInsert.length > 0) {
    const { error: insertError } = await locals.supabase
      .from('order_items')
      .insert(itemsToInsert)

    if (insertError) {
      console.error('Error inserting new items:', insertError)
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
