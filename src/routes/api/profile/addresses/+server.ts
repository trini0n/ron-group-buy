import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Create a new address
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const addressData = await request.json()

  // Verify user exists in users table (diagnose potential sync issue)
  const { data: userExists, error: userCheckError } = await locals.supabase
    .from('users')
    .select('id, email')
    .eq('id', locals.user.id)
    .single()

  if (userCheckError || !userExists) {
    console.error('User existence check failed:', {
      authUserId: locals.user.id,
      authUserEmail: locals.user.email,
      error: userCheckError,
      errorCode: userCheckError?.code,
      errorMessage: userCheckError?.message,
      errorDetails: userCheckError?.details,
      errorHint: userCheckError?.hint
    })
    throw error(500, 'User account not properly synced. Please sign out and sign back in.')
  }

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
      is_default: addressData.is_default || false
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error creating address:', {
      error: insertError,
      errorCode: insertError.code,
      errorMessage: insertError.message,
      errorDetails: insertError.details,
      errorHint: insertError.hint,
      userId: locals.user.id,
      userEmail: locals.user.email,
      addressData: {
        name: addressData.name,
        city: addressData.city,
        country: addressData.country
      }
    })
    throw error(500, `Failed to create address: ${insertError.message || 'Unknown error'}`)
  }

  return json(address)
}
