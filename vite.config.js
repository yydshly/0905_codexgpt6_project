import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Windows stylesheet edits were not reliably reflected by native file watching.
    watch: { usePolling: process.platform === 'win32', interval: 300 },
  },
});
