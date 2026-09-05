import './viewer.css';
import { createProjectDialog } from './project-dialog';
import { createFilmProject } from './film-model';
import { demoPortfolio } from './portfolio-model';
const detail=createProjectDialog();

document.querySelector('#app')!.innerHTML=`<main class="reuse-page"><header><a href="?workspace=film">← 理想书房</a><span>REUSE / LIVE INTEGRATION</span></header><h1>让你的产品，驱动这间书房。</h1><p>这里的按钮属于宿主网页；嵌入的 3D 场景通过公开消息接口响应。可导入自己保存的房间或短片 JSON。</p><div class="integration-layout"><iframe id="study-frame" src="?workspace=embed" title="嵌入的可交互书房"></iframe><aside class="reuse-controls"><h2>产品控制台</h2><label>载入你的工程<input id="host-project" type="file" accept=".json,application/json"/></label><div class="reuse-buttons"><button data-mood="day">白昼</button><button data-mood="night">深夜</button></div><div class="reuse-buttons"><button data-material="walnut">书桌 · 胡桃木</button><button data-material="oak">书桌 · 橡木</button></div><label>短片位置 / 秒<input id="host-time" type="range" min="0" max="10" step="0.1" value="0"/></label><div class="reuse-buttons"><button id="host-play">播放</button><button id="host-pause">暂停</button></div><p id="host-status" role="status">正在连接播放器…</p><small>拖动场景旋转观察，滚轮缩放。演示不读取或覆盖你的本地存档。</small><a href="?workspace=viewer">打开 GLB 模型查看器 →</a></aside></div></main>`;
const frame=document.querySelector<HTMLIFrameElement>('#study-frame')!,status=document.querySelector('#host-status')!;
const sampleButton=document.createElement('button');sampleButton.id='host-sample';sampleButton.className='viewer-upload';sampleButton.textContent='载入可点击作品示例';document.querySelector('.reuse-controls h2')!.after(sampleButton);
sampleButton.onclick=()=>{const p=createFilmProject();p.scene.portfolio=demoPortfolio(p.scene.objects);sendStudyCommand('loadProject',p);};
let latest=0;
export function sendStudyCommand(command:string,payload?:unknown) {
  const id=String(++latest);
  frame.contentWindow!.postMessage({channel:'ideal-study',version:1,id,command,payload},location.origin);
}
window.addEventListener('message',e=>{
  if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!=='ideal-study'||e.data.version!==1)return;
  if(e.data.event==='activateProject'){
    detail.open(e.data.detail.project);status.textContent='宿主收到作品点击：'+e.data.detail.project.title;
    window.dispatchEvent(new CustomEvent('study-activate',{detail:e.data.detail}));return;
  }
  if(!e.data.ok){status.textContent=e.data.error;status.className='error';return;}
  const {state}=e.data;status.className='';status.textContent=`已同步 · ${state.playing?'播放中':'已暂停'} · ${state.time.toFixed(2)} / ${state.duration.toFixed(2)} 秒`;
  const time=document.querySelector<HTMLInputElement>('#host-time')!;time.max=state.duration;time.value=state.time;
  document.documentElement.dataset.ready='true';
  // Read-only evidence and a useful host integration event.
  window.dispatchEvent(new CustomEvent('study-change',{detail:e.data}));
});
frame.onload=()=>{const timer=setInterval(()=>{sendStudyCommand('getState');if(document.documentElement.dataset.ready==='true')clearInterval(timer);},250);setTimeout(()=>{clearInterval(timer);if(document.documentElement.dataset.ready!=='true')status.textContent='播放器未连接，请检查 WebGL 与加载错误。';},15000);};
document.querySelectorAll<HTMLElement>('[data-mood]').forEach(b=>b.onclick=()=>sendStudyCommand('setMood',b.dataset.mood));
document.querySelectorAll<HTMLElement>('[data-material]').forEach(b=>b.onclick=()=>sendStudyCommand('setMaterial',{id:'desk-1',material:b.dataset.material}));
document.querySelector('#host-play')!.addEventListener('click',()=>sendStudyCommand('play'));
document.querySelector('#host-pause')!.addEventListener('click',()=>sendStudyCommand('pause'));
document.querySelector('#host-time')!.addEventListener('input',e=>sendStudyCommand('seek',Number((e.target as HTMLInputElement).value)));
document.querySelector('#host-project')!.addEventListener('change',async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>6*1024*1024)throw new Error('请选择 6 MB 以内的 JSON 工程。');sendStudyCommand('loadProject',JSON.parse(await file.text()));}catch(error){status.textContent=(error as Error).message;status.className='error';}});
