import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'

export type ConflictType = 
  | 'IDENTITY_ALREADY_LINKED'   // Provider ID already used by another user
  | 'EMAIL_ALREADY_IN_USE'      // Email already used by another user

export interface ConflictInfo {
  type: ConflictType
  conflictingUserId: string
  conflictingUserEmail: string
  provider?: 'google' | 'discord'
}

/**
 * Check if a provider identity (Google/Discord) is already linked to another user
 */
export async function checkProviderConflict(
  supabase: SupabaseClient<Database>,
  currentUserId: string,
  provider: 'google' | 'discord',
  providerId: string
): Promise<ConflictInfo | null> {
  const column = provider === 'google' ? 'google_id' : 'discord_id'
  
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq(column, providerId)
    .neq('id', currentUserId)
    .single()

  if (existingUser) {
    return {
      type: 'IDENTITY_ALREADY_LINKED',
      conflictingUserId: existingUser.id,
      conflictingUserEmail: existingUser.email,
      provider
    }
  }

  return null
}

/**
 * Check if an email is already in use by another account
 * Used before adding password to ensure no email collision
 */
export async function checkEmailConflict(
  supabase: SupabaseClient<Database>,
  currentUserId: string,
  email: string
): Promise<ConflictInfo | null> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .neq('id', currentUserId)
    .single()

  if (existingUser) {
    return {
      type: 'EMAIL_ALREADY_IN_USE',
      conflictingUserId: existingUser.id,
      conflictingUserEmail: existingUser.email
    }
  }

  return null
}

/**
 * Build redirect URL for conflict resolution page
 */
export function buildConflictRedirectUrl(
  conflict: ConflictInfo,
  returnTo: string = '/profile'
): string {
  const params = new URLSearchParams({
    type: conflict.type,
    conflictUserId: conflict.conflictingUserId,
    returnTo
  })
  
  if (conflict.provider) {
    params.set('provider', conflict.provider)
  }

  return `/profile/conflict?${params.toString()}`
}
