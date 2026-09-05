import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidence = path.resolve(process.env.GUIDE_EVIDENCE_DIR ?? 'test-results/guide-motion');
const get = (page: import('@playwright/test').Page) => page.evaluate(() => ({ project: (window as any).__guide.project(), route: (window as any).__guide.route(), avatar: (window as any).__guide.avatar() }));
test('坐下站起：真实椅面、脚底接触、迁移、段落操作与失败保护', async ({ page }) => {
  test.setTimeout(180000); await mkdir(evidence, { recursive: true }); page.on('dialog', d => d.accept());
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./?workspace=guide'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const initial = await get(page); expect(initial.route.error).toBe(''); expect(initial.project.guide.version).toBe(4);
  await page.locator('[data-stop="2"]').click(); await expect(page.locator('#guide-seat')).toHaveValue('chair-1');
  await page.locator('#guide-duration').selectOption('10'); await page.locator('#guide-undo').click(); await expect(page.locator('#guide-duration')).toHaveValue('12'); await page.locator('#guide-redo').click(); await expect(page.locator('#guide-duration')).toHaveValue('10');
  const frames: any[] = [];
  for (const phase of ['enter', 'hold', 'exit']) {
    await page.locator(`[data-seat-phase="${phase}"]`).click(); await page.waitForTimeout(160);
    const data = await get(page); frames.push({ phase, time: data.project.playhead, world: data.avatar.world });
    await page.screenshot({ path: path.join(evidence, `motion-${phase}-1440x900.png`) });
    const pose = data.avatar.pose;
    await page.locator('#guide-scrub').fill('0'); await page.locator('[data-stop="2"]').click(); await page.locator(`[data-seat-phase="${phase}"]`).click();
    expect((await get(page)).avatar.pose).toEqual(pose);
  }
  const seated = frames.find(f => f.phase === 'hold').world;
  // Cushion is at y=.537 including the rug. The pelvis sits above it; both feet remain at floor height.
  expect(seated.pelvis[1]).toBeGreaterThan(.59); expect(seated.pelvis[1]).toBeLessThan(.66);
  expect(Math.hypot(seated.pelvis[0] - .58, seated.pelvis[2] + .02)).toBeLessThan(.04);
  expect(Math.abs(seated.foot_l[1] - seated.foot_r[1])).toBeLessThan(.004);
  expect(seated.foot_l[1]).toBeLessThan(.14);
  await page.locator('#guide-scrub').fill('26'); const stood = await get(page); expect(stood.avatar.world.pelvis[1] - seated.pelvis[1]).toBeGreaterThan(.25);
  // Steady sitting: no accumulated foot drift, irrespective of sample order.
  for (const t of [21, 20.7, 22.5]) { await page.locator('#guide-scrub').fill(String(t)); const a = (await get(page)).avatar.world; expect(Math.hypot(...a.foot_l.map((v: number, i: number) => v - seated.foot_l[i]))).toBeLessThan(.004); }
  await page.setViewportSize({ width: 1280, height: 800 }); await page.locator('[data-seat-phase="hold"]').click(); await page.locator('#guide-character-close').click(); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(evidence, 'motion-seated-close-1280x800.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#guide-save').click(); const saved = (await get(page)).project; await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true'); expect((await get(page)).project).toEqual(saved);
  // Previously saved v3 files keep their appearance and two-stop timeline, with an explicit add action.
  const old = structuredClone(saved); old.guide.version = 3; old.guide.stops.pop(); old.playhead = 0; old.selected = 0;
  await page.locator('#guide-file').setInputFiles({ name: 'legacy-v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await expect(page.locator('#guide-add-sit')).toBeVisible(); expect((await get(page)).project.guide.stops).toEqual(old.guide.stops);
  await page.locator('#guide-add-sit').click(); expect((await get(page)).project.guide.stops.at(-1).action).toBe('sit');
  await page.locator('#guide-order').click(); expect((await get(page)).project.guide.stops[0].action).toBe('sit'); await page.locator('#guide-order').click();
  // A rotated/moved chair is actually used; the room itself is never silently rearranged.
  const moved = (await get(page)).project; const chair = moved.project.scene.objects.find((o: any) => o.id === 'chair-1'); chair.x = .9; chair.z = .75; chair.rotation = 70;
  await page.locator('#guide-file').setInputFiles({ name: 'moved-chair.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(moved)) }); expect((await get(page)).route.error).toBe('');
  await page.locator('[data-stop="2"]').click(); await page.locator('[data-seat-phase="hold"]').click(); const aligned = await get(page);
  expect(Math.hypot(aligned.avatar.world.pelvis[0] - chair.x, aligned.avatar.world.pelvis[2] - chair.z)).toBeLessThan(.04);
  expect(aligned.project.project.scene.objects).toEqual(moved.project.scene.objects);
  await page.waitForTimeout(150); await page.screenshot({ path: path.join(evidence, 'motion-rotated-chair-1280x800.png') });
  const blocked = structuredClone(moved); const blockedChair = blocked.project.scene.objects.find((o: any) => o.id === 'chair-1'); blockedChair.x = .65; blockedChair.z = -1.12;
  await page.locator('#guide-file').setInputFiles({ name: 'blocked-chair.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(blocked)) });
  await expect(page.locator('#guide-play')).toBeDisabled(); await expect(page.locator('#guide-export')).toBeDisabled(); expect((await get(page)).route.error).toContain('椅子');
  const before = (await get(page)).project; const invalid = structuredClone(before); invalid.guide.stops.at(-1).itemId = 'desk-1';
  await page.locator('#guide-file').setInputFiles({ name: 'not-chair.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) }); await expect(page.locator('#guide-message')).toContainText('导入失败'); expect((await get(page)).project).toEqual(before);
  await page.route('**/*guide-motion-v1*.glb*', r => r.abort()); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'error'); await expect(page.locator('#guide-play')).toBeDisabled();
  expect(errors).toEqual([]); await writeFile(path.join(evidence, 'motion-checks.json'), JSON.stringify({ frames, alignedPelvis: aligned.avatar.world.pelvis, chair, savedRestoredExact: true, v3RetainsStops: true, blockedSeatDisabled: true, missingMotionFailsHonestly: true, errors }, null, 2));
});
