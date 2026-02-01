import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Update an address
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const updates = await request.json()

  // If setting as default, unset other defaults first
  if (updates.is_default) {
    await locals.supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', locals.user.id)
      .neq('id', params.id)
  }

  const { data: address, error: updateError } = await locals.supabase
    .from('addresses')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', locals.user.id)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating address:', {
      error: updateError,
      errorCode: updateError.code,
      errorMessage: updateError.message,
      errorDetails: updateError.details,
      errorHint: updateError.hint,
      userId: locals.user.id,
      addressId: params.id
    })
    throw error(500, `Failed to update address: ${updateError.message || 'Unknown error'}`)
  }

  return json(address)
}

// Delete an address
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const { error: deleteError } = await locals.supabase
    .from('addresses')
    .delete()
    .eq('id', params.id)
    .eq('user_id', locals.user.id)

  if (deleteError) {
    console.error('Error deleting address:', {
      error: deleteError,
      errorCode: deleteError.code,
      errorMessage: deleteError.message,
      errorDetails: deleteError.details,
      errorHint: deleteError.hint,
      userId: locals.user.id,
      addressId: params.id
    })
    throw error(500, `Failed to delete address: ${deleteError.message || 'Unknown error'}`)
  }

  return json({ success: true })
}
