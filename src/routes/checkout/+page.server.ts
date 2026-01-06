import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // Require authentication for checkout
  if (!locals.user) {
    throw redirect(303, '/auth/login?next=/checkout');
  }

  // Get user's saved addresses
  const { data: addresses } = await locals.supabase
    .from('addresses')
    .select('*')
    .eq('user_id', locals.user.id)
    .order('is_default', { ascending: false });

  // Check if group buy is open
  const { data: groupBuyConfig } = await locals.supabase
    .from('group_buy_config')
    .select('*')
    .eq('is_active', true)
    .single();

  return {
    addresses: addresses || [],
    groupBuyConfig
  };
};
