import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/?login=required');
  }

  // Fetch orders
  const { data: orders } = await locals.supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        card_serial,
        card_name,
        card_type,
        quantity,
        unit_price
      )
    `)
    .eq('user_id', locals.user.id)
    .order('created_at', { ascending: false });

  return {
    orders: orders || []
  };
};
