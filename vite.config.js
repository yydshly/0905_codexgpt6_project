import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/0905_codexgpt6_project/' : '/',
  server: {
    // Windows stylesheet edits were not reliably reflected by native file watching.
    watch: { usePolling: process.platform === 'win32', interval: 300 },
  },
}));
