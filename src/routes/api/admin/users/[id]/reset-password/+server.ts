import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'

// Helper to verify admin access
async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) {
    throw error(401, 'Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw error(403, 'Not authorized')
  }

  return { user, adminClient }
}

export const POST: RequestHandler = async ({ params, locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  // Fetch target user to get their email
  const { data: targetUser, error: userError } = await adminClient
    .from('users')
    .select('id, email, name')
    .eq('id', params.id)
    .single()

  if (userError || !targetUser) {
    throw error(404, 'User not found')
  }

  // Check if user has email/password auth method
  try {
    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(params.id)
    
    if (authError) {
      throw error(500, 'Failed to fetch user auth data')
    }

    const hasPassword = authData?.user?.identities?.some((i: any) => i.provider === 'email')
    
    if (!hasPassword) {
      throw error(400, 'User does not have email/password authentication enabled')
    }
  } catch (err: any) {
    console.error('Error checking auth identities:', err)
    if (err.status) throw err
    throw error(500, 'Failed to verify user authentication method')
  }

  // Generate password recovery link
  try {
    const { data, error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: targetUser.email
    })

    if (resetError) {
      console.error('Error generating password reset link:', resetError)
      throw error(500, resetError.message || 'Failed to generate password reset link')
    }

    return json({ 
      success: true,
      message: 'Password reset email sent successfully'
    })
  } catch (err: any) {
    console.error('Password reset error:', err)
    if (err.status) throw err
    throw error(500, err.message || 'Failed to send password reset email')
  }
}
