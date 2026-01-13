import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

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
      console.error('Error linking Google account:', linkError)
      throw error(500, linkError.message || 'Failed to link Google account')
    }

    // Return the OAuth URL for redirect
    return json({ url: data.url })
  } catch (err: any) {
    console.error('Link Google error:', err)
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
    
    if (identities.length <= 1) {
      throw error(400, 'Cannot remove last authentication method')
    }

    // Find Google identity
    const googleIdentity = identities.find((i: any) => i.provider === 'google')
    if (!googleIdentity) {
      throw error(404, 'Google account not linked')
    }

    const { error: unlinkError } = await locals.supabase.auth.unlinkIdentity(googleIdentity)

    if (unlinkError) {
      console.error('Error unlinking Google account:', unlinkError)
      throw error(500, unlinkError.message || 'Failed to unlink Google account')
    }

    // Clear google_id from users table
    await locals.supabase
      .from('users')
      .update({ google_id: null })
      .eq('id', locals.user.id)

    return json({ success: true })
  } catch (err: any) {
    console.error('Unlink Google error:', err)
    if (err.status) throw err
    throw error(500, err.message || 'Failed to unlink Google account')
  }
}
