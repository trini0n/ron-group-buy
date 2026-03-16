import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { env } from '$env/dynamic/private'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Re-export shared order-status constants and types for convenience in server files
export { ORDER_STATUS_CONFIG, getNextStatuses, type OrderStatus } from '$lib/admin-shared'

// Parse admin Discord IDs from env var at module load (server-only)
function getAdminDiscordIds(): string[] {
  return (env.ADMIN_DISCORD_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function isAdminDiscordId(discordId: string): boolean {
  return getAdminDiscordIds().includes(discordId)
}

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
 * Check if a Discord ID has admin access (checks both hardcoded and database)
 * This is the unified admin check that should be used server-side
 */
export async function isAdmin(
  discordId: string | null | undefined,
  adminClient?: ReturnType<typeof createAdminClient>
): Promise<boolean> {
  if (!discordId) {
    return false
  }

  // First check hardcoded super admins (for bootstrap and safety)
  if (isAdminDiscordId(discordId)) {
    return true
  }

  // Then check database admins table
  const client = adminClient ?? createAdminClient()
  const { data } = await client.from('admins').select('discord_id').eq('discord_id', discordId).single()

  return !!data
}

/**
 * Check if a request is from an authenticated admin user
 * Use this in API routes to verify admin access
 */
export async function isAdminRequest(locals: App.Locals): Promise<boolean> {
  if (!locals.user) {
    return false
  }

  // Emergency fallback: UUID-based access for non-Discord accounts
  const emergencyUuids = (env.ADMIN_EMERGENCY_UUIDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (emergencyUuids.includes(locals.user.id)) {
    return true
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', locals.user.id).single()

  return isAdmin(userData?.discord_id, adminClient)
}

/**
 * Require admin access for API routes
 * Throws 401 if not authenticated, 403 if not admin
 * Use this at the start of admin API endpoints
 */
export async function requireAdmin(locals: App.Locals): Promise<void> {
  if (!locals.user) {
    const { error } = await import('@sveltejs/kit')
    throw error(401, 'Unauthorized')
  }

  // Emergency fallback: UUID-based access for non-Discord accounts
  const emergencyUuids = (env.ADMIN_EMERGENCY_UUIDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (emergencyUuids.includes(locals.user.id)) {
    return
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', locals.user.id).single()

  if (!(await isAdmin(userData?.discord_id, adminClient))) {
    const { error } = await import('@sveltejs/kit')
    throw error(403, 'Forbidden')
  }
}
