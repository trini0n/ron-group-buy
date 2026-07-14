import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'

// Link Discord OAuth account
export const POST: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  try {
    const { data, error: linkError } = await locals.supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${url.origin}/auth/callback?next=/profile&action=link`
      }
    })

    if (linkError) {
      logger.error({ error: linkError }, 'Error linking Discord account')
      throw error(500, linkError.message || 'Failed to link Discord account')
    }

    // Return the OAuth URL for redirect
    return json({ url: data.url })
  } catch (err: any) {
    logger.error({ error: err }, 'Link Discord error')
    throw error(500, err.message || 'Failed to link Discord account')
  }
}

// Unlink Discord OAuth account
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
      .select('google_id')
      .eq('id', locals.user.id)
      .single()

    const otherAuthIdentities = identities.filter((i: any) => i.provider !== 'discord')
    const hasPasswordIdentity = identities.some((i: any) => i.provider === 'email')
    const hasOtherOAuthInDB = !!userRecord?.google_id
    const hasRemainingAuth = otherAuthIdentities.length > 0 || hasOtherOAuthInDB || hasPasswordIdentity

    if (!hasRemainingAuth) {
      throw error(400, 'Cannot remove last authentication method')
    }

    // Find Discord identity in Supabase Auth
    const discordIdentity = identities.find((i: any) => i.provider === 'discord')

    if (discordIdentity) {
      // Identity exists in Supabase Auth — unlink it
      const { error: unlinkError } = await locals.supabase.auth.unlinkIdentity(discordIdentity)

      if (unlinkError) {
        logger.error({ error: unlinkError }, 'Error unlinking Discord account')
        throw error(500, unlinkError.message || 'Failed to unlink Discord account')
      }
    } else {
      // Identity not in Supabase Auth (likely deduplicated by email) — check users table
      const { data: discordCheck } = await locals.supabase
        .from('users')
        .select('discord_id')
        .eq('id', locals.user.id)
        .single()

      if (!discordCheck?.discord_id) {
        throw error(404, 'Discord account not linked')
      }
      logger.info({ userId: locals.user.id }, 'Discord identity not in Supabase Auth (deduplicated) — clearing DB fields only')
    }

    // Clear discord_id and discord_username from users table
    await locals.supabase.from('users').update({ discord_id: null, discord_username: null }).eq('id', locals.user.id)

    return json({ success: true })
  } catch (err: any) {
    logger.error({ error: err }, 'Unlink Discord error')
    if (err.status) throw err
    throw error(500, err.message || 'Failed to unlink Discord account')
  }
}
