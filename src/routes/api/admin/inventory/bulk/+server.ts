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

export const PATCH: RequestHandler = async ({ request, locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  const body = await request.json()
  const { card_ids, is_in_stock } = body

  // Validate input
  if (!Array.isArray(card_ids) || card_ids.length === 0) {
    throw error(400, 'card_ids must be a non-empty array')
  }

  if (typeof is_in_stock !== 'boolean') {
    throw error(400, 'is_in_stock must be a boolean')
  }

  // Update cards
  const { error: updateError, count } = await adminClient.from('cards').update({ is_in_stock }).in('id', card_ids)

  if (updateError) {
    console.error('Error updating cards:', updateError)
    throw error(500, 'Failed to update cards')
  }

  return json({
    success: true,
    updated: card_ids.length
  })
}
