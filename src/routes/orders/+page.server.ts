import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/?login=required');
  }

  // Fetch orders with group_buy_id
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

  // Fetch active group buys to determine which orders can be edited
  const { data: activeGroupBuys } = await locals.supabase
    .from('group_buy_config')
    .select('id')
    .eq('is_active', true);

  const activeGroupBuyIds = new Set(activeGroupBuys?.map(gb => gb.id) ?? []);

  return {
    orders: orders || [],
    activeGroupBuyIds: Array.from(activeGroupBuyIds)
  };
};
