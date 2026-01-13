/**
 * Global test setup for Vitest
 * Runs before all tests
 */

import { vi, beforeEach } from 'vitest'

// Mock SvelteKit environment modules
vi.mock('$app/environment', () => ({
  browser: false,
  dev: true,
  building: false,
  version: 'test'
}))

// Mock public env vars
vi.mock('$env/static/public', () => ({
  PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}))

// Mock private env vars (for server tests)
vi.mock('$env/static/private', () => ({
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
}))

// Setup global mocks
beforeEach(() => {
  vi.clearAllMocks()
})
