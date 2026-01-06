import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { Database } from '$lib/server/database.types';

export function createSupabaseClient() {
  return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseServerClient(
  cookies: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string, options: object) => void;
    remove: (key: string, options: object) => void;
  }
) {
  return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(key) {
        return cookies.get(key);
      },
      set(key, value, options) {
        cookies.set(key, value, { ...options, path: '/' });
      },
      remove(key, options) {
        cookies.remove(key, { ...options, path: '/' });
      }
    }
  });
}
