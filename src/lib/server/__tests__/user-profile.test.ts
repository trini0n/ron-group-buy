import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ensureUserRow } from '../user-profile'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

vi.mock('$lib/server/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('$lib/server/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))

import { createAdminClient } from '$lib/server/admin'

function makeUser(id = 'user-1'): User {
  return {
    id,
    email: 'test@example.com',
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as User
}

function makeSupabase(opts: { code?: string; exists?: boolean }): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        opts.exists
          ? { data: { id: 'user-1', email: 'test@example.com' }, error: null }
          : { data: null, error: { code: 'PGRST116', message: 'not found' } }
      )
    })
  } as unknown as SupabaseClient
}

describe('ensureUserRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves silently when insert returns 23505 (race condition)', async () => {
    const supabase = makeSupabase({ exists: false })
    const adminInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' }
    })
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: adminInsert })
    } as unknown as ReturnType<typeof createAdminClient>)

    await expect(ensureUserRow(supabase, makeUser())).resolves.toBeUndefined()
  })

  it('throws 500 when insert returns a non-23505 error', async () => {
    const supabase = makeSupabase({ exists: false })
    const adminInsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' }
    })
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: adminInsert })
    } as unknown as ReturnType<typeof createAdminClient>)

    await expect(ensureUserRow(supabase, makeUser())).rejects.toMatchObject({ status: 500 })
  })

  it('resolves without inserting when user already exists', async () => {
    const supabase = makeSupabase({ exists: true })
    await expect(ensureUserRow(supabase, makeUser())).resolves.toBeUndefined()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
