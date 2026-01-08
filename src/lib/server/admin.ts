import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Re-export shared constants and types for convenience in server files
export {
  ADMIN_DISCORD_IDS,
  isAdminDiscordId,
  ORDER_STATUS_CONFIG,
  getNextStatuses,
  get17TrackUrl,
  type AdminDiscordId,
  type OrderStatus
} from '$lib/admin-shared'

/**
 * Admin Supabase client with service role key
 * Use only in server-side code for admin operations
 */
export function createAdminClient() {
  return createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Check if a request is from an authenticated admin user
 * Use this in API routes to verify admin access
 */
export async function isAdminRequest(locals: App.Locals): Promise<boolean> {
  if (!locals.user) {
    return false
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from('users')
    .select('discord_id')
    .eq('id', locals.user.id)
    .single()

  return isAdminDiscordId(userData?.discord_id)
}
