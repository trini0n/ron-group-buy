import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'

// Update notification preferences
export const PUT: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const preferences = await request.json()

  // Upsert notification preferences
  const { error: upsertError } = await locals.supabase.from('notification_preferences').upsert({
    user_id: locals.user.id,
    ...preferences
  })

  if (upsertError) {
    logger.error({ error: upsertError }, 'Error updating notifications')
    throw error(500, 'Failed to update notification preferences')
  }

  return json({ success: true })
}
