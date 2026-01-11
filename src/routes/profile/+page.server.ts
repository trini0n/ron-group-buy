import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/auth/login?next=/profile')
  }

  // Get user profile from users table
  const { data: profile } = await locals.supabase.from('users').select('*').eq('id', locals.user.id).single()

  // Get saved addresses
  const { data: addresses } = await locals.supabase
    .from('addresses')
    .select('*')
    .eq('user_id', locals.user.id)
    .order('is_default', { ascending: false })

  // Get notification preferences
  const { data: notifications } = await locals.supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', locals.user.id)
    .single()

  // Get order count
  const { count: orderCount } = await locals.supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', locals.user.id)

  // Check if user has identities to determine auth methods
  const { data: identitiesData } = await locals.supabase.auth.getUserIdentities()
  const hasPassword = identitiesData?.identities?.some((i: any) => i.provider === 'email') ?? false

  return {
    profile,
    addresses: addresses || [],
    notifications,
    orderCount: orderCount || 0,
    authUser: locals.user,
    hasPassword
  }
}
