// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient, Session, User } from '@supabase/supabase-js'
import type { Database } from '$lib/server/database.types'

type SupabaseClientWithDB = SupabaseClient<Database>

declare global {
  namespace App {
    interface Locals {
      // Use a generic SupabaseClient - the actual methods will infer from Database type
      supabase: SupabaseClientWithDB
      safeGetSession: () => Promise<{
        session: Session | null
        user: User | null
      }>
      session: Session | null
      user: User | null
    }
    interface PageData {
      session: Session | null
      user: User | null
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {}
