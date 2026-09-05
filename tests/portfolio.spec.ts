import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidence=path.resolve('test-results/portfolio-evidence');
const plan=(p:Page)=>p.evaluate(()=>(window as any).__study.getPlan());
async function ready(p:Page,route='room'){await p.goto(`./?workspace=${route}`);await expect(p.locator('html')).toHaveAttribute('data-ready','true');}
async function number(p:Page,name:string,value:string){const el=p.getByRole('spinbutton',{name,exact:true});await el.fill(value);await el.press('Tab');}
async function capture(p:Page,name:string){await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await p.screenshot({path:path.join(evidence,name)});}
async function configure(p:Page,id:string,title:string,cover=false){
  await p.locator('#object-picker').selectOption(id);await p.locator('#configure-work').click();
  await p.getByLabel('项目名称',{exact:true}).fill(title);await p.getByLabel('项目简介',{exact:true}).fill('在空间里组织灵感，把想法做成可以使用的作品。点击下方按钮查看完整项目。');
  await p.getByLabel('技术栈 / 标签').fill('Three.js / TypeScript / 交互设计');await p.getByLabel('项目链接',{exact:true}).fill('https://github.com/yydshly/0905_codexgpt6_project');
  if(cover){await p.locator('#work-cover').setInputFiles('docs/reuse-evidence/test-photo.png');await expect(p.locator('.config-cover img')).toBeVisible();await expect(p.locator('#apply-work')).toBeEnabled();}
  await p.locator('#apply-work').click();await expect(p.locator('.portfolio-config')).toHaveCount(0);
}
test.beforeAll(async()=>{await mkdir(evidence,{recursive:true});});
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());});

test('作品闭环：配置、模型点击、移动材质历史、恢复、JSON、GLB 与宿主接入',async({page,browser})=>{
  test.setTimeout(process.env.CI?600000:180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page);expect((await plan(page)).portfolio.bindings).toHaveLength(0);
  await configure(page,'desk-1','空间手记 · 我的创作',true);await configure(page,'monitor-1','理想书房 · 交互项目');
  const bindings=(await plan(page)).portfolio;
  await page.locator('#object-picker').selectOption('desk-1');await page.locator('#configure-work').click();await capture(page,'01-author-1440x900.png');await page.keyboard.press('Escape');await expect(page.locator('#configure-work')).toBeFocused();
  await number(page,'X 位置','0.8');await page.locator('#rotate-right').click();await page.locator('[data-material="walnut"]').click();
  await page.getByRole('button',{name:'深夜',exact:false}).click();await page.locator('#undo').click();await page.locator('#redo').click();expect((await plan(page)).portfolio).toEqual(bindings);
  const withDesk=await plan(page);await page.locator('#delete-item').click();expect((await plan(page)).portfolio.bindings).toHaveLength(0);await page.locator('#undo').click();expect((await plan(page)).portfolio).toEqual(bindings);expect((await plan(page)).objects).toEqual(withDesk.objects);
  await page.locator('#save').click();const saved=await plan(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await plan(page)).toEqual(saved);
  await page.locator('#export').click();let download=page.waitForEvent('download');await page.locator('#export-json').click();const jsonPath=path.join(evidence,'portfolio-room.json');await(await download).saveAs(jsonPath);
  download=page.waitForEvent('download');await page.locator('#export-glb').click();const glbPath=path.join(evidence,'portfolio-room.glb');await(await download).saveAs(glbPath);
  const bytes=await readFile(glbPath),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());expect(gltf.nodes.filter((n:any)=>n.extras?.partId).map((n:any)=>n.extras.partId)).toEqual(expect.arrayContaining(['book-1','screen']));
  const invalid=structuredClone(saved);invalid.portfolio.bindings[0].target.itemId='missing';await page.locator('#file-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await expect(page.locator('#toast')).toHaveClass(/error/);expect(await plan(page)).toEqual(saved);
  await page.locator('#file-input').setInputFiles(jsonPath);await expect(page.locator('#export-dialog')).not.toBeVisible();expect(await plan(page)).toEqual(saved);
  await page.locator('#workspace-portfolio').click();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await expect(page.locator('#work-list .work-card')).toHaveCount(2);
  expect((await page.evaluate(()=>(window as any).__portfolio.getProject())).scene.portfolio).toEqual(bindings);
  await page.getByRole('button',{name:'白昼氛围'}).click();await capture(page,'02-portfolio-1440x900.png');
  // Hide only DOM signs through a real product control, then click the actual 3D surface.
  const rect=await page.locator('[data-target="desk-1/book-1"]').boundingBox();expect(rect).not.toBeNull();const point={x:rect!.x+rect!.width/2,y:rect!.y+rect!.height/2};await page.locator('#portfolio-markers').click();await page.mouse.click(point.x,point.y);
  await expect(page.locator('#work-title')).toHaveText('空间手记 · 我的创作');await expect(page.locator('.work-art img')).toBeVisible();await capture(page,'03-project-detail-1280x800.png');
  const popupPromise=page.waitForEvent('popup');await page.locator('.work-visit').click();const popup=await popupPromise;await popup.waitForURL('https://github.com/yydshly/0905_codexgpt6_project');await popup.close();await page.keyboard.press('Escape');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+90,point.y+25,{steps:8});await page.mouse.up();await expect(page.locator('.work-dialog')).not.toBeVisible();
  await page.locator('#portfolio-reset').click();await page.locator('#portfolio-markers').click();
  // Locate before playback: on software rendering the second locator action can take
  // longer than the entire film, then legitimately click "play" after it has ended.
  const playButton=await page.locator('#portfolio-play').boundingBox();expect(playButton).not.toBeNull();
  await page.mouse.move(playButton!.x+playButton!.width/2,playButton!.y+playButton!.height/2);
  await page.mouse.click(playButton!.x+playButton!.width/2,playButton!.y+playButton!.height/2);
  await expect(page.locator('.study-hotspots')).toBeHidden();
  await page.mouse.click(playButton!.x+playButton!.width/2,playButton!.y+playButton!.height/2);
  const paused=await page.evaluate(()=>(window as any).__portfolio.state());expect(paused.playing).toBe(false);expect(paused.time).toBeLessThan(paused.duration);
  await expect(page.locator('.study-hotspots')).toBeVisible();await page.waitForTimeout(180);
  expect(await page.evaluate(()=>(window as any).__portfolio.state())).toEqual(paused);
  await page.setViewportSize({width:1280,height:800});await page.locator('#portfolio-reset').click();await page.locator('[data-work]').first().click();await capture(page,'03-project-detail-1280x800.png');await page.keyboard.press('Escape');
  for(const size of [{width:1440,height:900},{width:1280,height:800}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#portfolio-json')).toBeInViewport();await expect(page.locator('#portfolio-play')).toBeInViewport();}
  const viewer=await browser.newPage({baseURL:new URL('.',page.url()).href,viewport:{width:1280,height:800}});await ready(viewer,'viewer');await viewer.locator('#glb-file').setInputFiles(glbPath);await expect(viewer.locator('html')).toHaveAttribute('data-loaded','true');await viewer.locator('#glb-project').setInputFiles(jsonPath);await expect(viewer.locator('#glb-work-status')).toContainText('已关联 2');await viewer.locator('[data-target="monitor-1/screen"]').click();await expect(viewer.locator('#work-title')).toHaveText('理想书房 · 交互项目');await viewer.keyboard.press('Escape');const glbInfo=await viewer.evaluate(()=>(window as any).__glb);await capture(viewer,'04-independent-glb-1280x800.png');await viewer.close();
  await ready(page,'integration');await page.locator('#host-project').setInputFiles(jsonPath);const frame=page.frameLocator('#study-frame');await expect(frame.locator('.study-hotspot')).toHaveCount(2);await frame.locator('[data-target="monitor-1/screen"]').click();await expect(page.locator('#work-title')).toHaveText('理想书房 · 交互项目');await expect(page.locator('#host-status')).toContainText('宿主收到作品点击');await page.keyboard.press('Escape');
  expect(errors).toEqual([]);await writeFile(path.join(evidence,'journey.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),savedRestoreExact:true,jsonRoundTripExact:true,materialAndMoveRetainedBindings:true,deleteUndoExact:true,actualMeshClicked:true,dragDidNotActivate:true,externalLinkOpened:true,independentGLBClicked:true,iframeParentReceived:true,glbBytes:bytes.length,glbInfo,errors},null,2));
});

test('作品错误、取消关联与历史、旧版房间和短片迁移',async({page})=>{
  await ready(page);await configure(page,'desk-1','可恢复的关联');const before=await plan(page);
  await page.locator('#configure-work').click();await page.locator('#work-url').fill('javascript:alert(1)');await page.locator('#apply-work').click();await expect(page.locator('.config-error')).toContainText('HTTP(S)');expect(await plan(page)).toEqual(before);
  await page.locator('#work-cover').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await expect(page.locator('.config-error')).toContainText('无法解码');await page.keyboard.press('Escape');expect(await plan(page)).toEqual(before);
  await page.locator('#configure-work').click();await page.locator('#unlink-work').click();expect((await plan(page)).portfolio.bindings).toHaveLength(0);expect((await plan(page)).portfolio.projects).toEqual(before.portfolio.projects);await page.locator('#undo').click();expect((await plan(page)).portfolio).toEqual(before.portfolio);await page.locator('#redo').click();expect((await plan(page)).portfolio.bindings).toHaveLength(0);
  const invalids=[{...before,portfolio:{...before.portfolio,version:99}},{...before,portfolio:{...before.portfolio,bindings:[...before.portfolio.bindings,...before.portfolio.bindings]}},{...before,portfolio:{...before.portfolio,projects:before.portfolio.projects.map((w:any)=>({...w,cover:'data:image/jpeg;base64,bm90anBlZw=='}))}}];
  const current=await plan(page);for(const p of invalids){await page.locator('#file-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.locator('#toast')).toHaveClass(/error/);expect(await plan(page)).toEqual(current);}
  const excessive=structuredClone(before),photo='data:image/jpeg;base64,'+'A'.repeat(399976),art=excessive.objects.find((o:any)=>o.kind==='wallPhoto');
  excessive.portfolio.projects=Array.from({length:12},(_,i)=>({...before.portfolio.projects[0],id:i?'extra-'+i:before.portfolio.projects[0].id,cover:photo}));art.photo=photo;excessive.objects.push({...art,id:'extra-art-1'},{...art,id:'extra-art-2'});
  await page.locator('#file-input').setInputFiles({name:'too-many-covers.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(excessive))});await expect(page.locator('#toast')).toContainText('合计超过 5 MB');expect(await plan(page)).toEqual(current);
  await page.locator('#file-input').setInputFiles('docs/reuse-evidence/reusable-room.json');await expect(page.locator('#toast')).toContainText('已导入');const migrated=await plan(page);expect(migrated.version).toBe(3);expect(migrated.portfolio).toEqual({version:1,projects:[],bindings:[]});
  await page.locator('#workspace-film').click();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('#film-file').setInputFiles('docs/reuse-evidence/reusable-film.json');await expect(page.locator('#film-toast')).toContainText('迁移');const film=await page.evaluate(()=>(window as any).__film.getProject());expect(film.version).toBe(4);expect(film.scene.portfolio.bindings).toHaveLength(0);await page.locator('#film-save').click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await page.evaluate(()=>(window as any).__film.getProject())).toEqual(film);
});

test('展示页窄屏、键盘焦点、夜间、无 WebGL 降级与空状态',async({page,browser})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page,'portfolio');expect((await page.evaluate(()=>(window as any).__portfolio.state())).playing).toBe(false);
  const button=page.locator('[data-work]').first();await button.focus();await page.keyboard.press('Enter');await expect(page.locator('.work-close')).toBeFocused();await page.keyboard.press('Escape');await expect(button).toBeFocused();await expect(button).toHaveCSS('outline-style','solid');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'深夜氛围'}).click();await expect(page.locator('#portfolio-play')).toBeInViewport();await button.click();await capture(page,'05-mobile-detail-390x844.png');await expect(page.locator('.work-visit')).toBeInViewport();await page.keyboard.press('Escape');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const fallback=await browser.newPage({baseURL:new URL('.',page.url()).href});await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type:string,...args:any[]){return type.startsWith('webgl')?null:original.call(this,type as any,...args);} as any;});await ready(fallback,'portfolio');await expect(fallback.locator('#portfolio-status')).toContainText('3D 暂不可用');await fallback.locator('[data-work]').first().click();await expect(fallback.locator('.work-visit')).toBeVisible();await fallback.close();
  await ready(page,'portfolio&project=room');await expect(page.locator('.portfolio-empty')).toBeVisible();await expect(page.locator('.study-hotspot')).toHaveCount(0);
  await writeFile(path.join(evidence,'states.json'),JSON.stringify({timestamp:new Date().toISOString(),narrow:'390x844',reducedMotion:true,keyboardAndFocusReturn:true,night:true,webglFallbackUsable:true,emptyState:true},null,2));
});

test('展示性能、可见性遮挡与原始模型导出的部位标识',async({page,browser})=>{
  const start=Date.now();await ready(page,'portfolio');const loadMs=Date.now()-start;
  await expect(page.locator('[data-target="desk-1/book-1"]')).toBeVisible();
  const frames=await page.evaluate(()=>new Promise<number[]>(r=>{const values:number[]=[];let previous=performance.now(),start=previous;function tick(now:number){values.push(now-previous);previous=now;if(now-start<1000)requestAnimationFrame(tick);else r(values);}requestAnimationFrame(tick);}));
  const before=await page.evaluate(()=>(window as any).__portfolio.metrics());await page.waitForTimeout(500);const after=await page.evaluate(()=>(window as any).__portfolio.metrics());expect(after.renders-before.renders).toBeLessThanOrEqual(1);
  // Rotate towards the rear of the monitor. The screen is now hidden by its own casing.
  const canvas=await page.locator('#portfolio-stage canvas').boundingBox();await page.mouse.move(canvas!.x+canvas!.width*.75,canvas!.y+canvas!.height*.7);await page.mouse.down();await page.mouse.move(canvas!.x+canvas!.width*.25,canvas!.y+canvas!.height*.7,{steps:12});await page.mouse.up();
  const hidden=await page.locator('[data-target="monitor-1/screen"]').isHidden();expect(hidden).toBe(true);await page.locator('#portfolio-reset').click();await expect(page.locator('[data-target="monitor-1/screen"]')).toBeVisible();
  const sorted=frames.slice().sort((a,b)=>a-b);await writeFile(path.join(evidence,'performance.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),viewport:page.viewportSize(),loadMs,rafMean:frames.reduce((a,b)=>a+b,0)/frames.length,rafP95:sorted[Math.floor(sorted.length*.95)],idleRenders:after.renders-before.renders,metrics:after,occludedScreenHidden:hidden},null,2));
});

test('上一版 v2 房间和 v3 短片本地存档升级，保留原始字节',async({page})=>{
  const room=JSON.parse(await readFile('docs/reuse-evidence/reusable-room.json','utf8')),film=JSON.parse(await readFile('docs/reuse-evidence/reusable-film.json','utf8'));
  await page.addInitScript(({room,film})=>{if(!localStorage.getItem('ideal-study.plan.v2'))localStorage.setItem('ideal-study.plan.v2',JSON.stringify({plan:room,savedAt:'legacy-room'}));if(!localStorage.getItem('ideal-study.film.v3'))localStorage.setItem('ideal-study.film.v3',JSON.stringify({project:film,savedAt:'legacy-film'}));},{room,film});
  await ready(page);const old=await page.evaluate(()=>[localStorage.getItem('ideal-study.plan.v2'),localStorage.getItem('ideal-study.film.v3')]);expect((await plan(page)).objects).toEqual(room.objects);expect((await plan(page)).portfolio.bindings).toHaveLength(0);
  await page.locator('#save').click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect((await plan(page)).objects).toEqual(room.objects);
  await ready(page,'film');const p=await page.evaluate(()=>(window as any).__film.getProject());expect(p.version).toBe(4);expect(p.film).toEqual(film.film);expect(p.scene.objects).toEqual(film.scene.objects);await page.locator('#film-save').click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await page.evaluate(()=>(window as any).__film.getProject())).toEqual(p);
  expect(await page.evaluate(()=>[localStorage.getItem('ideal-study.plan.v2'),localStorage.getItem('ideal-study.film.v3')])).toEqual(old);
});
