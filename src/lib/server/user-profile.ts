import { createAdminClient } from '$lib/server/admin'
import { error } from '@sveltejs/kit'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { logger } from '$lib/server/logger'

/**
 * Ensures a row exists in the public.users table for the given auth user.
 * Uses admin client to bypass RLS for inserts since users cannot insert their own rows.
 * Safe to call on every request — only inserts if the row is missing.
 */
export async function ensureUserRow(supabase: SupabaseClient, user: User): Promise<void> {
  const { data: userExists, error: checkError } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', user.id)
    .single()

  if (checkError?.code === 'PGRST116' || !userExists) {
    const adminClient = createAdminClient()
    const { error: createError } = await adminClient.from('users').insert({
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      discord_id: user.user_metadata?.provider_id || null,
      discord_username: user.user_metadata?.full_name || null
    })
    if (createError) {
      logger.error({ userId: user.id, error: createError }, 'ensureUserRow: failed to create user record')
      throw error(500, 'User account sync failed. Please sign out and sign back in.')
    }
  } else if (checkError) {
    logger.error({ userId: user.id, error: checkError }, 'ensureUserRow: failed to check user record')
    throw error(500, 'Failed to verify user account')
  }
}
