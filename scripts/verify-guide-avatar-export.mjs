/** Re-open the exported MP4, compare the actor region and inspect all light presets.
 * Run after tests/guide.spec.ts has produced the artifacts. Uses isolated browser storage. */
import {chromium} from '@playwright/test';
import {OrthographicCamera,Vector3} from 'three';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
const dest=process.env.GUIDE_EVIDENCE_DIR??'docs/personal-ip-evidence', base=process.env.GUIDE_BASE_URL??'http://127.0.0.1:5173/', bytes=await readFile(dest+'/xiaohe-guide.mp4');
const server=createServer((req,res)=>{if(req.url==='/movie'){const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range??''),start=range?+range[1]:0,end=range?.[2]?Math.min(+range[2],bytes.length-1):bytes.length-1;res.writeHead(range?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${bytes.length}`}:{})});res.end(bytes.subarray(start,end+1));}else{res.setHeader('Content-Type','text/html');res.end('<video src="/movie" muted controls></video>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),replay=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));replay.on('pageerror',e=>errors.push(e.message));
async function crop(p,selector,roi){return p.locator(selector).evaluate((el,roi)=>{const c=document.createElement('canvas');c.width=192;c.height=256;const ctx=c.getContext('2d');const w=el.videoWidth||el.width,h=el.videoHeight||el.height;ctx.drawImage(el,roi.x*w,roi.y*h,roi.w*w,roi.h*h,0,0,192,256);return Array.from(ctx.getImageData(0,0,192,256).data);},roi);}
function diff(a,b){let n=0;for(let i=0;i<a.length;i++)if(i%4!==3)n+=Math.abs(a[i]-b[i]);return n/(a.length*.75);}
try{
 await page.goto(new URL('?workspace=guide',base).href);await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.locator('#guide-file').setInputFiles(dest+'/verified-guide.json');
 await replay.goto(`http://127.0.0.1:${server.address().port}/`);await replay.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const avatarId=await page.evaluate(()=>window.__guide.project().guide.avatar);
 const checks=[];
 for(const time of [1.5,5.5,10,13]){
  await page.bringToFront();await page.locator('#guide-scrub').fill(String(time));await page.waitForTimeout(250);
  const sample=await page.evaluate(t=>window.__guide.sample(t),time),cd=await page.evaluate(()=>window.__guide.camera());
  const h=6.8,a=16/9,cam=new OrthographicCamera(-h*a/2,h*a/2,h/2,-h/2,.1,100);cam.position.fromArray(cd.position);cam.lookAt(new Vector3().fromArray(cd.target));cam.zoom=cd.zoom;cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
  const projected=[];for(const x of [-.35,.35])for(const y of [.85,1.90])for(const z of [-.33,.33])projected.push(new Vector3(sample.position.x+x,sample.position.y+y,sample.position.z+z).project(cam));
  const left=Math.max(0,(Math.min(...projected.map(p=>p.x))+1)/2),right=Math.min(1,(Math.max(...projected.map(p=>p.x))+1)/2),top=Math.max(0,(1-Math.max(...projected.map(p=>p.y)))/2),bottom=Math.min(1,(1-Math.min(...projected.map(p=>p.y)))/2);
  const roi={x:left,y:top,w:right-left,h:bottom-top},preview=await crop(page,'#guide-canvas canvas',roi);
  await replay.bringToFront();await replay.locator('video').evaluate((v,t)=>new Promise(r=>{v.onseeked=r;v.currentTime=t;}),time);await replay.waitForFunction(t=>Math.abs(document.querySelector('video').currentTime-t)<.01,time);const video=await crop(replay,'video',roi),same=diff(preview,video);
  await page.bringToFront();await page.locator('#guide-avatar').selectOption('creator-18-v1');await page.waitForFunction(()=>window.__guide.avatar().asset==='creator-18-v1');await page.waitForTimeout(250);
  const legacy=diff(await crop(page,'#guide-canvas canvas',roi),video);
  if(same>12||legacy<=same+1)throw Error('Actor-region comparison failed '+JSON.stringify({time,same,legacy}));
  checks.push({time,region:roi,personalPreviewToVideoMae:same,legacyPreviewToVideoMae:legacy});
  await page.locator('#guide-avatar').selectOption(avatarId);await page.waitForFunction(id=>window.__guide.avatar().asset===id,avatarId);
 }
 await page.locator('#guide-color').selectOption('sage');await page.locator('#guide-start').click();await page.locator('#guide-character-close').click();await page.waitForTimeout(300);await page.screenshot({path:dest+'/13-personal-ip-front.png'});
 await page.locator('[data-guide-mood="dusk"]').click();await page.locator('#guide-character-close').click();await page.waitForTimeout(250);await page.screenshot({path:dest+'/14-personal-ip-dusk.png'});
 await page.setViewportSize({width:1280,height:800});await page.locator('[data-guide-mood="night"]').click();await page.locator('#guide-character-close').click();await page.waitForTimeout(250);await page.screenshot({path:dest+'/15-personal-ip-night-1280x800.png'});
 await writeFile(dest+'/avatar-frame-check.json',JSON.stringify({timestamp:new Date().toISOString(),browser:browser.version(),checks,errors,note:'Actual saved MP4 re-opened. Cropped upper-body/head region projected independently from the current camera and actor position. The old avatar is a negative control: its preview must differ more from this exported personal avatar.'},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
