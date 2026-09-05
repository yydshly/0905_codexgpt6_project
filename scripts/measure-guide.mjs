import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const destination = path.resolve(process.env.GUIDE_EVIDENCE_DIR ?? 'docs/adult-guide-evidence');
const base = process.env.GUIDE_BASE_URL ?? 'http://127.0.0.1:5173/';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? 'chromium' : 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  const loadStarted = Date.now();
  await page.goto(base + '?workspace=guide'); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  const readyMs = Date.now() - loadStarted;
  const avatar = await page.evaluate(() => { const a = window.__guide.avatar(); return { asset: a.asset, bones: a.bones, skinnedMeshes: a.skinnedMeshes, clips: a.clips, blinkMeshes: a.blinkMeshes }; });
  await page.locator('#guide-play').click(); await page.waitForTimeout(800);
  const measured = await page.evaluate(async () => {
    const start = performance.now(), renders = window.__guide.metrics().renders;
    await new Promise(resolve => setTimeout(resolve, 2000));
    const elapsedMs = performance.now() - start, metrics = window.__guide.metrics(), frames = metrics.renders - renders;
    const times = metrics.renderTimes.slice(-frames).sort((a, b) => a - b);
    return { elapsedMs, sceneRenders: frames, renderedFramesPerSecond: frames / elapsedMs * 1000, renderSubmissionMeanMs: times.reduce((a, b) => a + b, 0) / times.length, renderSubmissionP95Ms: times[Math.floor(times.length * .95)], gpu: metrics.gpu, calls: metrics.calls, sceneTriangles: metrics.sceneTriangles, canvas: metrics.canvas, pixelRatio: metrics.pixelRatio };
  });
  await page.locator('#guide-play').click(); await page.waitForTimeout(200);
  const idle = await page.evaluate(async () => { const before = window.__guide.metrics().renders; await new Promise(resolve => setTimeout(resolve, 600)); return window.__guide.metrics().renders - before; });
  await page.locator('#guide-scrub').fill('5.5');
  const box = await page.locator('#guide-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .53, box.y + box.height * .53); await page.mouse.wheel(0, -270); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(destination, '07-character-close.png') });
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .55, box.y + box.height * .89, { steps: 20 }); await page.mouse.up(); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(destination, '08-room-overhead.png') });
  await page.locator('#guide-camera').click(); await page.mouse.move(box.x + box.width * .64, box.y + box.height * .6); await page.mouse.down(); await page.mouse.move(box.x + box.width * .74, box.y + box.height * .63, { steps: 16 }); await page.mouse.up(); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(destination, '09-room-alternate-angle.png') });
  await page.locator('#guide-scrub').fill('0'); await page.locator('#guide-character-close').click(); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(destination, '11-adult-front.png') });
  await page.mouse.move(box.x + box.width * .55, box.y + box.height * .58); await page.mouse.down(); await page.mouse.move(box.x + box.width * .40, box.y + box.height * .58, { steps: 24 }); await page.mouse.up(); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(destination, '12-adult-side.png') });
  const result = { timestamp: new Date().toISOString(), browser: browser.version(), platform: process.platform, viewport: [1440, 900], headless: true, readyMs, avatar, ...measured, idleRendersIn600Ms: idle, errors, note: 'Scene rendering is limited to the 30 fps guide sampler. Submission timings measure composer.render on the JS thread, not isolated GPU duration. Ready time is an unthrottled local-server cold browser context, not an Internet download guarantee. This is one local machine; not a cross-device FPS guarantee.' };
  await writeFile(path.join(destination, 'performance.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
