import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { unzipSync } from 'fflate';

const evidence = path.resolve(process.env.GUIDE_EVIDENCE_DIR ?? 'test-results/guide-evidence');
const ready = async (page: Page) => { await page.goto('./?workspace=guide'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); };
const project = (page: Page) => page.evaluate(() => (window as any).__guide.project());
const state = (page: Page) => page.evaluate(() => (window as any).__guide.state());
const scrub = async (page: Page, time: number) => { await page.locator('#guide-scrub').fill(String(time)); await page.waitForTimeout(120); };
async function capture(page: Page, filename: string) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(evidence, filename) }); }
async function pixels(page: Page, selector: string) { return page.locator(selector).evaluate(el => { const c = document.createElement('canvas'); c.width = 160; c.height = 90; const ctx = c.getContext('2d')!; ctx.drawImage(el as HTMLCanvasElement, 0, 0, 160, 90); return [...ctx.getImageData(0, 0, 160, 90).data]; }); }
function difference(a: number[], b: number[]) { let sum = 0; for (let i = 0; i < a.length; i++) if (i % 4 !== 3) sum += Math.abs(a[i] - b[i]); return sum / (a.length * .75); }
test.beforeAll(async () => { await mkdir(evidence, { recursive: true }); });
test.beforeEach(async ({ page }) => { if (process.env.CI) { test.setTimeout(300000); page.setDefaultTimeout(45000); } page.on('dialog', d => d.accept()); });

test('导览闭环：修改、历史、保存恢复、JSON、真实视频重新播放与同帧比对', async ({ page, browser }) => {
  test.setTimeout(process.env.CI ? 2100000 : 300000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page); await capture(page, '01-guide-default-1440x900.png'); expect((await state(page)).routeError).toBe('');
  expect((await project(page)).guide.avatar).toBe('naruto-author-01-v1');
  expect(await page.evaluate(() => (window as any).__guide.avatar().asset)).toBe('naruto-author-01-v1');
  await page.locator('[data-stop="1"]').click();
  await page.locator('#guide-movement').selectOption('walk');
  await page.locator('#guide-duration').selectOption('6.5'); await page.locator('#guide-color').selectOption('clay');
  await page.locator('#guide-name').fill('小禾'); await page.locator('#guide-name').press('Tab');
  await page.locator('#guide-title').fill('小禾 · 作品导览验收'); await page.locator('#guide-title').press('Tab');
  await page.locator('#guide-undo').click(); expect((await project(page)).name).toBe('鸣人的书房漫游'); await page.locator('#guide-redo').click();
  await page.locator('#guide-start').click(); await page.locator('#guide-play').click();
  const playback = await page.evaluate(async () => { const intervals: number[] = []; let last = performance.now(), start = last; await new Promise<void>(resolve => { const tick = (now: number) => { intervals.push(now - last); last = now; if (now - start >= 2000) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); return { intervals, metrics: (window as any).__guide.metrics() }; });
  expect((await state(page)).playing).toBe(true); await page.locator('#guide-play').click(); const paused = (await project(page)).playhead; await page.waitForTimeout(160); expect((await project(page)).playhead).toBe(paused);
  await scrub(page, 5.5); await capture(page, '02-guide-reading-1440x900.png');
  const initialPixels = await pixels(page, '#guide-canvas canvas'); await scrub(page, 13); await scrub(page, 5.5); expect(difference(initialPixels, await pixels(page, '#guide-canvas canvas'))).toBeLessThan(.01);
  await page.setViewportSize({ width: 1280, height: 800 }); await scrub(page, 12.5); await capture(page, '03-guide-pointing-1280x800.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stage = await page.locator('#guide-canvas').boundingBox(), timeline = await page.locator('.guide-timeline').boundingBox(); expect(stage!.width).toBeGreaterThan(750); expect(stage!.y + stage!.height).toBeLessThan(timeline!.y);
  await page.locator('[data-guide-mood="night"]').click(); expect((await project(page)).project.scene.mood).toBe('night');
  await page.locator('[data-guide-mood="day"]').click(); expect((await project(page)).project.scene.mood).toBe('day');
  await page.locator('#guide-save').click(); await expect(page.locator('#guide-save-state')).toHaveText('已保存到本地'); const saved = await project(page);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); expect(await project(page)).toEqual(saved); expect((await state(page)).playing).toBe(false);
  let downloaded = page.waitForEvent('download'); await page.locator('#guide-json').click(); const json = await downloaded; const jsonPath = path.join(evidence, 'verified-guide.json'); await json.saveAs(jsonPath); expect(JSON.parse(await readFile(jsonPath, 'utf8'))).toEqual(saved);
  await page.locator('#guide-color').selectOption('blue'); await page.locator('#guide-file').setInputFiles(jsonPath); expect(await project(page)).toEqual(saved);
  const rawStorage = await page.evaluate(() => localStorage.getItem('ideal-study.guide.v1:demo'));
  for (const raw of ['broken json', JSON.stringify({ ...saved, version: 99 }), JSON.stringify({ ...saved, guide: { ...saved.guide, stops: [{ ...saved.guide.stops[0], itemId: 'missing' }] } })]) { await page.locator('#guide-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(raw) }); await expect(page.locator('#guide-message')).toContainText('导入失败'); expect(await project(page)).toEqual(saved); }
  expect(await page.evaluate(() => localStorage.getItem('ideal-study.guide.v1:demo'))).toBe(rawStorage);
  await page.locator('#guide-export').click(); await expect(page.locator('#guide-render')).toBeEnabled(); const codec = await page.locator('#guide-codec').inputValue(), began = Date.now();
  await page.locator('#guide-render').click(); await expect(page.locator('#guide-video-result')).toBeVisible({ timeout: process.env.CI ? 1800000 : 180000 }); const encodingMs = Date.now() - began;
  const info = await page.locator('#guide-video').evaluate((v: HTMLVideoElement) => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, ready: v.readyState })); expect(info.duration).toBeCloseTo(26.5, 2); expect([info.width, info.height]).toEqual([1280, 720]);
  downloaded = page.waitForEvent('download'); await page.locator('#guide-video-download').click(); const movie = await downloaded; const moviePath = path.join(evidence, 'xiaohe-guide.' + (codec === 'avc' ? 'mp4' : 'webm')); await movie.saveAs(moviePath); const bytes = await readFile(moviePath); expect(bytes.length).toBeGreaterThan(100000);
  await page.locator('#guide-video').evaluate((v: HTMLVideoElement) => v.play()); await page.waitForTimeout(250); expect(await page.locator('#guide-video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(.1); await capture(page, '04-guide-export-replay.png'); await page.locator('#guide-export-close').click(); expect(await project(page)).toEqual(saved);
  const server = createServer((req, res) => { if (req.url === '/movie') { const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? ''), start = range ? +range[1] : 0, end = range?.[2] ? Math.min(+range[2], bytes.length - 1) : bytes.length - 1; res.writeHead(range ? 206 : 200, { 'Content-Type': codec === 'avc' ? 'video/mp4' : 'video/webm', 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${bytes.length}` } : {}) }); res.end(bytes.subarray(start, end + 1)); } else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<body style="margin:0;background:#25362a;display:grid;place-items:center;height:100vh"><video src="/movie" muted controls style="width:100%;max-width:1280px"></video>'); } });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const replay = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const frameChecks: unknown[] = [];
  try {
    await replay.goto(`http://127.0.0.1:${(server.address() as any).port}/`); await replay.waitForFunction(() => document.querySelector('video')!.readyState >= 2);
    for (const time of [1.5, 5.5, 13, 20, 25]) { await page.bringToFront(); await scrub(page, time); const preview = await pixels(page, '#guide-canvas canvas'); await replay.bringToFront(); await replay.locator('video').evaluate((v: HTMLVideoElement, t) => new Promise<void>(resolve => { v.onseeked = () => resolve(); v.currentTime = t; }), time); const mae = difference(preview, await pixels(replay, 'video')); expect(mae).toBeLessThan(9); frameChecks.push({ time, meanAbsolutePixelDifference: mae }); }
    await capture(replay, '05-downloaded-guide-opened.png'); await replay.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 0; return v.play(); }); await replay.waitForFunction(() => document.querySelector('video')!.ended, {}, { timeout: 35000 }); expect(await replay.locator('video').evaluate((v: HTMLVideoElement) => v.error)).toBeNull();
  } finally { await replay.close(); await new Promise<void>(r => server.close(() => r())); }
  expect(errors).toEqual([]);
  await writeFile(path.join(evidence, 'journey.json'), JSON.stringify({ timestamp: new Date().toISOString(), browser: browser.version(), platform: process.platform, viewports: ['1440x900', '1280x800'], restoredExact: true, jsonRoundTripExact: true, deterministicSeek: true, invalidImportsPreserveState: true, codec, info, bytes: bytes.length, encodingMs, frameChecks, downloadedFilePlayedToEnd: true, playback, errors }, null, 2));
});

test('真实点击入口、快速切换、跳过、动作完成、镜头冲突与路径保护', async ({ page }) => {
  // Keep action/selection assertions independent of GPU readback time. Advance
  // the browser clock explicitly when checking completion of a real action.
  await page.clock.install({ time: new Date('2026-09-06T00:00:00Z') });
  await ready(page);
  await page.clock.pauseAt(new Date('2026-09-06T01:00:00Z'));
  // Hide only the DOM sign, then click its anchor on the real book mesh.
  const book = page.locator('.study-hotspot[data-target="desk-1/book-1"]'), bookBox = await book.boundingBox();
  await book.evaluate(el => { el.style.visibility = 'hidden'; }); await page.mouse.click(bookBox!.x + bookBox!.width / 2, bookBox!.y + bookBox!.height / 2); await book.evaluate(el => { el.style.visibility = ''; });
  expect((await state(page)).playing).toBe(true);
  await page.clock.runFor(32);
  await page.locator('.study-hotspot[data-target="monitor-1/screen"]').click(); expect((await project(page)).selected).toBe(1);
  await page.locator('#guide-open').click(); await expect(page.locator('.work-dialog')).toBeVisible(); await expect(page.locator('#work-title')).toHaveText('让空间，成为作品'); expect((await state(page)).playing).toBe(false); await page.getByRole('button', { name: '关闭作品详情' }).click();
  await page.clock.runFor(700); await expect(page.locator('.work-dialog')).toBeHidden();
  await page.locator('.study-hotspot[data-target="desk-1/book-1"]').click(); await page.clock.fastForward(9000); await expect(page.locator('.work-dialog')).toBeVisible(); await expect(page.locator('#work-title')).toHaveText('理想书房 · 开源创作'); await page.getByRole('button', { name: '关闭作品详情' }).click();
  await page.locator('#guide-play').click(); const canvas = await page.locator('#guide-canvas').boundingBox(); await page.mouse.move(canvas!.x + canvas!.width * .65, canvas!.y + canvas!.height * .8); await page.mouse.down(); await page.mouse.move(canvas!.x + canvas!.width * .7, canvas!.y + canvas!.height * .75, { steps: 10 }); await page.mouse.up(); expect((await state(page)).playing).toBe(false);
  const p = await project(page), before = await page.evaluate(() => (window as any).__guide.camera()); await page.locator('#guide-camera').click(); expect(await page.evaluate(() => (window as any).__guide.camera())).not.toEqual(before); expect(await project(page)).toEqual(p);
  // Check every sampled floor location against independently expanded rotated rectangles.
  const samples = await page.evaluate(() => Array.from({ length: 481 }, (_, i) => (window as any).__guide.sample(i / 30)));
  for (const s of samples) for (const o of p.project.scene.objects) { if (o.parentId || ['rug', 'wallPhoto'].includes(o.kind)) continue; const sizes: Record<string, number[]> = { desk: [1.95, .85], chair: [.62, .65], shelf: [1.18, .38], floorLamp: [.55, .55], plant: [.7, .7] }; const size = sizes[o.kind]; if (!size) continue; const a = o.rotation * Math.PI / 180, dx = s.position.x - o.x, dz = s.position.z - o.z; expect(Math.abs(dx * Math.cos(a) - dz * Math.sin(a)) >= size[0] / 2 + .255 || Math.abs(dx * Math.sin(a) + dz * Math.cos(a)) >= size[1] / 2 + .255).toBe(true); }
  for (let i = 1; i < samples.length; i++) expect(Math.hypot(samples[i].position.x - samples[i - 1].position.x, samples[i].position.z - samples[i - 1].position.z)).toBeLessThan(.09);
  await page.locator('#guide-file').setInputFiles('tests/fixtures/legacy-v1.json'); await expect(page.locator('#guide-message')).toContainText('独立导览快照'); expect((await project(page)).project.version).toBe(4);
  const old = await project(page); old.project.scene.objects = old.project.scene.objects.filter((o: any) => !['desk', 'monitor', 'taskLamp'].includes(o.kind)); old.project.scene.portfolio.bindings = []; old.guide.stops = []; old.selected = 0; old.playhead = 0;
  await page.locator('#guide-file').setInputFiles({ name: 'no-target.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) }); await expect(page.locator('#guide-play')).toBeDisabled(); expect((await state(page)).routeError).toContain('没有书桌');
});

test('导览网站包离线于编辑器、子路径部署、作品关联与访客模式', async ({ page, browser }) => {
  await ready(page); await page.locator('#guide-movement').selectOption('walk'); await page.locator('#guide-name').fill('阿禾'); await page.locator('#guide-name').press('Tab'); await page.locator('#guide-color').selectOption('blue'); const author = await project(page);
  const event = page.waitForEvent('download'); await page.locator('#guide-publish').click(); const download = await event, file = path.join(evidence, 'xiaohe-guide.website.zip'); await download.saveAs(file); const files = unzipSync(new Uint8Array(await readFile(file))); const published = JSON.parse(new TextDecoder().decode(files['project.json'])); expect(published.guide).toEqual(author.guide); expect(published.app).toBe('ideal-study-guide');
  expect(new TextDecoder().decode(files['LICENSES.txt'])).toContain('ronildo.facanha'); expect(published.guide.movement).toBe('walk');
  expect(files['assets/naruto-author-01.glb']).toEqual(new Uint8Array(await readFile('src/assets/guide/naruto-author-01.glb')));
  expect(files['assets/personal-creator-02.glb']).toBeUndefined();
  expect(files['assets/personal-creator-01.glb']).toBeUndefined();
  expect(files['assets/creator-18.glb']).toBeUndefined(); expect(files['assets/guide-motion-v1.glb']).toEqual(new Uint8Array(await readFile('src/assets/guide/guide-motion-v1.glb')));
  const server = createServer((req, res) => { const name = (req.url ?? '').replace(/^\/demo\//, '') || 'index.html'; const bytes = files[name]; if (!bytes) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.json') ? 'application/json' : 'text/html' }); res.end(bytes); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const visitor = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors: string[] = []; visitor.on('pageerror', e => errors.push(e.message)); if (process.env.CI) visitor.setDefaultTimeout(45000);
  await visitor.clock.install({ time: new Date('2026-09-06T00:00:00Z') });
  try { await visitor.goto(`http://127.0.0.1:${(server.address() as any).port}/demo/`); await expect(visitor.locator('html')).toHaveAttribute('data-ready', 'true'); expect((await project(visitor)).guide).toEqual(author.guide); await expect(visitor.locator('#guide-save')).toHaveCount(0); await expect(visitor.locator('#guide-import')).toHaveCount(0); await expect(visitor.locator('#guide-name-label')).toHaveText('阿禾');
    await visitor.clock.pauseAt(new Date('2026-09-06T01:00:00Z'));
    await scrub(page, 1.5); await scrub(visitor, 1.5);
    expect(await visitor.evaluate(() => (window as any).__guide.avatar())).toEqual(await page.evaluate(() => (window as any).__guide.avatar()));
    await visitor.locator('#guide-play').click(); await visitor.clock.runFor(300); expect((await state(visitor)).playing).toBe(true); await visitor.locator('#guide-open').click(); await expect(visitor.locator('.work-dialog')).toBeVisible(); await expect(visitor.locator('.work-visit')).toHaveAttribute('href', 'https://github.com/yydshly/0905_codexgpt6_project'); await visitor.getByRole('button', { name: '关闭作品详情' }).click(); await scrub(visitor, 5.5); await visitor.clock.runFor(32); await capture(visitor, '06-independent-guide-website.png');
    await visitor.setViewportSize({ width: 390, height: 844 }); expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await visitor.locator('#guide-play').click(); await visitor.clock.runFor(150); expect((await state(visitor)).playing).toBe(true); await visitor.locator('#guide-play').click(); expect(errors).toEqual([]);
    await writeFile(path.join(evidence, 'website.json'), JSON.stringify({ browser: browser.version(), standalone: true, subpath: '/demo/', isolatedStorage: true, guideSettingsExact: true, naturalWalkPoseMatchesEditorExactly: true, workLinkExact: true, editorControlsAbsent: true, mobileOverflow: false, errors }, null, 2));
  } finally { await visitor.close(); await new Promise<void>(r => server.close(() => r())); }
});

test('减少动态、保存失败、导出取消、无编码与无 WebGL 降级', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await ready(page);
  await page.locator('.study-hotspot[data-target="monitor-1/screen"]').click(); await expect(page.locator('.work-dialog')).toBeVisible(); expect((await state(page)).playing).toBe(false); await page.getByRole('button', { name: '关闭作品详情' }).click();
  const before = await project(page); await page.locator('#guide-export').click(); await expect(page.locator('#guide-render')).toBeEnabled(); await page.locator('#guide-render').click(); await page.locator('#guide-cancel').click(); await expect(page.locator('#guide-export-message')).toContainText('已取消', { timeout: 30000 }); expect(await project(page)).toEqual(before); await expect(page.locator('#guide-video-result')).toBeHidden(); await page.keyboard.press('Escape');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; }); await page.locator('#guide-save').click(); await expect(page.locator('#guide-message')).toContainText('本地保存失败');
  await page.addInitScript(() => { Object.defineProperty(window, 'VideoEncoder', { value: undefined, configurable: true }); }); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); await page.locator('#guide-export').click(); await expect(page.locator('#guide-codec-note')).toContainText('不支持'); await expect(page.locator('#guide-render')).toBeDisabled(); await page.keyboard.press('Escape');
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]): any { if (type.includes('webgl')) return null; return original.apply(this, [type, ...args] as any); }; });
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'error'); await expect(page.locator('#guide-play')).toBeDisabled(); const event = page.waitForEvent('download'); await page.locator('#guide-json').click(); expect((await event).suggestedFilename()).toMatch(/guide.json$/); await page.locator('#guide-save').click(); await expect(page.locator('#guide-save-state')).toHaveText('已保存到本地');
});

test('作品展示把当前房间和作品传入导览，独立保存不覆盖原工程', async ({ page }) => {
  await page.goto('./?workspace=portfolio'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const original = await page.evaluate(() => (window as any).__portfolio.getProject());
  await page.getByRole('button', { name: '角色导览 · 试验' }).click(); await expect(page).toHaveURL(/workspace=guide&snapshot=/); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const transferred = await project(page); expect(transferred.project.scene).toEqual({ ...original.scene, selectedId: null });
  const key = await page.evaluate(() => 'ideal-study.guide.v1:' + new URLSearchParams(location.search).get('snapshot'));
  await page.locator('#guide-color').selectOption('blue'); await page.locator('#guide-save').click(); const saved = await project(page); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); expect(await project(page)).toEqual(saved);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).guide.color, key)).toBe('blue'); expect(await page.evaluate(() => localStorage.getItem('ideal-study.film.v4'))).toBeNull();
});

test('青年骨骼、姿态重复采样、近景、旧角色迁移及模型加载失败保护', async ({ page }) => {
  await ready(page);
  const avatar = () => page.evaluate(() => (window as any).__guide.avatar());
  expect((await avatar()).bones).toBeGreaterThanOrEqual(67);
  expect((await avatar()).skinnedMeshes).toBeGreaterThan(5);
  expect((await avatar()).clips.sort()).toEqual(['Idle_Loop', 'Run_Loop', 'Sitting_Enter', 'Sitting_Exit', 'Sitting_Idle_Loop', 'Walk_Loop']);
  await scrub(page, 5.5); const pose = await avatar();
  await scrub(page, 13); await scrub(page, 5.5); expect(await avatar()).toEqual(pose);
  await scrub(page, 3);
  for (let i = 0; i < 3; i++) await page.locator('#guide-scrub').press('ArrowRight');
  expect((await avatar()).blinkMeshes).toBe(0); // Author asset has a painted face; no fabricated facial rig.
  await scrub(page, 5.5);
  await page.locator('[data-stop="2"]').click(); await page.locator('#guide-remove-sit').click(); await scrub(page, 5.5);
  const before = await project(page), camera = await page.evaluate(() => (window as any).__guide.camera());
  await page.locator('#guide-character-close').click(); expect(await page.evaluate(() => (window as any).__guide.camera())).not.toEqual(camera);
  await capture(page, '10-adult-character-close.png');
  await page.locator('#guide-camera').click(); expect(await page.evaluate(() => (window as any).__guide.camera())).toEqual(camera); expect(await project(page)).toEqual(before);
  const legacy = structuredClone(before); legacy.guide.version = 1; delete legacy.guide.avatar;
  await page.locator('#guide-file').setInputFiles({ name: 'guide-v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect.poll(async () => (await avatar()).asset).toBe('creator-18-v1');
  const migrated = await project(page); expect(migrated).toEqual({ ...before, guide: { ...before.guide, avatar: 'creator-18-v1' } }); expect(migrated.guide.version).toBe(5);
  await page.locator('#guide-avatar').selectOption('naruto-author-01-v1');
  await expect.poll(async () => (await avatar()).asset).toBe('naruto-author-01-v1');
  expect(await project(page)).toEqual(before);
  const invalid = structuredClone(before); invalid.guide.avatar = 'unknown-avatar';
  await page.locator('#guide-file').setInputFiles({ name: 'unknown-avatar.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) }); await expect(page.locator('#guide-message')).toContainText('导入失败'); expect(await project(page)).toEqual(before);
  await page.locator('#guide-save').click();
  await page.route('**/*naruto-author-01*.glb*', route => route.abort()); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'error'); await expect(page.locator('#guide-play')).toBeDisabled(); await expect(page.locator('#guide-export')).toBeDisabled();
  expect(await project(page)).toEqual(before); const downloaded = page.waitForEvent('download'); await page.locator('#guide-json').click(); expect((await downloaded).suggestedFilename()).toMatch(/guide.json$/);
  await writeFile(path.join(evidence, 'adult-avatar.json'), JSON.stringify({ asset: pose.asset, bones: pose.bones, skinnedMeshes: pose.skinnedMeshes, clips: pose.clips, blinkMeshes: pose.blinkMeshes, samePoseOnRepeatSeek: true, nearCameraDoesNotChangeProject: true, v1MigrationPreservesRoomAndSettings: true, unknownAssetRejected: true, missingAssetPreservesJson: true }, null, 2));
});

test('个人 IP 切换事务、v2 外观保留、撤销重做与旧角色网站资源', async ({ page, browser }) => {
  await ready(page);
  const avatar = () => page.evaluate(() => (window as any).__guide.avatar().asset);
  const original = await project(page), legacy = structuredClone(original);
  legacy.guide.stops = legacy.guide.stops.filter((s: any) => s.action !== 'sit'); legacy.guide.version = 2; legacy.guide.avatar = 'creator-18-v1'; legacy.guide.name = '旧工程角色';
  await page.locator('#guide-file').setInputFiles({ name: 'guide-v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect.poll(avatar).toBe('creator-18-v1');
  expect(await project(page)).toEqual({ ...legacy, guide: { ...legacy.guide, version: 5 } });
  await page.locator('#guide-avatar').selectOption('personal-creator-01-v1');
  await expect.poll(avatar).toBe('personal-creator-01-v1');
  const upgraded = await project(page); expect(upgraded.project).toEqual(original.project);
  await page.locator('#guide-undo').click(); await expect.poll(avatar).toBe('creator-18-v1');
  await page.locator('#guide-redo').click(); await expect.poll(avatar).toBe('personal-creator-01-v1');
  expect(await project(page)).toEqual(upgraded);
  // An unavailable replacement must not change data, history or the loaded actor.
  await page.route('**/*creator-18*.glb*', route => route.abort());
  const before = await project(page), history = await state(page);
  await page.locator('#guide-avatar').selectOption('creator-18-v1');
  await expect(page.locator('#guide-message')).toContainText('角色切换失败');
  expect(await project(page)).toEqual(before); expect(await state(page)).toEqual(history);
  expect(await avatar()).toBe('personal-creator-01-v1'); await expect(page.locator('#guide-play')).toBeEnabled();
  await expect(page.locator('#guide-avatar')).toHaveValue('personal-creator-01-v1');
  await page.unroute('**/*creator-18*.glb*');
  await page.locator('#guide-avatar').selectOption('creator-18-v1'); await expect.poll(avatar).toBe('creator-18-v1');
  await page.locator('#guide-save').click(); const saved = await project(page);
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); expect(await project(page)).toEqual(saved); expect(await avatar()).toBe('creator-18-v1');
  const event = page.waitForEvent('download'); await page.locator('#guide-publish').click(); const download = await event;
  const file = path.join(evidence, 'legacy-avatar.website.zip'); await download.saveAs(file);
  const files = unzipSync(new Uint8Array(await readFile(file)));
  expect(files['assets/creator-18.glb']).toEqual(new Uint8Array(await readFile('src/assets/guide/creator-18.glb')));
  expect(files['assets/personal-creator-01.glb']).toBeUndefined();
  expect(files['assets/personal-creator-02.glb']).toBeUndefined();
  const server = createServer((req, res) => { const name = (req.url ?? '').replace(/^\/legacy\//, '') || 'index.html'; if (!files[name]) { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.json') ? 'application/json' : name.endsWith('.html') ? 'text/html' : 'application/octet-stream'); res.end(files[name]); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const visitor = await browser.newPage();
  try { await visitor.goto(`http://127.0.0.1:${(server.address() as any).port}/legacy/`); await expect(visitor.locator('html')).toHaveAttribute('data-ready', 'true'); expect(await visitor.evaluate(() => (window as any).__guide.avatar().asset)).toBe('creator-18-v1'); }
  finally { await visitor.close(); await new Promise<void>(r => server.close(() => r())); }
});

test('首次角色加载期间锁定选择，避免显示资源与工程身份不一致', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*naruto-author-01*.glb*', async route => { await gate; await route.continue(); });
  try {
    await page.goto('./?workspace=guide', { waitUntil: 'commit' });
    await expect(page.locator('#guide-avatar')).toBeDisabled();
    await expect(page.locator('#guide-play')).toBeDisabled();
  } finally { release(); }
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#guide-avatar')).toBeEnabled();
  expect((await project(page)).guide.avatar).toBe(await page.evaluate(() => (window as any).__guide.avatar().asset));
});

test('设定 01 存档保持原貌，切换设定 02 后撤销、保存与刷新一致', async ({ page }) => {
  await ready(page);
  const old = await project(page); old.guide.avatar = 'personal-creator-01-v1'; old.guide.name = '保留的个人 IP';
  await page.locator('#guide-file').setInputFiles({ name: 'edition-01-v4.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await expect(page.locator('#guide-avatar')).toHaveValue('personal-creator-01-v1');
  expect(await project(page)).toEqual(old);
  await page.locator('#guide-save').click(); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  expect(await project(page)).toEqual(old);
  await page.locator('#guide-avatar').selectOption('personal-creator-02-v1');
  await expect.poll(() => page.evaluate(() => (window as any).__guide.avatar().asset)).toBe('personal-creator-02-v1');
  const revised = await project(page); expect(revised).toEqual({ ...old, guide: { ...old.guide, avatar: 'personal-creator-02-v1' } });
  await page.locator('#guide-undo').click(); await expect(page.locator('#guide-avatar')).toHaveValue('personal-creator-01-v1'); expect(await project(page)).toEqual(old);
  await page.locator('#guide-redo').click(); await expect(page.locator('#guide-avatar')).toHaveValue('personal-creator-02-v1');
  await page.locator('#guide-save').click(); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); expect(await project(page)).toEqual(revised);
  await writeFile(path.join(evidence, 'edition-02-compatibility.json'), JSON.stringify({ oldV4PreservedExactly: true, originalAppearanceKeptOnReload: true, onlyAvatarChanged: true, undoRedoExact: true, savedRestoredExact: true }, null, 2));
});
