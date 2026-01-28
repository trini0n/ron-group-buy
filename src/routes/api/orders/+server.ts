import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

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
}

export const POST: RequestHandler = async ({ request, locals }) => {
  // Require authentication
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }

  const body = await request.json()
  const { addressId, newAddress, shippingType, items, action, paypalEmail, notes } = body

  if (!items || items.length === 0) {
    throw error(400, 'Cart is empty')
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
    shippingAddress = address
  } else if (newAddress) {
    // Validate new address fields
    if (!newAddress.name || !newAddress.line1 || !newAddress.city || !newAddress.postal_code || !newAddress.country) {
      throw error(400, 'Missing required address fields')
    }

    // Save the new address
    const { data: savedAddress, error: saveError } = await locals.supabase
      .from('addresses')
      .insert({
        user_id: locals.user.id,
        ...newAddress,
        is_default: true
      })
      .select()
      .single()

    if (saveError) {
      throw error(500, 'Failed to save address')
    }
    shippingAddress = savedAddress
  } else {
    throw error(400, 'No address provided')
  }

  // Update user's PayPal email if provided
  if (paypalEmail) {
    await locals.supabase
      .from('users')
      .update({ paypal_email: paypalEmail })
      .eq('id', locals.user.id)
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
      notes: notes || null
    })
    .select()
    .single()

  if (orderError || !order) {
    console.error('Order creation error:', orderError)
    throw error(500, 'Failed to create order')
  }

  // Create order items
  const orderItems = items.map((item: OrderItem) => ({
    order_id: order.id,
    card_id: item.cardId,
    card_serial: item.serial,
    card_name: item.name,
    card_type: item.cardType,
    quantity: item.quantity,
    unit_price: item.unitPrice
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
        unit_price: newItem.unitPrice
      })
    }
  }

  // Update existing items with new quantities
  for (const update of itemsToUpdate) {
    const { error: updateError } = await locals.supabase
      .from('order_items')
      .update({ quantity: update.quantity })
      .eq('id', update.id)

    if (updateError) {
      console.error('Error updating item quantity:', updateError)
      throw error(500, 'Failed to update order item')
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
