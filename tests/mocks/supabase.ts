/**
 * Mock Supabase client factory for testing
 * Returns a chainable mock that simulates Supabase query builder
 */

import { vi } from 'vitest'

export interface MockSupabaseResponse<T> {
  data: T | null
  error: Error | null
  count?: number
}

export interface MockQueryBuilder<T> {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  ilike: ReturnType<typeof vi.fn>
  like: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  _mockResponse: MockSupabaseResponse<T>
}

/**
 * Create a chainable mock query builder
 */
export function createMockQueryBuilder<T = unknown>(
  response: MockSupabaseResponse<T> = { data: null, error: null }
): MockQueryBuilder<T> {
  const builder: MockQueryBuilder<T> = {
    _mockResponse: response,
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    ilike: vi.fn(),
    like: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn()
  }

  // Make all methods chainable and return the builder
  const chainableMethods = [
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'ilike',
    'like',
    'in',
    'order',
    'limit',
    'range'
  ] as const

  for (const method of chainableMethods) {
    builder[method].mockReturnValue(builder)
  }

  // Terminal methods return the response
  builder.single.mockResolvedValue(response)
  builder.maybeSingle.mockResolvedValue(response)

  // Make the builder itself thenable (for await)
  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: MockSupabaseResponse<T>) => void) => {
      resolve(response)
    }
  })

  return builder
}

/**
 * Create a mock Supabase client
 */
export function createMockSupabaseClient() {
  const queryBuilders = new Map<string, MockQueryBuilder<unknown>>()

  return {
    from: vi.fn((table: string) => {
      if (!queryBuilders.has(table)) {
        queryBuilders.set(table, createMockQueryBuilder())
      }
      return queryBuilders.get(table)!
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    },
    /**
     * Set mock response for a specific table
     */
    _setMockResponse<T>(table: string, response: MockSupabaseResponse<T>) {
      queryBuilders.set(table, createMockQueryBuilder(response))
    },
    /**
     * Get the query builder for a table (for assertions)
     */
    _getQueryBuilder(table: string) {
      return queryBuilders.get(table)
    }
  }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
