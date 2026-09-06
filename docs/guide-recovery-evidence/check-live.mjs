import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Standalone audit with isolated storage: never opens or changes the author's existing projects.
const url = process.env.LIVE_GUIDE_URL ?? 'https://yydshly.github.io/0905_codexgpt6_project/?workspace=guide';
const out = path.resolve(process.env.GUIDE_EVIDENCE_DIR ?? 'test-results/live-guide-check');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? 'chromium' : 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const result = { url, timestamp: new Date().toISOString(), browser: browser.version(), platform: process.platform, attempts: [], errors: [], networkFailures: [] };
page.on('dialog', dialog => dialog.accept());
page.on('pageerror', error => result.errors.push(error.message));
page.on('crash', () => result.errors.push('Browser page crashed'));
page.on('requestfailed', request => { if (request.url().includes('.glb')) result.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }); });
const project = () => page.evaluate(() => window.__guide.project());
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const loadingBudget = 260000; // Two assets, each with a 120-second overall limit, plus UI completion.

async function loaded(label, action, target) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const start = Date.now(); await action();
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#guide-loading');
      return overlay && (overlay.hidden || !document.querySelector('#guide-load-retry').hidden);
    }, {}, { timeout: loadingBudget });
    const data = await page.evaluate(() => ({ ready: document.documentElement.dataset.ready, avatar: window.__guide.avatar()?.asset, message: document.querySelector('#guide-message').textContent }));
    const ok = data.ready === 'true' && (!target || data.avatar === target);
    const record = { label, attempt, elapsedMs: Date.now() - start, ok, ...data };
    result.attempts.push(record); console.log(JSON.stringify(record));
    if (ok) return;
  }
  throw new Error(label + ' failed after two explicit UI attempts');
}

try {
  await page.goto(url);
  await loaded('initial load', async () => {
    if (await page.locator('#guide-load-retry').isVisible()) await page.locator('#guide-load-retry').click();
  });
  const room = JSON.stringify((await project()).project);
  for (const avatar of ['creator-18-v1', 'personal-creator-01-v1', 'naruto-author-01-v1', 'personal-creator-02-v1']) {
    await loaded('select ' + avatar, () => page.locator('#guide-avatar').selectOption(avatar), avatar);
    assert(JSON.stringify((await project()).project) === room, 'Changing the character changed the room');
  }
  await page.getByRole('button', { name: '配置角色', exact: true }).click();
  assert(await page.locator('#guide-name').evaluate(el => el === document.activeElement), 'Configuration shortcut did not focus the editor');
  await page.locator('#guide-name').fill('我的导览角色'); await page.locator('#guide-name').press('Tab');
  await page.locator('#guide-color').selectOption('blue');
  await page.locator('#guide-play').click(); await page.waitForTimeout(600); await page.locator('#guide-play').click();
  assert((await project()).playhead > 0, 'Playback did not advance');
  await page.locator('#guide-save').click(); const saved = await project();
  await page.reload();
  await loaded('saved reload', async () => {
    if (await page.locator('#guide-load-retry').isVisible()) await page.locator('#guide-load-retry').click();
  }, saved.guide.avatar);
  result.restoredExact = JSON.stringify(await project()) === JSON.stringify(saved);
  assert(result.restoredExact, 'Saved guide did not restore exactly');
  const event = page.waitForEvent('download'); await page.locator('#guide-json').click();
  const jsonPath = path.join(out, 'verified-guide.json'); await (await event).saveAs(jsonPath);
  assert(JSON.stringify(JSON.parse(await readFile(jsonPath, 'utf8'))) === JSON.stringify(saved), 'Downloaded JSON differs');
  await page.locator('#guide-color').selectOption('clay');
  await page.locator('#guide-file').setInputFiles(jsonPath);
  await page.waitForFunction(() => document.querySelector('#guide-message').textContent.includes('导览已导入'));
  result.jsonRoundTripExact = JSON.stringify(await project()) === JSON.stringify(saved);
  assert(result.jsonRoundTripExact, 'JSON round trip differs');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: '配置角色', exact: true }).click();
    await page.waitForTimeout(250);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal page overflow');
    await page.screenshot({ path: path.join(out, 'online-configure-' + viewport.width + '.png') });
  }
  assert(!result.errors.length, 'Browser errors were observed');
  result.success = true;
} catch (error) {
  result.success = false; result.failure = error.message; process.exitCode = 1;
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
} finally {
  await writeFile(path.join(out, 'verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ success: result.success, failure: result.failure, attempts: result.attempts.length, errors: result.errors }));
  await browser.close();
}
