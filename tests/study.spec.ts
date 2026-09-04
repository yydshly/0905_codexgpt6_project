import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const evidence=path.resolve('docs/evidence');
const plan=(page:Page)=>page.evaluate(()=> (window as any).__study.getPlan());
const history=(page:Page)=>page.evaluate(()=> (window as any).__study.history());
async function ready(page:Page){await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-ready','true');await settle(page);}
async function settle(page:Page){await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));}
async function choose(page:Page,id:string){await page.keyboard.press('Escape');await page.locator(`[data-select="${id}"]`).click();}
async function changeNumber(page:Page,label:string,value:string){await page.getByRole('spinbutton',{name:label,exact:true}).fill(value);await page.getByRole('spinbutton',{name:label,exact:true}).press('Tab');}
async function shot(page:Page,file:string){await settle(page);await page.screenshot({path:path.join(evidence,file)});}
function compareCore(value:any){return {name:value.name,mood:value.mood,objects:value.objects,camera:value.camera};}
test.beforeAll(async()=>{await mkdir(evidence,{recursive:true});});
test.beforeEach(async({page})=>{page.on('dialog',dialog=>dialog.accept());});

test('完整验收：添加、拖动、旋转、灯光、材质、历史、本地恢复、PNG、JSON',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const steps:any[]=[];
  await ready(page);expect((await plan(page)).objects).toHaveLength(8);
  await shot(page,'01-default-1440x900.png');steps.push({step:'打开默认书房',objects:8});
  await page.getByRole('button',{name:'添加蘑菇台灯',exact:true}).click();
  let p=await plan(page);expect(p.objects).toHaveLength(9);const lampId=p.selectedId;expect(p.objects.find((o:any)=>o.id===lampId).parentId).toBe('desk-1');
  const h0=await history(page),cameraBefore=await page.evaluate(()=>(window as any).__study.getCamera());
  const point=await page.evaluate(id=>(window as any).__study.project(id),lampId);
  const beforeDrag=p.objects.find((o:any)=>o.id===lampId);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+22,point.y+15,{steps:18});await page.mouse.up();
  p=await plan(page);const afterDrag=p.objects.find((o:any)=>o.id===lampId);
  expect([afterDrag.x,afterDrag.z]).not.toEqual([beforeDrag.x,beforeDrag.z]);expect((await history(page)).past).toBe(h0.past+1);
  expect(await page.evaluate(()=>(window as any).__study.getCamera())).toEqual(cameraBefore);
  expect(Number(await page.getByRole('spinbutton',{name:'X 位置',exact:true}).inputValue())).toBeCloseTo(afterDrag.x,2);
  await page.getByRole('button',{name:'向右旋转15度',exact:true}).click();expect((await plan(page)).objects.find((o:any)=>o.id===lampId).rotation).toBe(15);
  const range=page.getByRole('slider',{name:'灯光亮度'});await range.focus();await range.press('Home');await range.press('ArrowRight');await range.press('ArrowRight');await range.press('End');await range.press('ArrowLeft');await range.press('Tab');
  expect((await plan(page)).objects.find((o:any)=>o.id===lampId).brightness).toBe(99);
  await page.getByRole('switch',{name:'灯具开关'}).click();expect((await plan(page)).objects.find((o:any)=>o.id===lampId).on).toBe(false);await expect(range).toBeDisabled();
  await page.getByRole('switch',{name:'灯具开关'}).click();
  steps.push({step:'添加/拖动/旋转/调光',lamp:(await plan(page)).objects.find((o:any)=>o.id===lampId),oneDragOneHistory:true,cameraUnchanged:true});
  await choose(page,'desk-1');await page.getByRole('button',{name:'材质：深胡桃木',exact:true}).click();expect((await plan(page)).objects.find((o:any)=>o.id==='desk-1').material).toBe('walnut');
  await page.getByRole('button',{name:'深夜 10:00 PM',exact:true}).click();expect((await plan(page)).mood).toBe('night');
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await plan(page)).mood).toBe('day');await page.getByRole('button',{name:'重做',exact:true}).click();expect((await plan(page)).mood).toBe('night');
  expect((await plan(page)).selectedId).toBe('desk-1');await expect(page.getByRole('button',{name:'材质：深胡桃木',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('textbox',{name:'方案名称'}).fill('夜读 · 验收书房');await page.getByRole('textbox',{name:'方案名称'}).press('Tab');
  await page.getByRole('button',{name:'保存方案',exact:true}).click();await expect(page.locator('#save-state')).toHaveText('已保存到本地');const saved=await plan(page);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await expect(page.locator('#save-state')).toHaveText('已恢复本地方案');expect(compareCore(await plan(page))).toEqual(compareCore(saved));
  steps.push({step:'材质/深夜/撤销重做/保存刷新恢复',keyDataExact:true,storedBytes:await page.evaluate(()=>localStorage.getItem('ideal-study.plan.v1')!.length)});
  await page.setViewportSize({width:1280,height:800});await choose(page,lampId);const deleteBox=await page.locator('#delete-item').boundingBox();expect(deleteBox!.y+deleteBox!.height).toBeLessThanOrEqual(769);await shot(page,'04-night-selected-1280x800.png');
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const pngEvent=page.waitForEvent('download');await page.locator('#export-png').click();const png=await pngEvent;const pngPath=path.join(evidence,'06-exported-scene.png');await png.saveAs(pngPath);const bytes=await readFile(pngPath);expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.byteLength).toBeGreaterThan(60000);const canvasBox=await page.locator('#canvas-host').boundingBox();expect(bytes.readUInt32BE(16)).toBe(canvasBox!.width*2);expect(bytes.readUInt32BE(20)).toBe(canvasBox!.height*2);
  const jsonEvent=page.waitForEvent('download');await page.locator('#export-json').click();const json=await jsonEvent;const jsonPath=path.join(evidence,'verified-plan.json');await json.saveAs(jsonPath);const exported=JSON.parse(await readFile(jsonPath,'utf8'));expect(compareCore(exported)).toEqual(compareCore(await plan(page)));
  await page.getByRole('button',{name:'关闭导出',exact:true}).click();await page.getByRole('button',{name:'白昼 10:00 AM',exact:true}).click();
  await page.getByRole('button',{name:'导出',exact:true}).click();await page.locator('#file-input').setInputFiles(jsonPath);await expect(page.locator('#export-dialog')).not.toBeVisible();expect(compareCore(await plan(page))).toEqual(compareCore(exported));
  steps.push({step:'PNG 实际下载 / JSON 导出再导入',png:{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bytes:bytes.length},roundTripExact:true});
  const beforeBad=await plan(page);await page.getByRole('button',{name:'导出',exact:true}).click();
  for(const data of ['broken JSON',JSON.stringify({...beforeBad,objects:[...beforeBad.objects,beforeBad.objects[0]]}),JSON.stringify({...beforeBad,objects:beforeBad.objects.map((o:any,i:number)=>i===0?{...o,x:99}:o)})]){
    await page.locator('#file-input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(data)});await expect(page.locator('#toast')).toHaveClass(/error/);expect(await plan(page)).toEqual(beforeBad);
  }
  await page.keyboard.press('Escape');await expect(page.locator('#export-dialog')).not.toBeVisible();await expect(page.locator('#export')).toBeFocused();expect(errors).toEqual([]);
  await writeFile(path.join(evidence,'journey.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),steps,invalidImportsPreserved:true,consoleErrors:errors},null,2));
});

test('移动边界、桌面跟随、历史一致、选择删除、观察和缩放',async({page})=>{
  await ready(page);await choose(page,'plant-1');await changeNumber(page,'X 位置','99');const bound=(await plan(page)).objects.find((o:any)=>o.id==='plant-1');expect(bound.x).toBeLessThanOrEqual(2.25);await changeNumber(page,'Z 位置','-99');expect((await plan(page)).objects.find((o:any)=>o.id==='plant-1').z).toBeGreaterThanOrEqual(-1.85);
  await page.getByRole('button',{name:'撤销',exact:true}).click();await page.getByRole('button',{name:'撤销',exact:true}).click();
  await choose(page,'desk-1');const before=await plan(page);await changeNumber(page,'X 位置','1');await page.getByRole('button',{name:'向右旋转15度',exact:true}).click();const after=await plan(page);const children=after.objects.filter((o:any)=>o.parentId==='desk-1');expect(children).toHaveLength(2);expect(children[0].x).not.toBe(before.objects.find((o:any)=>o.id===children[0].id).x);
  await page.getByRole('button',{name:'移除书桌及桌面物件',exact:true}).click();expect((await plan(page)).objects).toHaveLength(5);expect((await plan(page)).selectedId).toBeNull();
  await page.keyboard.press('Control+z');expect((await plan(page)).objects).toEqual(after.objects);expect((await plan(page)).selectedId).toBe('desk-1');
  await page.keyboard.press('r');expect((await plan(page)).objects.find((o:any)=>o.id==='desk-1').rotation).toBe(30);
  await page.keyboard.press('ArrowRight');await expect(page.getByRole('spinbutton',{name:'X 位置',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');const stateBeforeOrbit=await plan(page);await page.getByRole('button',{name:'观察',exact:true}).click();const b=await page.locator('#canvas-host').boundingBox();await page.mouse.move(b!.x+b!.width*.6,b!.y+b!.height*.55);await page.mouse.down();await page.mouse.move(b!.x+b!.width*.6+65,b!.y+b!.height*.55+20,{steps:20});await page.mouse.up();const stateAfterOrbit=await plan(page);expect(stateAfterOrbit.objects).toEqual(stateBeforeOrbit.objects);expect(stateAfterOrbit.camera.position).not.toEqual(stateBeforeOrbit.camera.position);
  await page.mouse.wheel(0,-140);await settle(page);expect((await plan(page)).camera.zoom).toBeGreaterThan(stateAfterOrbit.camera.zoom);await page.getByRole('button',{name:'恢复默认视角',exact:true}).click();expect((await plan(page)).camera.zoom).toBe(1);
  await page.getByRole('button',{name:'布置',exact:true}).click();const point=await page.evaluate(()=>(window as any).__study.project('plant-1'));await page.mouse.click(point.x,point.y);expect((await plan(page)).selectedId).toBe('plant-1');
  await page.keyboard.press('Delete');expect((await plan(page)).objects.find((o:any)=>o.id==='plant-1')).toBeUndefined();await page.keyboard.press('Control+z');expect((await plan(page)).selectedId).toBe('plant-1');
});

test('多视角、两种桌面尺寸、黄昏、键盘和真实帧时测量',async({page,browser})=>{
  const warnings:string[]=[];page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')warnings.push(m.text());});const start=performance.now();await ready(page);const startup=performance.now()-start;
  await page.getByRole('button',{name:'近景',exact:true}).click();await shot(page,'02-close-1440x900.png');
  await page.setViewportSize({width:1280,height:800});await page.getByRole('button',{name:'俯视',exact:true}).click();await shot(page,'03-top-1280x800.png');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const selector of ['#save','#export','#undo','#redo','[data-mood="night"]','[data-add="rug"]']) {const b=await page.locator(selector).boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y+b!.height).toBeLessThanOrEqual(800);}
  await page.getByRole('button',{name:'恢复默认视角',exact:true}).click();await page.getByRole('button',{name:'黄昏 05:30 PM',exact:true}).click();expect((await plan(page)).mood).toBe('dusk');await settle(page);
  const perf:any={timestamp:new Date().toISOString(),browser:browser.version(),viewport:{width:1280,height:800},startupMs:Math.round(startup),userAgent:await page.evaluate(()=>navigator.userAgent),samples:{}};
  for(const mood of ['day','night']){
    await page.locator(`[data-mood="${mood}"]`).click();await page.getByRole('button',{name:'观察',exact:true}).click();
    // CI uses SwiftShader: fewer samples keep this a functional software-renderer check.
    // The committed local hardware measurements always use the full 100-frame/70-step path.
    const sampleCount=process.env.CI?35:100,pointerSteps=process.env.CI?16:70;
    await page.evaluate(count=>{const w=window as any;w.__frames=[];w.__frameDone=false;let last=performance.now();function sample(t:number){w.__frames.push(t-last);last=t;if(w.__frames.length<count)requestAnimationFrame(sample);else w.__frameDone=true;}requestAnimationFrame(sample);},sampleCount);
    const b=await page.locator('#canvas-host').boundingBox();await page.mouse.move(b!.x+b!.width*.6,b!.y+b!.height*.58);await page.mouse.down();await page.mouse.move(b!.x+b!.width*.6+85,b!.y+b!.height*.58+12,{steps:pointerSteps});await page.mouse.up();await page.waitForFunction(()=>(window as any).__frameDone);
    const frames=await page.evaluate(()=>(window as any).__frames.slice(5));const sorted=frames.slice().sort((a:number,b:number)=>a-b),metrics=await page.evaluate(()=>(window as any).__study.metrics());perf.samples[mood]={frameCount:frames.length,meanFrameMs:frames.reduce((a:number,b:number)=>a+b,0)/frames.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)],...metrics};await page.getByRole('button',{name:'恢复默认视角',exact:true}).click();
  }
  const r0=await page.evaluate(()=>(window as any).__study.metrics().renders);await page.waitForTimeout(1000);const r1=await page.evaluate(()=>(window as any).__study.metrics().renders);expect(r1-r0).toBeLessThanOrEqual(1);perf.idleRendersInOneSecond=r1-r0;perf.consoleWarnings=warnings;expect(warnings).toEqual([]);
  await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.thumb img').first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'物件库',exact:true}).click();await expect(page.getByRole('button',{name:'添加蘑菇台灯',exact:true})).toBeVisible();await shot(page,'05-narrow-library-390x844.png');await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/library-open/);
  await writeFile(path.join(evidence,'performance.json'),JSON.stringify(perf,null,2));
});

test('无 WebGL 时保留 JSON 备份能力，并明确提示',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:any[]):any {if(type==='webgl'||type==='webgl2'||type==='experimental-webgl')return null;return original.apply(this,[type,...args] as any);};});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-ready','error');await expect(page.getByText('暂时无法打开 3D 空间')).toBeVisible();await page.getByRole('button',{name:'导出',exact:true}).click();const event=page.waitForEvent('download');await page.locator('#export-json').click();const downloaded=await event;expect(downloaded.suggestedFilename()).toMatch(/\.json$/);await page.locator('#export-png').click();await expect(page.locator('#toast')).toContainText('3D 渲染不可用');
});

test('浏览器存储失败给出真实失败反馈，不伪报保存',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage full','QuotaExceededError');};});await ready(page);await page.getByRole('button',{name:'保存方案',exact:true}).click();await expect(page.locator('#toast')).toContainText('本地保存失败');await expect(page.locator('#save-state')).toContainText('未保存更改');
});

test('八类物件可添加，材质预览同步，键盘焦点和连续调光历史正确',async({page})=>{
  await ready(page);
  for(const kind of ['desk','chair','monitor','shelf','taskLamp','floorLamp','plant','rug']){
    const count=(await plan(page)).objects.length;await page.locator(`[data-add="${kind}"]`).click();const p=await plan(page);expect(p.objects.length).toBe(count+1);expect(p.objects.find((o:any)=>o.id===p.selectedId).kind).toBe(kind);
  }
  await choose(page,'desk-1');const originalPreview=await page.locator('.selected-preview img').getAttribute('src');await page.getByRole('button',{name:'材质：深胡桃木',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'材质：深胡桃木',exact:true})).toBeFocused();expect(await page.locator('.selected-preview img').getAttribute('src')).not.toBe(originalPreview);
  await choose(page,'taskLamp-1');const h0=await history(page),range=page.getByRole('slider',{name:'灯光亮度'}),b=await range.boundingBox();await page.mouse.move(b!.x+b!.width*.65,b!.y+b!.height/2);await page.mouse.down();await page.mouse.move(b!.x+b!.width*.3,b!.y+b!.height/2,{steps:16});await page.mouse.up();expect((await history(page)).past).toBe(h0.past+1);expect((await plan(page)).objects.find((o:any)=>o.id==='taskLamp-1').brightness).toBeLessThan(40);
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await plan(page)).objects.find((o:any)=>o.id==='taskLamp-1').brightness).toBe(65);
});
