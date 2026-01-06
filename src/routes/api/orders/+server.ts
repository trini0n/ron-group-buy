import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCardPrice } from '$lib/utils';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Require authentication
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }

  const body = await request.json();
  const { addressId, newAddress, items } = body;

  if (!items || items.length === 0) {
    throw error(400, 'Cart is empty');
  }

  // Validate address
  let shippingAddress;
  
  if (addressId) {
    // Use existing address
    const { data: address, error: addressError } = await locals.supabase
      .from('addresses')
      .select('*')
      .eq('id', addressId)
      .eq('user_id', locals.user.id)
      .single();

    if (addressError || !address) {
      throw error(400, 'Invalid address');
    }
    shippingAddress = address;
  } else if (newAddress) {
    // Validate new address fields
    if (!newAddress.name || !newAddress.line1 || !newAddress.city || !newAddress.postal_code || !newAddress.country) {
      throw error(400, 'Missing required address fields');
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
      .single();

    if (saveError) {
      throw error(500, 'Failed to save address');
    }
    shippingAddress = savedAddress;
  } else {
    throw error(400, 'No address provided');
  }

  // Create order
  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .insert({
      user_id: locals.user.id,
      status: 'pending',
      shipping_name: shippingAddress.name,
      shipping_line1: shippingAddress.line1,
      shipping_line2: shippingAddress.line2,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_postal_code: shippingAddress.postal_code,
      shipping_country: shippingAddress.country
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error('Order creation error:', orderError);
    throw error(500, 'Failed to create order');
  }

  // Create order items
  const orderItems = items.map((item: any) => ({
    order_id: order.id,
    card_id: item.cardId,
    card_serial: item.serial,
    card_name: item.name,
    card_type: item.cardType,
    quantity: item.quantity,
    unit_price: item.unitPrice
  }));

  const { error: itemsError } = await locals.supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('Order items error:', itemsError);
    // Rollback order
    await locals.supabase.from('orders').delete().eq('id', order.id);
    throw error(500, 'Failed to create order items');
  }

  return json({
    orderId: order.id,
    orderNumber: order.order_number
  });
};
