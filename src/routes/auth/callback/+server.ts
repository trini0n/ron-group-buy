import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient } from '$lib/server/admin'

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'
  const type = url.searchParams.get('type')

  if (code) {
    const { error, data } = await locals.supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Sync user data to users table (especially Discord ID)
      await syncUserData(data.user)

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

async function syncUserData(user: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
  identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }>
}) {
  const adminClient = createAdminClient()

  // Extract provider info from identities
  let discordId: string | null = null
  let discordUsername: string | null = null
  let googleId: string | null = null
  let name: string | null = null
  let avatarUrl: string | null = null

  // Check identities for Discord provider
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord')
  if (discordIdentity?.identity_data) {
    discordId =
      (discordIdentity.identity_data.provider_id as string) || (discordIdentity.identity_data.sub as string) || null
    discordUsername =
      (discordIdentity.identity_data.full_name as string) || (discordIdentity.identity_data.name as string) || null
    name = (discordIdentity.identity_data.full_name as string) || (discordIdentity.identity_data.name as string) || null
    avatarUrl = (discordIdentity.identity_data.avatar_url as string) || null
  }

  // Check identities for Google provider
  const googleIdentity = user.identities?.find((i) => i.provider === 'google')
  if (googleIdentity?.identity_data) {
    googleId =
      (googleIdentity.identity_data.provider_id as string) || (googleIdentity.identity_data.sub as string) || null
    // Use Google name/avatar if Discord didn't provide them
    if (!name) {
      name = (googleIdentity.identity_data.full_name as string) || (googleIdentity.identity_data.name as string) || null
    }
    if (!avatarUrl) {
      avatarUrl = (googleIdentity.identity_data.avatar_url as string) || (googleIdentity.identity_data.picture as string) || null
    }
  }

  // Fallback to user_metadata for Discord (legacy support)
  if (!discordId && user.user_metadata?.provider_id) {
    discordId = (user.user_metadata.provider_id as string) || (user.user_metadata.sub as string) || null
    discordUsername = (user.user_metadata.full_name as string) || (user.user_metadata.name as string) || null
    name = name || (user.user_metadata.full_name as string) || (user.user_metadata.name as string) || null
    avatarUrl = avatarUrl || (user.user_metadata.avatar_url as string) || null
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
