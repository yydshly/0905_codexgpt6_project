import { parseFilmProject } from './film-model';
import { MAX_JSON_BYTES } from './model';
import { mountPortfolioView } from './portfolio-view';

try{
  const response=await fetch('./project.json',{cache:'no-cache'});
  if(!response.ok)throw new Error('展示内容加载失败，请稍后刷新，或联系站点作者检查 project.json。');
  const text=await response.text();if(new TextEncoder().encode(text).length>MAX_JSON_BYTES)throw new Error('展示工程超过文件大小限制。');
  await mountPortfolioView(parseFilmProject(JSON.parse(text)).project,{visitor:true});
}catch(error){const app=document.querySelector('#app')!;app.replaceChildren();const title=document.createElement('h1'),p=document.createElement('p');title.textContent='暂时无法打开这个作品空间';p.textContent=(error as Error).message;app.append(title,p);app.setAttribute('role','alert');document.documentElement.dataset.ready='error';}
