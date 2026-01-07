import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, parent }) => {
  // Get layout data which includes groupBuyConfig
  const parentData = await parent()

  return {
    user: locals.user,
    groupBuyConfig: parentData.groupBuyConfig
  }
}
