/** Local development inspection of actual character geometry and the guide sampler.
 * npm run dev, then node scripts/review-walk.mjs. Uses isolated Chrome storage. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = process.env.GUIDE_EVIDENCE_DIR ?? 'docs/walk-refinement-evidence';
const base = process.env.GUIDE_BASE_URL ?? 'http://127.0.0.1:5173/';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(base + '?workspace=guide'); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  for (const [width, height, t] of [[1440, 900, 1.5], [1280, 800, 2]]) {
    await page.setViewportSize({ width, height }); await page.locator('#guide-scrub').fill(String(t));
    await page.waitForTimeout(200); await page.screenshot({ path: `${out}/walk-room-${width}x${height}.png` });
    await page.locator('#guide-character-close').click();
    const box = await page.locator('#guide-canvas').boundingBox();
    await page.mouse.move(box.x + box.width * .6, box.y + box.height * .6); await page.mouse.wheel(0, 260);
    await page.waitForTimeout(200); await page.screenshot({ path: `${out}/walk-close-${width}x${height}.png` });
  }
  await page.route('**/walk-inspection', r => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0"></body>' }));
  await page.goto(new URL('walk-inspection', base).href); await page.setViewportSize({ width: 960, height: 900 });
  const measurement = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { createGuideCharacter } = await import('/src/adult-character.ts');
    const { createGuideProject, compileGuide, sampleGuide } = await import('/src/guide-model.ts');
    const project = createGuideProject(), route = compileGuide(project), actor = await createGuideCharacter(project.guide.avatar);
    const probes = [];
    actor.root.updateMatrixWorld(true);
    actor.root.traverse(mesh => {
      if (!mesh.isSkinnedMesh || !mesh.name.startsWith('Sole_')) return;
      mesh.skeleton.update(); const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(positions, i); mesh.applyBoneTransform(i, v); mesh.localToWorld(v);
        if (v.y < .075) probes.push({ mesh, i, side: v.x > 0 ? 0 : 1 });
      }
    });
    const frames = [];
    let soleMin = Infinity, soleMax = -Infinity;
    for (let i = 0; i <= 1680; i++) {
      const sample = sampleGuide(project, route, i / 60); actor.apply(sample, 'sage'); const m = actor.metrics();
      if (sample.walkFeet) {
        const lows = [Infinity, Infinity];
        for (const mesh of new Set(probes.map(p => p.mesh))) mesh.skeleton.update();
        for (const { mesh, i, side } of probes) {
          const v = new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i); mesh.applyBoneTransform(i, v); mesh.localToWorld(v); lows[side] = Math.min(lows[side], v.y);
        }
        for (const side of [0, 1]) if (sample.walkFeet[side].planted) { const gap = lows[side] - sample.walkFeet[side].ground; soleMin = Math.min(soleMin, gap); soleMax = Math.max(soleMax, gap); }
      }
      frames.push({ t: sample.time, index: sample.index, phase: sample.phase, feet: sample.walkFeet, ankles: [m.world.foot_l, m.world.foot_r], pelvis: m.world.pelvis, head: m.world.Head, correction: m.footCorrection });
    }
    let plantDrift = 0, plants = 0, maxStep = 0, at = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      for (const side of [0, 1]) {
        const p = a.feet?.[side], q = b.feet?.[side];
        if (a.index === b.index && p?.planted && q?.planted && Math.hypot(p.x - q.x, p.z - q.z) < 1e-6) {
          plantDrift = Math.max(plantDrift, new T.Vector3(...a.ankles[side]).distanceTo(new T.Vector3(...b.ankles[side]))); plants++;
        }
        const delta = new T.Vector3(...a.ankles[side]).distanceTo(new T.Vector3(...b.ankles[side]));
        if (delta > maxStep) { maxStep = delta; at = b.t; }
      }
    }
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(960, 900); renderer.setClearColor('#e9e5db'); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; document.body.append(renderer.domElement);
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff2db', '#858879', 2));
    const light = new T.DirectionalLight('#fff6e7', 3); light.position.set(-3, 5, 6); light.castShadow = true; light.shadow.mapSize.set(2048, 2048); light.shadow.camera.left = light.shadow.camera.bottom = -5; light.shadow.camera.right = light.shadow.camera.top = 5; scene.add(light);
    const floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshStandardMaterial({ color: '#c7c8bd', roughness: .9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const grid = new T.GridHelper(20, 80, '#aeb0a5', '#b9bbb1'); grid.position.y = .001; scene.add(grid); scene.add(actor.root);
    const camera = new T.PerspectiveCamera(32, 960 / 900, .01, 50);
    window.reviewWalk = (t, angle = 1.4) => {
      const s = sampleGuide(project, route, t); actor.apply(s, 'sage');
      floor.position.y = s.position.y; grid.position.y = s.position.y + .001;
      camera.position.set(s.position.x + Math.sin(s.yaw + angle) * 3.9, 1.22, s.position.z + Math.cos(s.yaw + angle) * 3.9);
      camera.lookAt(s.position.x, .92, s.position.z); renderer.render(scene, camera);
    };
    return { samples: frames.length, plantedPairs: plants, maxPlantedAnkleDriftMeters: plantDrift, plantedSoleMinimumGapMeters: soleMin, plantedSoleMaximumGapMeters: soleMax, maxAnkleStepAt60HzMeters: maxStep, maxStepTime: at, route, frames };
  });
  for (const [name, t, angle] of [['start', .5, .7], ['swing', 1.05, 1.4], ['plant', 1.5, 1.4], ['stop', 3.057751, 1.4], ['turn', 3.4, .7], ['front', 2, 0], ['back', 2, 3.14]]) {
    await page.evaluate(args => window.reviewWalk(...args), [t, angle]); await page.screenshot({ path: `${out}/walk-studio-${name}.png` });
  }
  const { frames, ...summary } = measurement;
  const rows = frames.map(f => [f.t, f.index, f.phase, ...f.ankles.flat(), ...f.pelvis, f.correction, ...[0, 1].flatMap(i => f.feet ? [f.feet[i].planted, f.feet[i].x, f.feet[i].z, f.feet[i].ground, f.feet[i].lift] : ['', '', '', '', ''])].join(','));
  await writeFile(`${out}/gait-frames.csv`, ['time,index,phase,leftX,leftY,leftZ,rightX,rightY,rightZ,pelvisX,pelvisY,pelvisZ,rootCorrection,leftPlanted,leftAnchorX,leftAnchorZ,leftGround,leftLift,rightPlanted,rightAnchorX,rightAnchorZ,rightGround,rightLift', ...rows].join('\n'));
  await writeFile(`${out}/gait-measurements.json`, JSON.stringify({ browser: browser.version(), ...summary, frameData: 'gait-frames.csv' }, null, 2));
  console.log(JSON.stringify({ ...measurement, frames: undefined, route: undefined }));
} finally { await browser.close(); }
