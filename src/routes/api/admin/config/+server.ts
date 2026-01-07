import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'

// Create a new group buy config
export const POST: RequestHandler = async ({ request, locals }) => {
  // Verify admin access
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', locals.user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw error(403, 'Forbidden')
  }

  const { name, opens_at, closes_at, is_active } = await request.json()

  if (!name) {
    throw error(400, 'Name is required')
  }

  // If activating this config, deactivate all others first
  if (is_active) {
    await adminClient.from('group_buy_config').update({ is_active: false }).eq('is_active', true)
  }

  const { data: config, error: insertError } = await adminClient
    .from('group_buy_config')
    .insert({
      name,
      opens_at,
      closes_at,
      is_active: is_active || false
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error creating config:', insertError)
    throw error(500, 'Failed to create group buy')
  }

  return json(config)
}
