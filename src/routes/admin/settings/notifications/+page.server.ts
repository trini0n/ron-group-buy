import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { createAdminClient, isAdminDiscordId } from '$lib/server/admin'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) {
    throw redirect(303, '/auth/login')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()

  if (!isAdminDiscordId(userData?.discord_id)) {
    throw redirect(303, '/')
  }

  // Fetch notification templates
  const { data: templates } = await adminClient
    .from('notification_templates')
    .select('*')
    .order('type', { ascending: true })

  return {
    templates: templates || []
  }
}
