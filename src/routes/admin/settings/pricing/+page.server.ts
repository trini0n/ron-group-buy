import { error, redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { isAdmin } from '$lib/server/admin'

export async function load({ locals }: RequestEvent) {
  const { data: userData } = await locals.supabase
    .from('users')
    .select('discord_id')
    .eq('id', locals.user?.id ?? '')
    .single()

  if (!locals.user || !(await isAdmin(userData?.discord_id))) {
    throw redirect(302, '/')
  }

  const { data: pricing, error: dbError } = await locals.supabase
    .from('card_type_pricing')
    .select('card_type, price')
    .order('card_type')

  if (dbError) throw error(500, dbError.message)

  return { pricing: pricing ?? [] }
}
