import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Add password to account
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  try {
    const { password } = await request.json()

    // Validate password
    if (!password || password.length < 8) {
      throw error(400, 'Password must be at least 8 characters')
    }

    // Check if user already has a password
    const { data: identitiesData } = await locals.supabase.auth.getUserIdentities()
    const hasPassword = identitiesData?.identities?.some((i: any) => i.provider === 'email')
    
    if (hasPassword) {
      throw error(400, 'Account already has a password. Use PATCH to change it.')
    }

    // Add password to account
    const { error: updateError } = await locals.supabase.auth.updateUser({
      password
    })

    if (updateError) {
      console.error('Error adding password:', updateError)
      throw error(500, updateError.message || 'Failed to add password')
    }

    return json({ success: true })
  } catch (err: any) {
    console.error('Add password error:', err)
    if (err.status) throw err
    throw error(500, err.message || 'Failed to add password')
  }
}

// Change existing password
export const PATCH: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  try {
    const { currentPassword, newPassword } = await request.json()

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw error(400, 'New password must be at least 8 characters')
    }

    // Verify current password by attempting to sign in
    if (currentPassword) {
      const { error: signInError } = await locals.supabase.auth.signInWithPassword({
        email: locals.user.email || '',
        password: currentPassword
      })

      if (signInError) {
        throw error(401, 'Current password is incorrect')
      }
    }

    // Update password
    const { error: updateError } = await locals.supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Error changing password:', updateError)
      throw error(500, updateError.message || 'Failed to change password')
    }

    return json({ success: true })
  } catch (err: any) {
    console.error('Change password error:', err)
    if (err.status) throw err
    throw error(500, err.message || 'Failed to change password')
  }
}
