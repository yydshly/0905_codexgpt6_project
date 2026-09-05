import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testMatch: 'film.spec.ts', timeout: 180000, metadata: { evidenceDir: 'test-results/film-evidence' }, outputDir: 'test-results/film', reporter: [['list'], ['json', { outputFile: 'test-results/film-results.json' }]], webServer: { ...config.webServer, command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120000 } });
