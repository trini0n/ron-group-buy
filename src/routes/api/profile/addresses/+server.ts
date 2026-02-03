import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Create a new address
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const addressData = await request.json()

  // Verify user exists in users table - if not, create it
  // This handles cases where auth callback sync failed
  const { data: userExists, error: userCheckError } = await locals.supabase
    .from('users')
    .select('id, email')
    .eq('id', locals.user.id)
    .single()

  if (userCheckError?.code === 'PGRST116' || !userExists) {
    // User doesn't exist in users table - create it now
    console.log('User missing from users table, creating:', {
      authUserId: locals.user.id,
      authUserEmail: locals.user.email
    })
    
    // Use admin client to bypass RLS and create user record
    const { createAdminClient } = await import('$lib/server/admin')
    const adminClient = createAdminClient()
    
    const { error: createError } = await adminClient.from('users').insert({
      id: locals.user.id,
      email: locals.user.email || '',
      name: locals.user.user_metadata?.name || locals.user.user_metadata?.full_name || null,
      avatar_url: locals.user.user_metadata?.avatar_url || locals.user.user_metadata?.picture || null,
      discord_id: locals.user.user_metadata?.provider_id || null,
      discord_username: locals.user.user_metadata?.full_name || null
    })
    
    if (createError) {
      console.error('Failed to auto-create user record:', createError)
      throw error(500, 'User account sync failed. Please sign out and sign back in.')
    }
    
    console.log('User record created successfully:', locals.user.id)
  } else if (userCheckError) {
    console.error('User existence check failed:', {
      authUserId: locals.user.id,
      authUserEmail: locals.user.email,
      error: userCheckError,
      errorCode: (userCheckError as any)?.code,
      errorMessage: (userCheckError as any)?.message
    })
    throw error(500, 'Failed to verify user account')
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
