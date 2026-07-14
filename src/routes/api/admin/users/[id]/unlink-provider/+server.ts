import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { requireAdmin, createAdminClient } from '$lib/server/admin'
import { logger } from '$lib/server/logger'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'

const VALID_PROVIDERS = ['discord', 'google'] as const
type UnlinkProvider = typeof VALID_PROVIDERS[number]

export const POST: RequestHandler = async ({ params, request, locals }) => {
  await requireAdmin(locals)

  const body = await request.json()
  const { provider } = body as { provider: string }

  // Validate provider
  if (!provider || !VALID_PROVIDERS.includes(provider as UnlinkProvider)) {
    throw error(400, `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`)
  }

  const adminClient = createAdminClient()
  const targetUserId = params.id

  // Fetch user from the users table
  const { data: userRecord, error: userError } = await adminClient
    .from('users')
    .select('id, email, google_id, discord_id')
    .eq('id', targetUserId)
    .single()

  if (userError || !userRecord) {
    throw error(404, 'User not found')
  }

  // Fetch user's auth identities from Supabase Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(targetUserId)

  if (authError || !authData?.user) {
    logger.error({ error: authError, userId: targetUserId }, 'Failed to fetch user auth data')
    throw error(500, 'Failed to fetch user authentication data')
  }

  const identities = authData.user.identities || []

  // Find the identity to remove from Supabase Auth
  const targetIdentity = identities.find((i) => i.provider === provider)

  // Check if the provider is linked in the users table (covers deduplication edge case)
  const isLinkedInDB = provider === 'discord' ? !!userRecord.discord_id : !!userRecord.google_id

  if (!targetIdentity && !isLinkedInDB) {
    throw error(404, `User does not have ${provider} linked`)
  }

  // Verify user won't be locked out — count remaining auth methods after removal
  const otherIdentities = identities.filter((i) => i.provider !== provider)
  const hasPasswordIdentity = identities.some((i) => i.provider === 'email')
  
  // Also check the users table for the OTHER provider (handles deduplication edge case)
  const hasOtherOAuthInDB = provider === 'discord'
    ? !!userRecord.google_id
    : !!userRecord.discord_id
  
  const hasRemainingAuth = otherIdentities.length > 0 || hasOtherOAuthInDB || hasPasswordIdentity

  if (!hasRemainingAuth) {
    throw error(400, 'Cannot remove last authentication method. User would be locked out.')
  }

  // Delete the identity from Supabase Auth via REST API (only if it exists in auth)
  // When Supabase deduplicates identities (same email), the identity may not exist in auth
  // but the provider is still tracked in the users table — in that case we just clear the DB fields
  if (targetIdentity) {
    try {
      const response = await fetch(
        `${PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${targetUserId}/identities/${targetIdentity.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': SUPABASE_SERVICE_ROLE_KEY
          }
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        logger.error({ status: response.status, body: errorBody, userId: targetUserId, provider }, 'Error deleting identity via REST')
        throw error(500, `Failed to unlink ${provider}`)
      }
    } catch (err: any) {
      if (err.status) throw err
      logger.error({ error: err, userId: targetUserId, provider }, 'Error deleting identity')
      throw error(500, `Failed to unlink ${provider}`)
    }
  } else {
    logger.info({ userId: targetUserId, provider }, 'Identity not found in Supabase Auth (likely deduplicated) — clearing DB fields only')
  }

  // Clear the corresponding field in the users table
  const updateData: Record<string, null> = {}
  if (provider === 'discord') {
    updateData.discord_id = null
    updateData.discord_username = null
  } else if (provider === 'google') {
    updateData.google_id = null
  }

  const { error: updateError } = await adminClient
    .from('users')
    .update(updateData)
    .eq('id', targetUserId)

  if (updateError) {
    logger.error({ error: updateError, userId: targetUserId, provider }, 'Error clearing user provider fields')
    // Don't throw — the identity was already removed from auth, just log the DB cleanup failure
  }

  logger.info({ userId: targetUserId, provider, adminId: locals.user?.id }, 'Admin unlinked user provider')

  return json({ success: true, message: `${provider} account unlinked successfully` })
}
