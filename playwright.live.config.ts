import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Use isolated browser contexts against the real HTTPS deployment, without a local server.
export default defineConfig({
  ...config,
  metadata: { evidenceDir: 'test-results/live-evidence' },
  outputDir: 'test-results/live',
  reporter: [['list'], ['json', { outputFile: 'test-results/live-results.json' }]],
  // Public HTTPS cold loads include CDN transfer and model decoding; local
  // preview's ten-second readiness budget does not cover network variation.
  expect: { ...config.expect, timeout: 30000 },
  use: { ...config.use, baseURL: 'https://yydshly.github.io/0905_codexgpt6_project/' },
  webServer: undefined,
});
