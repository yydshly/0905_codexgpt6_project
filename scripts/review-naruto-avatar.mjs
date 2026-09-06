/** Actual Three.js character, same loader/pose code as the guide. No image compositing.
 * npm run dev, then node scripts/review-naruto-avatar.mjs
 * Uses a fresh isolated Chrome context and does not touch the user's saved projects. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const destination = process.env.GUIDE_EVIDENCE_DIR ?? 'docs/naruto-guide-evidence';
const base = process.env.GUIDE_BASE_URL ?? 'http://127.0.0.1:5173/';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.route('**/avatar-inspection', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto(new URL('avatar-inspection', base).href);
  await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { createGuideCharacter } = await import('/src/adult-character.ts');
    const { createGuideProject, compileGuide, sampleGuide } = await import('/src/guide-model.ts');
    document.body.style.margin = '0';
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1000, 1000); renderer.setPixelRatio(1); renderer.setClearColor('#eee8da');
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);
    const scene = new T.Scene(); scene.add(new T.HemisphereLight('#fff2db', '#858879', 2));
    const key = new T.DirectionalLight('#fff6e7', 3); key.position.set(-3, 5, 6); scene.add(key);
    const fill = new T.DirectionalLight('#d3e3ff', 1); fill.position.set(3, 3, -3); scene.add(fill);
    const actors = await Promise.all(['personal-creator-02-v1', 'naruto-author-01-v1'].map(createGuideCharacter));
    const project = createGuideProject(), sample = sampleGuide(project, compileGuide(project), 0);
    sample.position = { x: 0, y: 0, z: 0 }; sample.yaw = 0; sample.turning = null;
    for (const actor of actors) { actor.apply(sample, 'sage'); scene.add(actor.root); }
    const camera = new T.PerspectiveCamera(32, 1, .01, 50);
    window.review = (edition = 1, angle = 0, mode = 'portrait') => {
      actors.forEach((a, i) => { a.root.visible = i === edition; });
      const portrait = mode !== 'full', distance = portrait ? 1.5 : 4.0;
      camera.position.set(Math.sin(angle) * distance, mode === 'above' ? 2.35 : portrait ? 1.75 : 1.22, Math.cos(angle) * distance);
      camera.lookAt(0, portrait ? 1.65 : .98, 0); renderer.render(scene, camera);
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    };
  });
  const shots = [
    ['character-before', 0, 0, 'portrait'], ['character-front', 1, 0, 'portrait'],
    ['character-three-quarter', 1, .70, 'portrait'], ['character-side', 1, 1.50, 'portrait'],
    ['character-back', 1, Math.PI, 'portrait'], ['character-above', 1, Math.PI, 'above'],
    ['character-full', 1, 0, 'full'],
  ];
  let metrics;
  for (const [name, edition, angle, mode] of shots) {
    metrics = await page.evaluate(args => window.review(...args), [edition, angle, mode]);
    await page.screenshot({ path: `${destination}/${name}.png` });
  }
  const result = { browser: browser.version(), viewport: [1000, 1000], source: 'actual guide character factory and absolute pose sampler', studioOnly: true, metrics, errors };
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(`${destination}/portrait-checks.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
