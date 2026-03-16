import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ensureUserRow } from '$lib/server/user-profile'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const CreateAddressSchema = z.object({
  name: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone_number: z.string().optional(),
  is_default: z.boolean().default(false)
})

// Create a new address
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const parseResult = CreateAddressSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const addressData = parseResult.data

  // Verify user exists in users table - if not, create it (handles auth callback sync failures)
  await ensureUserRow(locals.supabase, locals.user)

  // If setting as default, unset other defaults first
  if (addressData.is_default) {
    await locals.supabase.from('addresses').update({ is_default: false }).eq('user_id', locals.user.id)
  }

  const { data: address, error: insertError } = await locals.supabase
    .from('addresses')
    .insert({
      user_id: locals.user.id,
      name: addressData.name,
      line1: addressData.line1,
      line2: addressData.line2 || null,
      city: addressData.city,
      state: addressData.state || null,
      postal_code: addressData.postal_code,
      country: addressData.country,
      phone_number: addressData.phone_number || null,
      is_default: addressData.is_default || false
    })
    .select()
    .single()

  if (insertError) {
    logger.error(
      {
        error: insertError,
        errorCode: insertError.code,
        errorMessage: insertError.message,
        errorDetails: insertError.details,
        errorHint: insertError.hint,
        userId: locals.user.id,
        addressData: {
          name: addressData.name,
          city: addressData.city,
          country: addressData.country
        }
      },
      'Error creating address'
    )
    throw error(500, `Failed to create address: ${insertError.message || 'Unknown error'}`)
  }

  return json(address)
}
