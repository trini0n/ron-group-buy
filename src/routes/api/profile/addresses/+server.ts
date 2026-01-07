import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Create a new address
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const addressData = await request.json()

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
    console.error('Error creating address:', insertError)
    throw error(500, 'Failed to create address')
  }

  return json(address)
}
