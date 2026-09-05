import { createStudyPlayer } from './player';
import { boundWorks, type Work } from './portfolio-model';
import { parseFilmProject, type FilmProject } from './film-model';
import { createProjectDialog } from './project-dialog';
import './portfolio.css';

/** Author preview and exported visitor site share rendering and interaction. */
export async function mountPortfolioView(initial:FilmProject,options:{visitor?:boolean;notice?:string}={}){
  let project=parseFilmProject(initial).project;
  document.querySelector('#app')!.innerHTML=`<main class="portfolio-page ${options.visitor?'visitor-page':''}"><div id="portfolio-stage" aria-label="可探索的作品书房"></div><header class="portfolio-top"><span class="portfolio-brand"><span>◇</span><b id="portfolio-owner"></b><small>PORTFOLIO</small></span><nav aria-label="作品展示操作"></nav></header><div class="portfolio-intro"><span class="work-eyebrow" id="portfolio-edition"></span><h1 id="portfolio-headline"></h1><p id="portfolio-bio"></p></div><div class="portfolio-tools" role="group" aria-label="场景控制"><button id="portfolio-markers" aria-pressed="true">隐藏标记</button><button data-mood="day" aria-label="白昼氛围">☀</button><button data-mood="night" aria-label="深夜氛围">☾</button><button id="portfolio-reset">恢复视角</button><button id="portfolio-play">播放短片</button></div><footer class="portfolio-bottom"><div class="portfolio-list-heading"><span>精选作品 <b id="work-count"></b></span><small>点击房间物品，或从下方选择作品</small></div><div id="work-list" aria-label="作品列表"></div><p id="portfolio-status" role="status" aria-live="polite">正在布置作品书房…</p></footer></main>`;
  const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
  const detail=createProjectDialog();let player:Awaited<ReturnType<typeof createStudyPlayer>>|undefined,markersVisible=true;
  const report=(s:string,error=false)=>{const el=$('#portfolio-status');el.textContent=s;el.classList.toggle('error',error);};
  function open(work:Work){player?.pause();$('#portfolio-play').textContent='播放短片';detail.open(work);}
  function populate(){
    const profile=project.scene.portfolio.presentation;document.title=profile.name+' · 个人作品';
    document.body.dataset.mood=project.scene.mood;$('#portfolio-owner').textContent=profile.name;$('#portfolio-headline').textContent=profile.headline;$('#portfolio-bio').textContent=profile.bio;
    $('#portfolio-edition').textContent=options.visitor?'个人作品 / SELECTED WORK':options.notice??'个人作品 / '+project.scene.name;
    const works=boundWorks(project.scene.portfolio);$('#work-count').textContent=String(works.length).padStart(2,'0');$('#work-list').replaceChildren();
    if(!works.length){const p=document.createElement('p');p.className='portfolio-empty';p.textContent=options.visitor?'作品正在整理中，欢迎先探索这个房间。':'还没有关联作品。返回编辑房间，选中任意物件，配置你的第一个作品入口。';$('#work-list').append(p);}
    works.forEach((work,i)=>{const b=document.createElement('button');b.className='work-card';b.dataset.work=work.id;const n=document.createElement('span');n.className='work-number';n.textContent=String(i+1).padStart(2,'0');const content=document.createElement('span'),title=document.createElement('strong'),tags=document.createElement('small'),arrow=document.createElement('span');title.textContent=work.title;tags.textContent=work.tags||'查看作品详情';arrow.textContent='↗';content.append(title,tags);b.append(n,content,arrow);b.onclick=()=>open(work);$('#work-list').append(b);});
  }
  populate();
  try{player=await createStudyPlayer($('#portfolio-stage'),project);player.resetView();player.onActivate(event=>open(event.project));report(options.visitor?'拖动观察，滚轮缩放 · 点击物品探索作品':'预览当前工程 · 拖动观察，滚轮缩放');}
  catch(error){console.warn('Portfolio renderer:',error);report('3D 暂不可用；你仍可从下方作品列表查看详情、访问项目。',true);$('#portfolio-stage').classList.add('portfolio-fallback');$('.portfolio-tools').hidden=true;}
  const markerButton=$('#portfolio-markers');markerButton.onclick=()=>{markersVisible=!markersVisible;player?.setMarkersVisible(markersVisible);markerButton.textContent=markersVisible?'隐藏标记':'显示标记';markerButton.setAttribute('aria-pressed',String(markersVisible));};
  document.querySelectorAll<HTMLButtonElement>('[data-mood]').forEach(b=>b.onclick=()=>{project.scene.mood=b.dataset.mood as 'day'|'night';player?.setMood(project.scene.mood);document.body.dataset.mood=project.scene.mood;});
  $('#portfolio-reset').onclick=()=>{player?.resetView();$('#portfolio-play').textContent='播放短片';};
  $('#portfolio-play').onclick=()=>{if(!player)return;if(player.getState().playing){player.pause();$('#portfolio-play').textContent='播放短片';report('已暂停，可继续点击物品探索。');}else{player.play();$('#portfolio-play').textContent='暂停 · 继续探索';report('短片播放中，暂停后可点击作品。');}};
  const timer=setInterval(()=>{if(player&&!player.getState().playing)$('#portfolio-play').textContent='播放短片';},500);
  window.addEventListener('pagehide',()=>{clearInterval(timer);player?.destroy();detail.destroy();},{once:true});
  const getProject=()=>structuredClone(player?.getProject()??project);
  Object.defineProperty(window,'__portfolio',{value:{getProject,metrics:()=>player?.getMetrics(),state:()=>player?.getState()}});
  document.documentElement.dataset.ready='true';
  return {getProject,report,pause:()=>player?.pause(),async loadProject(next:FilmProject){await player?.loadProject(next);project=structuredClone(next);player?.resetView();populate();}};
}
