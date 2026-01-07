import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Update user profile
export const PATCH: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const { name } = await request.json()

  const { error: updateError } = await locals.supabase
    .from('users')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', locals.user.id)

  if (updateError) {
    console.error('Error updating profile:', updateError)
    throw error(500, 'Failed to update profile')
  }

  return json({ success: true })
}
