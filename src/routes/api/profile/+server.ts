import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Update user profile
export const PATCH: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const { name, paypal_email } = await request.json()

  const updateData: { name?: string; paypal_email?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString()
  }
  if (name !== undefined) updateData.name = name
  if (paypal_email !== undefined) updateData.paypal_email = paypal_email || null

  const { error: updateError } = await locals.supabase
    .from('users')
    .update(updateData)
    .eq('id', locals.user.id)

  if (updateError) {
    console.error('Error updating profile:', updateError)
    throw error(500, 'Failed to update profile')
  }

  return json({ success: true })
}
