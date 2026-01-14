import type { LayoutServerLoad } from './$types'
import { isAdminDiscordId } from '$lib/admin-shared'

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Get current group buy config
  const { data: groupBuyConfig } = await locals.supabase
    .from('group_buy_config')
    .select('*')
    .eq('is_active', true)
    .single()

  // Check if user is admin and get profile data (including avatar_url)
  let isAdmin = false
  let userProfile: { name?: string | null; avatar_url?: string | null; discord_id?: string | null } | null = null
  
  if (locals.user) {
    const { data: userData } = await locals.supabase
      .from('users')
      .select('discord_id, name, avatar_url')
      .eq('id', locals.user.id)
      .single()

    isAdmin = isAdminDiscordId(userData?.discord_id)
    userProfile = userData
  }

  return {
    session: locals.session,
    user: locals.user,
    userProfile,
    isAdmin,
    groupBuyConfig,
    url: { pathname: url.pathname }
  }
}
