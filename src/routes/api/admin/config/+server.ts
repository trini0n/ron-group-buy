import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'
import { z } from 'zod'

const CreateConfigSchema = z.object({
  name: z.string().min(1),
  opens_at: z.string().optional(),
  closes_at: z.string().optional(),
  is_active: z.boolean().optional()
})

// Create a new group buy config
export const POST: RequestHandler = async ({ request, locals }) => {
  // Verify admin access
  if (!locals.user) {
    throw error(401, 'Unauthorized')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', locals.user.id).single()

  if (!(await isAdmin(userData?.discord_id))) {
    throw error(403, 'Forbidden')
  }

  const parseResult = CreateConfigSchema.safeParse(await request.json())
  if (!parseResult.success) {
    return json({ error: 'Invalid request body', issues: parseResult.error.issues }, { status: 400 })
  }
  const { name, opens_at, closes_at, is_active } = parseResult.data

  // If activating this config, deactivate all others first
  if (is_active) {
    await adminClient.from('group_buy_config').update({ is_active: false }).eq('is_active', true)
  }

  const { data: config, error: insertError } = await adminClient
    .from('group_buy_config')
    .insert({
      name,
      opens_at,
      closes_at,
      is_active: is_active || false
    })
    .select()
    .single()

  if (insertError) {
    logger.error({ error: insertError }, 'Error creating config')
    throw error(500, 'Failed to create group buy')
  }

  return json(config)
}
