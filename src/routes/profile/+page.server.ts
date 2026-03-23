import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/auth/login?next=/profile')
  }

  // Get user profile from users table
  const { data: profile } = await locals.supabase.from('users').select('id, name, avatar_url, discord_username, discord_id, google_id, paypal_email').eq('id', locals.user.id).single()

  // Get saved addresses
  const { data: addresses } = await locals.supabase
    .from('addresses')
    .select('id, user_id, name, line1, line2, city, state, postal_code, country, phone_number, is_default')
    .eq('user_id', locals.user.id)
    .order('is_default', { ascending: false })

  // Get notification preferences
  const { data: notifications } = await locals.supabase
    .from('notification_preferences')
    .select('user_id, email_order_confirmed, email_invoice_sent, email_payment_received, email_order_shipped, discord_order_shipped, discord_payment_reminder')
    .eq('user_id', locals.user.id)
    .single()

  // Get order count
  const { count: orderCount } = await locals.supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
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
