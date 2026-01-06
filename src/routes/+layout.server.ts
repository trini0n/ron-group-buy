import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
  // Get current group buy config
  const { data: groupBuyConfig } = await locals.supabase
    .from('group_buy_config')
    .select('*')
    .eq('is_active', true)
    .single()

  return {
    user: locals.user,
    groupBuyConfig
  }
}
