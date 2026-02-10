import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-excel': ['exceljs'],
          'vendor-ui': ['bits-ui', 'lucide-svelte', 'svelte-sonner']
        }
      }
    }
  }
});
