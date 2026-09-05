import { createFilmProject, loadFilmProject, parseFilmProject, storeFilmProject } from './film-model';
import { initialPlan, ROOM_STORAGE, parsePlan, MAX_JSON_BYTES } from './model';
import { demoPortfolio } from './portfolio-model';
import { preparePhotos } from './photos';
import { mountPortfolioView } from './portfolio-view';
import { openPublishDialog } from './publish-dialog';

const source=new URLSearchParams(location.search).get('project');
let project=createFilmProject(),sample=!source,message='',imported=false;
try{
  if(source==='film'){const loaded=loadFilmProject();project=loaded.project;message=loaded.message;}
  else if(source==='room'){
    const saved=localStorage.getItem(ROOM_STORAGE)??localStorage.getItem('ideal-study.plan.v2')??localStorage.getItem('ideal-study.plan.v1');
    project=createFilmProject(saved?parsePlan(JSON.parse(saved).plan):initialPlan());
  }else project.scene.portfolio=demoPortfolio(project.scene.objects);
}catch{message='本地工程无法读取。原存档保留，可导入 JSON 继续查看。';sample=false;imported=true;}
const view=await mountPortfolioView(project,{notice:sample?'示例作品 / 可替换为你的项目':undefined});
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
$('.portfolio-top nav').innerHTML=`<a id="portfolio-edit" href="?workspace=room${source==='film'?'&project=film':''}">编辑房间</a><button id="portfolio-publish">发布展示页</button><button id="portfolio-import">导入工程</button><button id="portfolio-json">导出工程</button><a href="?workspace=integration">网页接入 ↗</a>`;
const file=document.createElement('input');file.id='portfolio-file';file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);
if(message)view.report(message,true);
$('#portfolio-publish').onclick=()=>{view.pause();openPublishDialog(view.getProject(),async next=>{
  if(!sample&&!imported&&source==='room')localStorage.setItem(ROOM_STORAGE,JSON.stringify({plan:next.scene,savedAt:new Date().toISOString()}));
  else if(!sample&&!imported&&source==='film')storeFilmProject(next);
  await view.loadProject(next);
},!sample&&!imported&&['room','film'].includes(source??''));};
$('#portfolio-import').onclick=()=>file.click();
file.onchange=async()=>{const selected=file.files?.[0];file.value='';if(!selected)return;try{if(selected.size>MAX_JSON_BYTES)throw new Error('请选择 6 MB 以内的工程。');const next=parseFilmProject(JSON.parse(await selected.text())).project;await preparePhotos(next.scene);await view.loadProject(next);imported=true;sample=false;view.report('已载入工程；此展示页不覆盖编辑器的本地保存。');}catch(error){view.report((error as Error).message,true);}};
$('#portfolio-json').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(view.getProject(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='我的作品书房.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);view.report('工程文件已交给浏览器下载。');};
