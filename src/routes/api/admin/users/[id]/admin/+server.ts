import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'

// Toggle admin status for a user
export const POST: RequestHandler = async ({ request, params, locals }) => {
  // Verify admin access
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const adminClient = createAdminClient()
  const { data: currentUserData } = await adminClient
    .from('users')
    .select('discord_id')
    .eq('id', locals.user.id)
    .single()

  if (!isAdminDiscordId(currentUserData?.discord_id)) {
    throw error(403, 'Forbidden')
  }

  // Get the target user
  const { data: targetUser, error: userError } = await adminClient
    .from('users')
    .select('id, discord_id, name, email')
    .eq('id', params.id)
    .single()

  if (userError || !targetUser) {
    throw error(404, 'User not found')
  }

  if (!targetUser.discord_id) {
    throw error(400, 'User must have Discord linked to be an admin')
  }

  const body = await request.json()
  const { isAdmin } = body

  if (isAdmin) {
    // Add to admins table
    const { error: insertError } = await adminClient.from('admins').upsert(
      {
        discord_id: targetUser.discord_id,
        user_id: targetUser.id,
        role: 'admin'
      },
      {
        onConflict: 'discord_id'
      }
    )

    if (insertError) {
      console.error('Error adding admin:', insertError)
      throw error(500, 'Failed to add admin')
    }
  } else {
    // Check if trying to remove a super_admin (not allowed)
    const { data: existingAdmin } = await adminClient
      .from('admins')
      .select('role')
      .eq('discord_id', targetUser.discord_id)
      .single()

    if (existingAdmin?.role === 'super_admin') {
      throw error(400, 'Cannot remove super admin status')
    }

    // Remove from admins table
    const { error: deleteError } = await adminClient.from('admins').delete().eq('discord_id', targetUser.discord_id)

    if (deleteError) {
      console.error('Error removing admin:', deleteError)
      throw error(500, 'Failed to remove admin')
    }
  }

  return json({ success: true, isAdmin })
}
