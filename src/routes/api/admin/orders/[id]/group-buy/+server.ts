import { createAdminClient } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/admin';
import { error, json, type RequestEvent } from '@sveltejs/kit';

export async function PATCH({ params, locals, request }: RequestEvent) {
  // Require admin permission
  await requireAdmin(locals);

  const orderId = params.id;
  if (!orderId) {
    throw error(400, {message:'Order ID is required'});
  }

  const { group_buy_id } = await request.json();

  // Validate group_buy_id is either null or a valid UUID
  if (group_buy_id !== null && typeof group_buy_id !== 'string') {
    throw error(400, 'Invalid group_buy_id');
  }

  const adminClient = createAdminClient();

  // If group_buy_id is provided, verify it exists
  if (group_buy_id) {
    const { data: groupBuy, error: gbError } = await adminClient
      .from('group_buy_config')
      .select('id')
      .eq('id', group_buy_id)
      .single();

    if (gbError || !groupBuy) {
      throw error(404, 'Group buy not found');
    }
  }

  // Update the order
  const { data, error: updateError } = await adminClient
    .from('orders')
    .update({ group_buy_id })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) {
    throw error(500, `Failed to update order: ${updateError.message}`);
  }

  return json({ success: true, order: data });
}
