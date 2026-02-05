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

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version'
    }
  })
}
