import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient } from '$lib/server/admin'
import { checkProviderConflict, buildConflictRedirectUrl } from '$lib/auth/conflicts'

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'
  const type = url.searchParams.get('type')
  const action = url.searchParams.get('action') // 'link' when linking a provider

  if (code) {
    const { error, data } = await locals.supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Fetch fresh user data including all identities
      // (the session data may not have updated identities after linkIdentity)
      const { data: userData } = await locals.supabase.auth.getUser()
      const userWithIdentities = userData?.user || data.user

      // Check for provider conflicts if this is a link action
      if (action === 'link') {
        const conflict = await checkForNewProviderConflict(locals.supabase, userWithIdentities)
        if (conflict) {
          throw redirect(303, buildConflictRedirectUrl(conflict, next))
        }
      }

      // Sync user data to users table
      await syncUserData(userWithIdentities)

      // If this is a password recovery, redirect to reset password page
      if (type === 'recovery') {
        throw redirect(303, '/auth/reset-password')
      }
      // If this is email confirmation, redirect to account or next
      if (type === 'signup' || type === 'email_change') {
        throw redirect(303, '/account?verified=true')
      }
      throw redirect(303, next)
    }
  }

  // Return to home on error
  throw redirect(303, '/')
}

/**
 * Check if any newly linked provider conflicts with an existing user
 */
async function checkForNewProviderConflict(
  supabase: any,
  user: { id: string; identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> }
) {
  // Check each identity for conflicts
  for (const identity of user.identities || []) {
    if (identity.provider === 'google' || identity.provider === 'discord') {
      const providerId = (identity.identity_data?.provider_id as string) || 
                         (identity.identity_data?.sub as string)
      if (providerId) {
        const conflict = await checkProviderConflict(supabase, user.id, identity.provider, providerId)
        if (conflict) {
          return conflict
        }
      }
    }
  }
  return null
}

async function syncUserData(user: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
  identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }>
}) {
  const adminClient = createAdminClient()

  // Determine which provider was used for this sign-in
  // app_metadata.provider contains the most recently used provider
  const currentProvider = user.app_metadata?.provider as string | undefined

  // Extract provider info from identities
  let discordId: string | null = null
  let discordUsername: string | null = null
  let googleId: string | null = null
  let name: string | null = null
  let avatarUrl: string | null = null

  // Get Discord identity data
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord')
  if (discordIdentity?.identity_data) {
    discordId =
      (discordIdentity.identity_data.provider_id as string) || (discordIdentity.identity_data.sub as string) || null
    discordUsername =
      (discordIdentity.identity_data.full_name as string) || (discordIdentity.identity_data.name as string) || null
  }

  // Get Google identity data
  const googleIdentity = user.identities?.find((i) => i.provider === 'google')
  if (googleIdentity?.identity_data) {
    googleId =
      (googleIdentity.identity_data.provider_id as string) || (googleIdentity.identity_data.sub as string) || null
  }

  // Use avatar and name from the MOST RECENT sign-in provider
  if (currentProvider === 'discord' && discordIdentity?.identity_data) {
    name = (discordIdentity.identity_data.full_name as string) || (discordIdentity.identity_data.name as string) || null
    avatarUrl = (discordIdentity.identity_data.avatar_url as string) || null
  } else if (currentProvider === 'google' && googleIdentity?.identity_data) {
    name = (googleIdentity.identity_data.full_name as string) || (googleIdentity.identity_data.name as string) || null
    avatarUrl = (googleIdentity.identity_data.avatar_url as string) || (googleIdentity.identity_data.picture as string) || null
  } else {
    // Fallback: use whichever provider has data (prefer Discord, then Google)
    if (discordIdentity?.identity_data) {
      name = (discordIdentity.identity_data.full_name as string) || (discordIdentity.identity_data.name as string) || null
      avatarUrl = (discordIdentity.identity_data.avatar_url as string) || null
    } else if (googleIdentity?.identity_data) {
      name = (googleIdentity.identity_data.full_name as string) || (googleIdentity.identity_data.name as string) || null
      avatarUrl = (googleIdentity.identity_data.avatar_url as string) || (googleIdentity.identity_data.picture as string) || null
    }
  }

  // Fallback to user_metadata for legacy support
  if (!discordId && user.user_metadata?.provider_id) {
    discordId = (user.user_metadata.provider_id as string) || (user.user_metadata.sub as string) || null
    discordUsername = (user.user_metadata.full_name as string) || (user.user_metadata.name as string) || null
    if (!name) {
      name = (user.user_metadata.full_name as string) || (user.user_metadata.name as string) || null
    }
    if (!avatarUrl) {
      avatarUrl = (user.user_metadata.avatar_url as string) || null
    }
  }

  // Upsert user data
  const { error } = await adminClient.from('users').upsert(
    {
      id: user.id,
      email: user.email || '',
      discord_id: discordId,
      discord_username: discordUsername,
      google_id: googleId,
      name: name,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false
    }
  )

  if (error) {
    console.error('Error syncing user data:', error)
  }
}
