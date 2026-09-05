import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Exercise the same acceptance journey at the repository subpath used by Pages.
// Keep these measurements separate from the previous root-path evidence.
export default defineConfig({
  ...config,
  metadata: { evidenceDir: 'test-results/pages-evidence' },
  outputDir: 'test-results/pages',
  reporter: [['list'], ['json', { outputFile: 'test-results/pages-results.json' }]],
  use: { ...config.use, baseURL: 'http://127.0.0.1:4174/0905_codexgpt6_project/' },
  webServer: {
    command: 'npm run build:pages && npm run preview:pages',
    url: 'http://127.0.0.1:4174/0905_codexgpt6_project/',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
