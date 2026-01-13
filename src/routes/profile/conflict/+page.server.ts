import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { createAdminClient } from '$lib/server/admin'

export const load: PageServerLoad = async ({ url, locals }) => {
  // Require authentication
  if (!locals.user) {
    throw redirect(303, '/auth/login')
  }

  const type = url.searchParams.get('type')
  const conflictUserId = url.searchParams.get('conflictUserId')
  const provider = url.searchParams.get('provider')
  const returnTo = url.searchParams.get('returnTo') || '/profile'

  if (!type || !conflictUserId) {
    throw redirect(303, '/profile')
  }

  // Fetch minimal info about the conflicting account (for display)
  const adminClient = createAdminClient()
  const { data: conflictingUser } = await adminClient
    .from('users')
    .select('id, email, name, google_id, discord_id, discord_username')
    .eq('id', conflictUserId)
    .single()

  if (!conflictingUser) {
    throw redirect(303, '/profile?error=conflict_not_found')
  }

  // Get current user info
  const { data: currentUser } = await adminClient
    .from('users')
    .select('id, email, name, google_id, discord_id, discord_username')
    .eq('id', locals.user.id)
    .single()

  // Determine what auth methods exist on conflicting account
  const conflictAuthMethods = {
    hasGoogle: !!conflictingUser.google_id,
    hasDiscord: !!conflictingUser.discord_id,
    hasPassword: false // We'd need to check identities for this
  }

  return {
    conflictType: type,
    provider,
    returnTo,
    conflictingUser: {
      id: conflictingUser.id,
      email: conflictingUser.email,
      name: conflictingUser.name,
      discordUsername: conflictingUser.discord_username,
      authMethods: conflictAuthMethods
    },
    currentUser: {
      id: currentUser?.id,
      email: currentUser?.email,
      name: currentUser?.name,
      discordUsername: currentUser?.discord_username
    }
  }
}
