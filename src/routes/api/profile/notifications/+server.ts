import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

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
    console.error('Error updating notifications:', upsertError)
    throw error(500, 'Failed to update notification preferences')
  }

  return json({ success: true })
}
