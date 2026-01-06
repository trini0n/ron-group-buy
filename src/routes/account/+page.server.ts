import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/?auth=required')
  }

  // Get user's saved addresses
  const { data: addresses } = await locals.supabase
    .from('addresses')
    .select('*')
    .eq('user_id', locals.user.id)
    .order('is_default', { ascending: false })

  // Get linked identities
  const identities = locals.user.identities || []
  const linkedProviders = identities.map((i) => i.provider)

  return {
    addresses: addresses || [],
    linkedProviders,
    // Pass full identity objects for unlinking
    identities: identities.map((i) => ({
      id: i.id,
      provider: i.provider,
      user_id: i.user_id,
      identity_id: i.identity_id
    }))
  }
}
