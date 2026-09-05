import type { Work } from './portfolio-model';
import './portfolio.css';

export function createProjectDialog() {
  const dialog=document.createElement('dialog');dialog.className='work-dialog';dialog.setAttribute('aria-labelledby','work-title');
  dialog.innerHTML='<button class="work-close" aria-label="关闭作品详情" autofocus>×</button><div class="work-art"><img hidden alt="作品封面"/><span>SELECTED WORK<br/><b>灵感，有迹可循。</b></span></div><div class="work-body"><span class="work-eyebrow">PROJECT / 作品详情</span><h2 id="work-title"></h2><p class="work-description"></p><p class="work-tags"></p><a class="work-visit" target="_blank" rel="noopener noreferrer">访问项目 <span>↗</span></a><small class="work-domain"></small></div>';
  document.body.append(dialog);dialog.querySelector('button')!.onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
  return {open(work:Work){
    dialog.querySelector('h2')!.textContent=work.title;dialog.querySelector('.work-description')!.textContent=work.description||'访问项目，了解完整作品。';dialog.querySelector('.work-tags')!.textContent=work.tags;
    const image=dialog.querySelector('img')!;image.hidden=!work.cover;if(work.cover)image.src=work.cover;else image.removeAttribute('src');
    (dialog.querySelector('.work-art>span') as HTMLElement).hidden=!!work.cover;
    dialog.querySelector<HTMLAnchorElement>('a')!.href=work.url;dialog.querySelector('.work-domain')!.textContent=new URL(work.url).host+' · 在新标签页打开';
    if(!dialog.open)dialog.showModal();
  },destroy(){dialog.remove();}};
}
