import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 90000,
  expect: { timeout: 10000 }, reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 900 }, channel: process.env.CI ? 'chromium' : 'chrome', launchOptions: { args: process.env.CI ? ['--enable-unsafe-swiftshader'] : [] }, headless: true, deviceScaleFactor: 1, actionTimeout: 12000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 120000 },
});
