import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const UpdateAddressSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  line1: z.string().min(1).max(500).optional(),
  line2: z.string().max(500).optional().nullable(),
  city: z.string().min(1).max(255).optional(),
  state: z.string().max(255).optional().nullable(),
  postal_code: z.string().min(1).max(20).optional(),
  country: z.string().min(1).max(100).optional(),
  phone_number: z.string().max(30).optional().nullable(),
  is_default: z.boolean().optional()
})

// Update an address
export const PATCH: RequestHandler = async ({ request, params, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const parseResult = UpdateAddressSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const updates = parseResult.data

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
    logger.error(
      {
        error: updateError,
        errorCode: updateError.code,
        errorMessage: updateError.message,
        errorDetails: updateError.details,
        errorHint: updateError.hint,
        userId: locals.user.id,
        addressId: params.id
      },
      'Error updating address'
    )
    throw error(500, 'Failed to update address')
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
    logger.error(
      {
        error: deleteError,
        errorCode: deleteError.code,
        errorMessage: deleteError.message,
        errorDetails: deleteError.details,
        errorHint: deleteError.hint,
        userId: locals.user.id,
        addressId: params.id
      },
      'Error deleting address'
    )
    throw error(500, 'Failed to delete address')
  }

  return json({ success: true })
}
