import { createStudyPlayer } from './player';
import { createFilmProject, loadFilmProject, parseFilmProject } from './film-model';
import { initialPlan, ROOM_STORAGE, parsePlan, MAX_JSON_BYTES } from './model';
import { boundWorks, demoPortfolio, type Work } from './portfolio-model';
import { createProjectDialog } from './project-dialog';
import { preparePhotos } from './photos';
import './portfolio.css';

const source=new URLSearchParams(location.search).get('project');
let project=createFilmProject(),sample=!source,message='';
try{
  if(source==='film'){const loaded=loadFilmProject();project=loaded.project;message=loaded.message;}
  else if(source==='room'){
    const saved=localStorage.getItem(ROOM_STORAGE)??localStorage.getItem('ideal-study.plan.v2')??localStorage.getItem('ideal-study.plan.v1');
    project=createFilmProject(saved?parsePlan(JSON.parse(saved).plan):initialPlan());
  }else project.scene.portfolio=demoPortfolio(project.scene.objects);
}catch{message='本地工程无法读取。原存档保留，可导入 JSON 继续查看。';sample=false;}
document.querySelector('#app')!.innerHTML=`<main class="portfolio-page"><div id="portfolio-stage" aria-label="可探索的作品书房"></div><header class="portfolio-top"><a class="portfolio-brand" href="?workspace=${source==='film'?'room&project=film':'room'}"><span>◇</span> 理想书房 <small>PORTFOLIO</small></a><nav aria-label="作品展示操作"><a id="portfolio-edit" href="?workspace=room${source==='film'?'&project=film':''}">编辑房间</a><button id="portfolio-import">导入工程</button><button id="portfolio-json">导出工程</button><a href="?workspace=integration">网页接入 ↗</a></nav></header><div class="portfolio-intro"><span class="work-eyebrow" id="portfolio-edition"></span><h1>在日常里，<br/>遇见我的作品<span>。</span></h1><p>一本书，一块屏幕。<br/>每一处，都通往一次创作。</p></div><div class="portfolio-tools" role="group" aria-label="场景控制"><button data-mood="day" aria-label="白昼氛围">☀</button><button data-mood="night" aria-label="深夜氛围">☾</button><button id="portfolio-reset">恢复视角</button><button id="portfolio-play">播放短片</button></div><footer class="portfolio-bottom"><div class="portfolio-list-heading"><span>精选作品 <b id="work-count"></b></span><small>点击书籍 / 屏幕，或从下方选择作品</small></div><div id="work-list" aria-label="作品列表"></div><p id="portfolio-status" role="status" aria-live="polite">正在布置作品书房…</p></footer><input hidden id="portfolio-file" type="file" accept=".json,application/json"/></main>`;
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const detail=createProjectDialog();let player:Awaited<ReturnType<typeof createStudyPlayer>>|undefined;
const markerButton=document.createElement('button');markerButton.id='portfolio-markers';markerButton.textContent='隐藏标记';markerButton.setAttribute('aria-pressed','true');$('.portfolio-tools').prepend(markerButton);let markersVisible=true;
markerButton.onclick=()=>{markersVisible=!markersVisible;player?.setMarkersVisible(markersVisible);markerButton.textContent=markersVisible?'隐藏标记':'显示标记';markerButton.setAttribute('aria-pressed',String(markersVisible));};
const report=(s:string,error=false)=>{const el=$('#portfolio-status');el.textContent=s;el.classList.toggle('error',error);};
function open(work:Work){player?.pause();$('#portfolio-play').textContent='播放短片';detail.open(work);}
function populate(){
  document.body.dataset.mood=project.scene.mood;
  const works=boundWorks(project.scene.portfolio);$('#work-count').textContent=String(works.length).padStart(2,'0');$('#portfolio-edition').textContent=sample?'示例作品 / 可替换为你的项目':'个人作品 / '+project.scene.name;
  $('#work-list').replaceChildren();
  if(!works.length){const p=document.createElement('p');p.className='portfolio-empty';p.textContent='还没有关联作品。返回编辑房间，选中书桌或显示器，配置你的第一个作品入口。';$('#work-list').append(p);}
  works.forEach((work,i)=>{const b=document.createElement('button');b.className='work-card';b.dataset.work=work.id;const n=document.createElement('span');n.className='work-number';n.textContent=String(i+1).padStart(2,'0');const content=document.createElement('span'),title=document.createElement('strong'),tags=document.createElement('small'),arrow=document.createElement('span');title.textContent=work.title;tags.textContent=work.tags||'查看作品详情';arrow.textContent='↗';content.append(title,tags);b.append(n,content,arrow);b.onclick=()=>open(work);$('#work-list').append(b);});
}
populate();
try{await preparePhotos(project.scene);player=await createStudyPlayer($('#portfolio-stage'),project);player.resetView();player.onActivate(event=>open(event.project));report(message||(sample?'示例模式 · 拖动观察，滚轮缩放 · 点击 01 / 02 探索':'展示已保存的工程 · 拖动观察，滚轮缩放'),!!message);}
catch(error){console.warn('Portfolio renderer:',error);report('3D 暂不可用；你仍可从下方作品列表查看详情、访问项目或导入工程。',true);$('#portfolio-stage').classList.add('portfolio-fallback');$('.portfolio-tools').hidden=true;}
document.documentElement.dataset.ready='true';
document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(b=>b.onclick=()=>{player?.setMood(b.dataset.mood as 'day'|'night');document.body.dataset.mood=b.dataset.mood;});
$('#portfolio-reset').onclick=()=>{player?.resetView();$('#portfolio-play').textContent='播放短片';};
$('#portfolio-play').onclick=()=>{if(!player)return;if(player.getState().playing){player.pause();$('#portfolio-play').textContent='播放短片';}else{player.play();$('#portfolio-play').textContent='暂停 · 继续探索';report('短片播放中，暂停后可点击作品。');}};
const timer=setInterval(()=>{if(player&&!player.getState().playing)$('#portfolio-play').textContent='播放短片';},500);
$('#portfolio-import').onclick=()=>$<HTMLInputElement>('#portfolio-file').click();
$('#portfolio-file').onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>MAX_JSON_BYTES)throw new Error('请选择 6 MB 以内的工程。');const next=parseFilmProject(JSON.parse(await file.text())).project;await preparePhotos(next.scene);await player?.loadProject(next);project=next;sample=false;populate();report('已载入工程；此展示页不覆盖编辑器的本地保存。');}catch(error){report((error as Error).message,true);}};
$('#portfolio-json').onclick=()=>{const value=player?.getProject()??project,url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='我的作品书房.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);report('工程文件已交给浏览器下载。');};
window.addEventListener('pagehide',()=>{clearInterval(timer);player?.destroy();detail.destroy();},{once:true});
Object.defineProperty(window,'__portfolio',{value:{getProject:()=>structuredClone(player?.getProject()??project),metrics:()=>player?.getMetrics(),state:()=>player?.getState()}});
