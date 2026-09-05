import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Use isolated browser contexts against the real HTTPS deployment, without a local server.
export default defineConfig({
  ...config,
  testMatch: 'study.spec.ts', // main still hosts the original editor; this branch is not deployed.
  metadata: { evidenceDir: 'test-results/live-evidence' },
  outputDir: 'test-results/live',
  reporter: [['list'], ['json', { outputFile: 'test-results/live-results.json' }]],
  use: { ...config.use, baseURL: 'https://yydshly.github.io/0905_codexgpt6_project/' },
  webServer: undefined,
});
