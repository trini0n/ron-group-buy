import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Link Discord OAuth account
export const POST: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  try {
    const { data, error: linkError } = await locals.supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${url.origin}/auth/callback?next=/profile`
      }
    })

    if (linkError) {
      console.error('Error linking Discord account:', linkError)
      throw error(500, linkError.message || 'Failed to link Discord account')
    }

    // Return the OAuth URL for redirect
    return json({ url: data.url })
  } catch (err: any) {
    console.error('Link Discord error:', err)
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
    
    if (identities.length <= 1) {
      throw error(400, 'Cannot remove last authentication method')
    }

    // Find Discord identity
    const discordIdentity = identities.find((i: any) => i.provider === 'discord')
    if (!discordIdentity) {
      throw error(404, 'Discord account not linked')
    }

    const { error: unlinkError } = await locals.supabase.auth.unlinkIdentity(discordIdentity)

    if (unlinkError) {
      console.error('Error unlinking Discord account:', unlinkError)
      throw error(500, unlinkError.message || 'Failed to unlink Discord account')
    }

    // Clear discord_id and discord_username from users table
    await locals.supabase
      .from('users')
      .update({ discord_id: null, discord_username: null })
      .eq('id', locals.user.id)

    return json({ success: true })
  } catch (err: any) {
    console.error('Unlink Discord error:', err)
    if (err.status) throw err
    throw error(500, err.message || 'Failed to unlink Discord account')
  }
}
