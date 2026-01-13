import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/utils.ts',
        'src/lib/admin-shared.ts',
        'src/lib/deck-utils.ts',
        'src/lib/server/cart-types.ts',
        'src/lib/server/search-utils.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 90,
        lines: 80
      }
    }
  }
})
