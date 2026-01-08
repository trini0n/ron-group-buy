import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) {
    throw redirect(303, '/?login=required');
  }

  const { data: order, error: orderError } = await locals.supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        card_id,
        card_serial,
        card_name,
        card_type,
        quantity,
        unit_price,
        card:cards (
          set_code,
          collector_number,
          scryfall_id,
          ron_image_url
        )
      )
    `)
    .eq('id', params.id)
    .eq('user_id', locals.user.id)
    .single();

  if (orderError || !order) {
    throw error(404, 'Order not found');
  }

  return {
    order,
    showSuccess: url.searchParams.get('success') === 'true'
  };
};
