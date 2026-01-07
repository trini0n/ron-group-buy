import { createAdminClient } from '$lib/server/admin'

export const load = async () => {
  const adminClient = createAdminClient()

  // Fetch all group buy configs
  const { data: configs } = await adminClient
    .from('group_buy_config')
    .select('*')
    .order('created_at', { ascending: false })

  return {
    configs: configs || []
  }
}
