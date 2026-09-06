import { createFilmProject, loadFilmProject, parseFilmProject, projectSignature, storeFilmProject } from './film-model';
import { initialPlan, ROOM_STORAGE, parsePlan, MAX_JSON_BYTES } from './model';
import { demoPortfolio } from './portfolio-model';
import { preparePhotos } from './photos';
import { mountPortfolioView } from './portfolio-view';
import { openPublishDialog } from './publish-dialog';
import { projectSession } from './project-session';
import { mountProjectMenu } from './project-menu';

const session=await projectSession();
const source=new URLSearchParams(location.search).get('project');
let project=createFilmProject(),sample=!source&&!session,message='',imported=false;
try{
  if(session)project=structuredClone(session.record.project);
  else if(source==='film'){const loaded=loadFilmProject();project=loaded.project;message=loaded.message;}
  else if(source==='room'){
    const saved=localStorage.getItem(ROOM_STORAGE)??localStorage.getItem('ideal-study.plan.v2')??localStorage.getItem('ideal-study.plan.v1');
    project=createFilmProject(saved?parsePlan(JSON.parse(saved).plan):initialPlan());
  }else project.scene.portfolio=demoPortfolio(project.scene.objects);
}catch{message='本地工程无法读取。原存档保留，可导入 JSON 继续查看。';sample=false;imported=true;}
const view=await mountPortfolioView(project,{notice:sample?'示例作品 / 可替换为你的项目':undefined});
let savedSignature=projectSignature(project);
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
$('.portfolio-top nav').innerHTML=`<a id="portfolio-edit" href="?workspace=room${source==='film'?'&project=film':''}">编辑房间</a><button id="portfolio-publish">发布展示页</button><button id="portfolio-import">导入工程</button><button id="portfolio-json">导出工程</button><a href="?workspace=integration">网页接入 ↗</a>`;
if(session)$<HTMLAnchorElement>('#portfolio-edit').href=session.url('room');
const guideLink=document.createElement('button');guideLink.textContent='角色导览 · 试验';guideLink.title='将当前房间与作品配置带入独立导览快照';guideLink.onclick=()=>{view.pause();try{const snapshot=crypto.randomUUID();sessionStorage.setItem('ideal-study.guide.source:'+snapshot,JSON.stringify(view.getProject()));location.href='?workspace=guide&snapshot='+snapshot;}catch{view.report('暂时无法传递工程，请先导出 JSON，再从角色导览页导入。',true);}};$('.portfolio-top nav').append(guideLink);
async function saveCurrent(next=view.getProject()){
  if(session&&!imported)await session.save(next);
  else if(!sample&&!imported&&source==='room')localStorage.setItem(ROOM_STORAGE,JSON.stringify({plan:next.scene,savedAt:new Date().toISOString()}));
  else if(!sample&&!imported&&source==='film')storeFilmProject(next);
  if(!sample&&!imported)savedSignature=projectSignature(next);
}
mountProjectMenu({host:$('.portfolio-top nav'),id:imported?undefined:session?.record.id,workspace:'portfolio',getProject:()=>view.getProject(),hasUnsavedChanges:()=>sample||imported||projectSignature(view.getProject())!==savedSignature,save:async()=>{try{if(sample||imported)throw new Error('示例或导入预览请先另存为新工程，避免丢失本次配置。');await saveCurrent();return true;}catch(error){view.report((error as Error).message,true);return false;}},thumbnail:()=>undefined,beforeOpen:()=>view.pause(),leave:()=>{}});
const file=document.createElement('input');file.id='portfolio-file';file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);
if(message)view.report(message,true);
$('#portfolio-publish').onclick=()=>{view.pause();openPublishDialog(view.getProject(),async next=>{
  await saveCurrent(next);
  await view.loadProject(next);
},!sample&&!imported&&(!!session||['room','film'].includes(source??'')));};
$('#portfolio-import').onclick=()=>file.click();
file.onchange=async()=>{const selected=file.files?.[0];file.value='';if(!selected)return;try{if(selected.size>MAX_JSON_BYTES)throw new Error('请选择 6 MB 以内的工程。');const next=parseFilmProject(JSON.parse(await selected.text())).project;await preparePhotos(next.scene);await view.loadProject(next);imported=true;sample=false;view.report('已载入工程；此展示页不覆盖编辑器的本地保存。');}catch(error){view.report((error as Error).message,true);}};
$('#portfolio-json').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(view.getProject(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='我的作品书房.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);view.report('工程文件已交给浏览器下载。');};
