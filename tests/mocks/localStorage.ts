/**
 * Mock localStorage for testing store persistence
 */

import { vi } from 'vitest'

export function createMockLocalStorage() {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    get length() {
      return store.size
    },
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys())
      return keys[index] ?? null
    }),
    /**
     * Helper to get raw store for assertions
     */
    _getStore: () => new Map(store),
    /**
     * Helper to set initial state
     */
    _setStore: (data: Record<string, string>) => {
      store.clear()
      for (const [key, value] of Object.entries(data)) {
        store.set(key, value)
      }
    }
  }
}

export type MockLocalStorage = ReturnType<typeof createMockLocalStorage>

/**
 * Install mock localStorage globally
 */
export function installMockLocalStorage(): MockLocalStorage {
  const mock = createMockLocalStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true
  })
  return mock
}
