import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'
  const type = url.searchParams.get('type')

  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // If this is a password recovery, redirect to reset password page
      if (type === 'recovery') {
        throw redirect(303, '/auth/reset-password')
      }
      // If this is email confirmation, redirect to account or next
      if (type === 'signup' || type === 'email_change') {
        throw redirect(303, '/account?verified=true')
      }
      throw redirect(303, next)
    }
  }

  // Return to home on error
  throw redirect(303, '/')
}
