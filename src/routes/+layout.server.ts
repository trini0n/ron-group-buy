import type { LayoutServerLoad } from './$types'
import { isAdminDiscordId } from '$lib/admin-shared'

export const load: LayoutServerLoad = async ({ locals }) => {
  // Get current group buy config
  const { data: groupBuyConfig } = await locals.supabase
    .from('group_buy_config')
    .select('*')
    .eq('is_active', true)
    .single()

  // Check if user is admin
  let isAdmin = false
  if (locals.user) {
    const { data: userData } = await locals.supabase
      .from('users')
      .select('discord_id')
      .eq('id', locals.user.id)
      .single()

    isAdmin = isAdminDiscordId(userData?.discord_id)
  }

  return {
    user: locals.user,
    isAdmin,
    groupBuyConfig
  }
}
