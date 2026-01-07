import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'

// Update a group buy config
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
  // Verify admin access
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', locals.user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw error(403, 'Forbidden')
  }

  const updates = await request.json()

  // If activating this config, deactivate all others first
  if (updates.is_active === true) {
    await adminClient.from('group_buy_config').update({ is_active: false }).neq('id', params.id)
  }

  const { data: config, error: updateError } = await adminClient
    .from('group_buy_config')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating config:', updateError)
    throw error(500, 'Failed to update group buy')
  }

  return json(config)
}

// Delete a group buy config
export const DELETE: RequestHandler = async ({ params, locals }) => {
  // Verify admin access
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', locals.user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw error(403, 'Forbidden')
  }

  // Check if config is active
  const { data: config } = await adminClient.from('group_buy_config').select('is_active').eq('id', params.id).single()

  if (config?.is_active) {
    throw error(400, 'Cannot delete an active group buy')
  }

  const { error: deleteError } = await adminClient.from('group_buy_config').delete().eq('id', params.id)

  if (deleteError) {
    console.error('Error deleting config:', deleteError)
    throw error(500, 'Failed to delete group buy')
  }

  return json({ success: true })
}
