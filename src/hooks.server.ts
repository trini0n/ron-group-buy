import { createSupabaseServerClient } from '$lib/supabase'
import type { Handle } from '@sveltejs/kit'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'

export const handle: Handle = async ({ event, resolve }) => {
  // Create Supabase client for this request
  event.locals.supabase = createSupabaseServerClient({
    get: (key) => event.cookies.get(key),
    set: (key, value, options) => {
      event.cookies.set(key, value, { ...options, path: '/' })
    },
    remove: (key, options) => {
      event.cookies.delete(key, { ...options, path: '/' })
    }
  }) as unknown as SupabaseClient<Database>

  // Safe session getter - uses getUser() to verify authentication with Supabase Auth server
  event.locals.safeGetSession = async () => {
    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser()

    if (error || !user) {
      return { session: null, user: null }
    }

    // Get the session after verifying the user
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession()

    return { session, user }
  }

  // Get session for all requests
  const { session, user } = await event.locals.safeGetSession()
  event.locals.session = session
  event.locals.user = user

  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version'
    }
  })

  // Security headers on every response
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Allow Supabase API and auth
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
      // Allow Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Allow images from Supabase storage and Google Sheets
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      // Block all framing
      "frame-ancestors 'none'",
      // Block object/embed
      "object-src 'none'",
      // Allow scripts from self only
      "script-src 'self'"
    ].join('; ')
  )
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )

  return response
}
