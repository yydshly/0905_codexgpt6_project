import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('自然步行：连续采样、实际支撑脚锁定、任意跳转与暂停保存恢复', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('./?workspace=guide'); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const state = () => page.evaluate(() => { const g = (window as any).__guide, project = g.project(); return { project, sample: g.sample(project.playhead), avatar: g.avatar() }; });
  const continuous = await page.evaluate(() => [1, 1 + 1 / 60, 1 + 1 / 30].map(t => (window as any).__guide.sample(t)));
  expect(new Set(continuous.map(s => s.time)).size).toBe(3);
  expect(new Set(continuous.map(s => s.position.z)).size).toBe(3);
  const frames: Awaited<ReturnType<typeof state>>[] = [];
  for (const [start, count] of [[1, 60], [11, 20]]) {
    await page.locator('#guide-scrub').fill(String(start)); frames.push(await state());
    for (let i = 0; i < count; i++) { await page.locator('#guide-scrub').press('ArrowRight'); frames.push(await state()); }
  }
  let plantedPairs = 0, maxDrift = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (b.sample.time - a.sample.time > .04) continue;
    for (const side of [0, 1]) {
      const p = a.sample.walkFeet?.[side], q = b.sample.walkFeet?.[side];
      if (!p?.planted || !q?.planted || Math.hypot(p.x - q.x, p.z - q.z) > 1e-6) continue;
      const name = side ? 'foot_r' : 'foot_l', x = a.avatar.world[name], y = b.avatar.world[name];
      maxDrift = Math.max(maxDrift, Math.hypot(...x.map((n: number, j: number) => n - y[j]))); plantedPairs++;
    }
  }
  expect(plantedPairs).toBeGreaterThan(40); expect(maxDrift).toBeLessThan(.001);
  await page.locator('#guide-scrub').fill('1.5'); const pose = (await state()).avatar;
  await page.locator('#guide-scrub').fill('11.5'); await page.locator('#guide-scrub').fill('1.5'); expect((await state()).avatar).toEqual(pose);
  await page.locator('#guide-play').click(); await page.waitForTimeout(417); await page.locator('#guide-play').click();
  const paused = await state(); await page.waitForTimeout(120); expect(await state()).toEqual(paused);
  await expect(page.locator('#guide-time')).toContainText(paused.sample.time.toFixed(1).padStart(4, '0'));
  await page.locator('#guide-save').click(); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
  const restored = await state(); expect(restored.project).toEqual(paused.project); expect(restored.avatar).toEqual(paused.avatar);
  const out = path.resolve(process.env.GUIDE_EVIDENCE_DIR ?? 'test-results/walk'); await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'walk-browser-checks.json'), JSON.stringify({ adjacent60HzSamplesDistinct: true, actualUIFrames: frames.length, plantedPairs, maxPlantedAnkleDriftMeters: maxDrift, repeatSeekExact: true, continuousPausedTime: paused.sample.time, pausedTimeAndPoseRestoredExactly: true }, null, 2));
});
