import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'

// Link Google OAuth account
export const POST: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  try {
    const { data, error: linkError } = await locals.supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${url.origin}/auth/callback?next=/profile&action=link`
      }
    })

    if (linkError) {
      logger.error({ error: linkError }, 'Error linking Google account')
      throw error(500, linkError.message || 'Failed to link Google account')
    }

    // Return the OAuth URL for redirect
    return json({ url: data.url })
  } catch (err: any) {
    logger.error({ error: err }, 'Link Google error')
    throw error(500, err.message || 'Failed to link Google account')
  }
}

// Unlink Google OAuth account
export const DELETE: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  try {
    // Verify user has other auth methods before unlinking
    const { data: identitiesData } = await locals.supabase.auth.getUserIdentities()
    const identities = identitiesData?.identities || []

    // Cross-reference the users table for linked providers (handles Supabase identity deduplication)
    const { data: userRecord } = await locals.supabase
      .from('users')
      .select('discord_id')
      .eq('id', locals.user.id)
      .single()

    const otherAuthIdentities = identities.filter((i: any) => i.provider !== 'google')
    const hasPasswordIdentity = identities.some((i: any) => i.provider === 'email')
    const hasOtherOAuthInDB = !!userRecord?.discord_id
    const hasRemainingAuth = otherAuthIdentities.length > 0 || hasOtherOAuthInDB || hasPasswordIdentity

    if (!hasRemainingAuth) {
      throw error(400, 'Cannot remove last authentication method')
    }

    // Find Google identity in Supabase Auth
    const googleIdentity = identities.find((i: any) => i.provider === 'google')

    if (googleIdentity) {
      // Identity exists in Supabase Auth — unlink it
      const { error: unlinkError } = await locals.supabase.auth.unlinkIdentity(googleIdentity)

      if (unlinkError) {
        logger.error({ error: unlinkError }, 'Error unlinking Google account')
        throw error(500, unlinkError.message || 'Failed to unlink Google account')
      }
    } else {
      // Identity not in Supabase Auth (likely deduplicated by email) — check users table
      const { data: googleCheck } = await locals.supabase
        .from('users')
        .select('google_id')
        .eq('id', locals.user.id)
        .single()

      if (!googleCheck?.google_id) {
        throw error(404, 'Google account not linked')
      }
      logger.info({ userId: locals.user.id }, 'Google identity not in Supabase Auth (deduplicated) — clearing DB fields only')
    }

    // Clear google_id from users table
    await locals.supabase.from('users').update({ google_id: null }).eq('id', locals.user.id)

    return json({ success: true })
  } catch (err: any) {
    logger.error({ error: err }, 'Unlink Google error')
    if (err.status) throw err
    throw error(500, err.message || 'Failed to unlink Google account')
  }
}
