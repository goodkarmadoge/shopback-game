import { defineConfig } from 'vite';

// Relative base so the static build can be hosted from any path.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
