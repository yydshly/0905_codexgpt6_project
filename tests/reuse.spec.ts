import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const evidence=path.resolve('test-results/reuse-evidence');
const plan=(p:Page)=>p.evaluate(()=>(window as any).__study.getPlan());
const history=(p:Page)=>p.evaluate(()=>(window as any).__study.history());
async function ready(p:Page,route='room'){await p.goto(`./?workspace=${route}`);await expect(p.locator('html')).toHaveAttribute('data-ready','true');}
async function change(p:Page,label:string,value:string){await p.getByRole('spinbutton',{name:label,exact:true}).fill(value);await p.getByRole('spinbutton',{name:label,exact:true}).press('Tab');}
async function capture(p:Page,file:string){await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await p.screenshot({path:path.join(evidence,file)});}
test.beforeAll(async()=>{await mkdir(evidence,{recursive:true});});
test.beforeEach(async({page})=>{page.on('dialog',d=>d.accept());});

test('照片沿墙编辑、原档迁移、图片保存刷新及整屋/单件 GLB 独立打开',async({page,browser})=>{
  test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const legacy=JSON.parse(await readFile('tests/fixtures/legacy-v1.json','utf8'));
  await page.addInitScript(value=>{if(!localStorage.getItem('ideal-study.plan.v1'))localStorage.setItem('ideal-study.plan.v1',JSON.stringify({plan:value,savedAt:'original'}));},legacy);
  await ready(page);expect((await plan(page)).version).toBe(2);expect((await plan(page)).objects.filter((o:any)=>o.kind!=='wallPhoto')).toEqual(legacy.objects);
  const old=await page.evaluate(()=>localStorage.getItem('ideal-study.plan.v1'));
  await page.getByRole('combobox',{name:'切换当前物件'}).selectOption('wall-art');
  await expect(page.getByRole('spinbutton',{name:'朝向角度'})).toHaveCount(0);await expect(page.getByRole('spinbutton',{name:'Z 位置',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'恢复默认视角',exact:true}).click();
  const pt=await page.evaluate(()=>(window as any).__study.project('wall-art')),before=await plan(page),h=await history(page);
  await page.mouse.move(pt.x,pt.y);await page.mouse.down();await page.mouse.move(pt.x-20,pt.y-22,{steps:8});await page.mouse.up();
  const moved=(await plan(page)).objects.find((o:any)=>o.id==='wall-art');expect([moved.x,moved.y]).not.toEqual([.6,1.93]);expect(moved.z).toBe(-2.17);expect((await history(page)).past).toBe(h.past+1);expect((await plan(page)).camera).toEqual(before.camera);
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await plan(page)).objects).toEqual(before.objects);await page.getByRole('button',{name:'重做',exact:true}).click();
  await change(page,'X 位置','.6');await change(page,'悬挂高度','2');await change(page,'相框宽度','1.3');await change(page,'相框高度','1');
  // A self-authored raster test picture, not a downloaded external asset.
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=420;const x=c.getContext('2d')!;x.fillStyle='#d9c9a4';x.fillRect(0,0,640,420);x.fillStyle='#faf0d1';x.beginPath();x.arc(465,106,53,0,Math.PI*2);x.fill();for(const [color,points]of [['#869481',[[0,295],[210,135],[420,330],[640,190],[640,420],[0,420]]],['#3c5a4a',[[0,350],[240,265],[410,372],[640,255],[640,420],[0,420]]]] as const){x.fillStyle=color;x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();}x.fillStyle='#fff8e3';x.font='18px sans-serif';x.fillText('A QUIET PLACE / 01',28,390);return c.toDataURL('image/png');});
  const photoPath=path.join(evidence,'test-photo.png');await writeFile(photoPath,Buffer.from(data.split(',')[1],'base64'));
  const chooser=page.waitForEvent('filechooser');await page.locator('#photo-upload').click();await (await chooser).setFiles(photoPath);await expect(page.locator('#toast')).toContainText('照片已更新');
  const photo=(await plan(page)).objects.find((o:any)=>o.id==='wall-art').photo;expect(photo).toMatch(/^data:image\/jpeg;base64,/);await page.getByRole('button',{name:'材质：深胡桃木',exact:true}).click();
  const stable=await plan(page);await page.locator('#photo-input').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken')});await expect(page.locator('#toast')).toHaveClass(/error/);expect(await plan(page)).toEqual(stable);
  await page.getByRole('button',{name:'保存方案',exact:true}).click();const saved=await plan(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await plan(page)).toEqual(saved);expect(await page.evaluate(()=>localStorage.getItem('ideal-study.plan.v1'))).toBe(old);
  await capture(page,'01-photo-room-1440x900.png');
  await page.getByRole('button',{name:'导出',exact:true}).click();let event=page.waitForEvent('download');await page.locator('#export-json').click();const jsonPath=path.join(evidence,'reusable-room.json');await (await event).saveAs(jsonPath);expect(JSON.parse(await readFile(jsonPath,'utf8'))).toEqual(saved);
  const malformed=structuredClone(saved);malformed.objects.find((o:any)=>o.kind==='wallPhoto').photo='data:image/jpeg;base64,YnJva2Vu';await page.locator('#file-input').setInputFiles({name:'invalid-image.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malformed))});await expect(page.locator('#toast')).toHaveClass(/error/);expect(await plan(page)).toEqual(saved);
  await page.locator('#file-input').setInputFiles(jsonPath);await expect(page.locator('#export-dialog')).not.toBeVisible();expect(await plan(page)).toEqual(saved);
  const exports:any[]=[];
  for(const [button,file]of [['export-item-glb','wall-photo.glb'],['export-glb','study-room.glb']]){
    await page.getByRole('button',{name:'导出',exact:true}).click();event=page.waitForEvent('download');await page.locator('#'+button).click();const exportPath=path.join(evidence,file);await(await event).saveAs(exportPath);const bytes=await readFile(exportPath);expect(bytes.readUInt32LE(0)).toBe(0x46546c67);expect(bytes.readUInt32LE(8)).toBe(bytes.length);const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());expect(gltf.images.every((i:any)=>i.bufferView!==undefined&&!i.uri)).toBe(true);expect(gltf.extensionsUsed??[]).not.toContain('EXT_mesh_gpu_instancing');
    const viewer=await browser.newPage({baseURL:new URL('.',page.url()).href,viewport:{width:1280,height:800}});await ready(viewer,'viewer');await viewer.locator('#glb-file').setInputFiles(exportPath);await expect(viewer.locator('html')).toHaveAttribute('data-loaded','true');const info=await viewer.evaluate(()=>(window as any).__glb);expect(info.textures).toBeGreaterThan(0);if(button==='export-item-glb'){expect(info.bounds[0]).toBeCloseTo(1.3,2);expect(info.bounds[1]).toBeCloseTo(1,2);}else{expect(info.nodes).toContain('desk-1');expect(info.bounds[0]).toBeCloseTo(5.48,1);await capture(viewer,'02-exported-glb-1280x800.png');}
    await viewer.locator('#glb-file').setInputFiles({name:'bad.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('invalid')});await expect(viewer.locator('#glb-info')).toHaveClass('error');expect(await viewer.evaluate(()=>(window as any).__glb)).toEqual(info);exports.push({file,bytes:bytes.length,...info});await viewer.close();await page.bringToFront();await page.locator('#close-dialog').click();
  }
  const clean=await browser.newPage({baseURL:new URL('.',page.url()).href});await ready(clean);await clean.locator('#file-input').setInputFiles(jsonPath);await expect(clean.locator('#toast')).toContainText('已导入');expect(await plan(clean)).toEqual(saved);await clean.close();
  await page.locator('#workspace-film').click();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('#film-start').click();
  expect((await page.evaluate(()=>(window as any).__film.getProject())).scene.objects).toEqual(saved.objects);
  await page.locator('#film-save').click();const filmSaved=await page.evaluate(()=>(window as any).__film.getProject());await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await page.evaluate(()=>(window as any).__film.getProject())).toEqual(filmSaved);
  event=page.waitForEvent('download');await page.locator('#film-json').click();await(await event).saveAs(path.join(evidence,'reusable-film.json'));
  expect(errors).toEqual([]);await writeFile(path.join(evidence,'photo-and-glb.json'),JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),oldStoragePreserved:true,savedRestoreExact:true,freshPageJsonExact:true,invalidImagePreserved:true,exports,errors},null,2));
});

test('沙发与床添加、移动旋转材质、双尺寸与多视角',async({page})=>{
  await ready(page);const objects=await plan(page),records:any[]=[];
  for(const [kind,name]of [['sofa','云朵双人沙发'],['bed','原木单人床']]){
    await page.locator(`[data-add="${kind}"]`).click();let p=await plan(page),item=p.objects.find((o:any)=>o.id===p.selectedId);expect(item.kind).toBe(kind);expect(p.objects.length).toBe(objects.objects.length+1);
    await page.getByRole('button',{name:'向右旋转15度',exact:true}).click();await change(page,'X 位置','1.5');await change(page,'Z 位置','1');await page.getByRole('button',{name:kind==='sofa'?'材质：鼠尾草绿':'材质：深胡桃木',exact:true}).click();
    p=await plan(page);item=p.objects.find((o:any)=>o.id===p.selectedId);expect(item.rotation).toBe(15);expect(item.material).toBe(kind==='sofa'?'sage':'walnut');
    for(const viewport of [{width:1440,height:900},{width:1280,height:800}]){await page.setViewportSize(viewport);await expect(page.locator('#save')).toBeInViewport();await expect(page.locator('#export')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
    for(const view of ['top','close','default']){await page.locator(`[data-view="${view}"]`).click();if(view!=='default')await page.screenshot({path:path.join('.scratch',`${kind}-${view}.png`)});}
    await page.locator('[data-mood="night"]').click();await page.screenshot({path:path.join('.scratch',`${kind}-night.png`)});await page.locator('[data-mood="day"]').click();
    await page.locator('.library').evaluate(el=>el.scrollTop=0);await capture(page,kind==='sofa'?'03-sofa-1280x800.png':'04-bed-1280x800.png');records.push({name,item,metrics:await page.evaluate(()=>(window as any).__study.metrics())});
    await page.getByRole('button',{name:'移除物件',exact:true}).click();expect((await plan(page)).objects).toEqual(objects.objects);await page.getByRole('button',{name:'撤销',exact:true}).click();expect((await plan(page)).selectedId).toBe(item.id);await page.getByRole('button',{name:'重做',exact:true}).click();
  }
  await writeFile(path.join(evidence,'furniture.json'),JSON.stringify(records,null,2));
});

test('真实宿主网页驱动 iframe：材质、光照、定位、播放及工程导入',async({page})=>{
  await page.addInitScript(()=>{window.addEventListener('study-change',e=>{(window as any).__hostResult=(e as CustomEvent).detail;});});
  await ready(page,'integration');const result=()=>page.evaluate(()=>(window as any).__hostResult);
  for(const viewport of [{width:1280,height:800},{width:1440,height:900}]){await page.setViewportSize(viewport);await expect(page.locator('.integration-layout')).toHaveCSS('display','grid');expect((await page.locator('#study-frame').boundingBox())!.width).toBeGreaterThan(800);await expect(page.locator('#host-play')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.locator('[data-mood="night"]').click();await expect.poll(async()=>(await result()).project.scene.mood).toBe('night');
  await page.locator('[data-material="walnut"]').click();await expect.poll(async()=>(await result()).project.scene.objects.find((o:any)=>o.id==='desk-1').material).toBe('walnut');
  await page.locator('#host-time').fill('4.8');await expect.poll(async()=>(await result()).state.time).toBe(4.8);
  await page.locator('#host-play').click();await expect.poll(async()=>(await result()).state.playing).toBe(true);await page.waitForTimeout(200);await page.locator('#host-pause').click();await expect.poll(async()=>(await result()).state.playing).toBe(false);expect((await result()).state.time).toBeGreaterThan(4.8);
  const before=(await result()).project;await page.locator('#host-project').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"app":"no"}')});await expect(page.locator('#host-status')).toHaveClass('error');expect((await result()).project).toEqual(before);
  const legacy=JSON.parse(await readFile('tests/fixtures/legacy-v1.json','utf8'));await page.locator('#host-project').setInputFiles('tests/fixtures/legacy-v1.json');await expect.poll(async()=>(await result()).project.scene.name).toBe(legacy.name);
  await page.locator('[data-mood="day"]').click();await expect.poll(async()=>(await result()).project.scene.mood).toBe('day');await capture(page,'05-product-integration-1440x900.png');
  // A sibling window / synthetic message cannot impersonate the allowed iframe parent.
  const iframe=page.frames().find(f=>f.url().includes('workspace=embed'))!;
  await iframe.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://untrusted.example',source:parent,data:{channel:'ideal-study',version:1,id:'fake',command:'setMood',payload:'night'}})));
  await page.locator('#host-pause').click();await expect.poll(async()=>(await result()).project.scene.mood).toBe('day');
  expect(await page.evaluate(()=>localStorage.getItem('ideal-study.plan.v2'))).toBeNull();expect(await page.evaluate(()=>localStorage.getItem('ideal-study.film.v3'))).toBeNull();
  await writeFile(path.join(evidence,'integration.json'),JSON.stringify({timestamp:new Date().toISOString(),liveIframeControlled:true,materialMoodAndPlayback:true,legacyImport:true,untrustedOriginIgnored:true,localStorageUntouched:true},null,2));
});

test('旧短片 v2 升级到 v3：镜头保留、内嵌房间迁移、原存档不覆盖',async({page})=>{
  const legacy=JSON.parse(await readFile('docs/film-evidence/verified-film-project.json','utf8'));
  await page.addInitScript(value=>{if(!localStorage.getItem('ideal-study.film.v2'))localStorage.setItem('ideal-study.film.v2',JSON.stringify({project:value,savedAt:'original-v2'}));},legacy);
  await ready(page,'film');const before=await page.evaluate(()=>(window as any).__film.getProject()),old=await page.evaluate(()=>localStorage.getItem('ideal-study.film.v2'));
  expect(before.version).toBe(3);expect(before.scene.version).toBe(2);expect(before.film).toEqual(legacy.film);expect(before.playhead).toBe(legacy.playhead);expect(before.scene.objects.filter((o:any)=>o.kind!=='wallPhoto')).toEqual(legacy.scene.objects);
  await page.locator('#film-save').click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');expect(await page.evaluate(()=>(window as any).__film.getProject())).toEqual(before);expect(await page.evaluate(()=>localStorage.getItem('ideal-study.film.v2'))).toBe(old);
});

