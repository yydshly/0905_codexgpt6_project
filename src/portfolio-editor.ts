import type { Plan, Item } from './model';
import { partFor, targetLabel, sameTarget, parsePortfolio, type Work, type Portfolio, type ContentTarget } from './portfolio-model';
import { readPhoto } from './photos';
import './portfolio.css';

export function mountPortfolioEditor(parent:HTMLElement,item:Item,getPlan:()=>Plan,commit:(p:Portfolio)=>void){
  const partId=partFor(item);if(!partId)return;
  const target:ContentTarget={itemId:item.id,partId},p=getPlan().portfolio,binding=p.bindings.find(b=>sameTarget(b.target,target)),work=p.projects.find(w=>w.id===binding?.projectId);
  const section=document.createElement('section');section.className='portfolio-binding';section.innerHTML='<strong></strong><p></p><button type="button" id="configure-work"></button>';
  section.querySelector('strong')!.textContent=targetLabel(target)+' · 作品入口';section.querySelector('p')!.textContent=work?`已关联「${work.title}」`:'将这里变成你的作品入口。访客点击后可查看详情、访问项目。';section.querySelector('button')!.textContent=work?'编辑作品关联':'关联我的作品';parent.querySelector('.dimensions')!.after(section);
  section.querySelector('button')!.onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='portfolio-config';dialog.setAttribute('aria-labelledby','config-title');
    dialog.innerHTML='<form><h2 id="config-title">让物件，讲述你的作品。</h2><p class="config-note"></p><label>选择作品<select id="work-choice" aria-label="选择作品"></select></label><label>项目名称<input id="work-name" required maxlength="60" /></label><label>项目简介<textarea id="work-description" maxlength="600" rows="3"></textarea></label><label>技术栈 / 标签<input id="work-tags" maxlength="120" placeholder="例如：Three.js / 交互设计" /></label><label>项目链接<input id="work-url" required type="url" maxlength="2048" placeholder="https://…" /></label><label>作品封面（可选）<input id="work-cover" type="file" accept="image/jpeg,image/png,image/webp" /></label><div class="config-cover"><img hidden alt="作品封面预览"/><button type="button" id="clear-work-cover" hidden>移除封面</button></div><p class="config-error" role="status" aria-live="polite"></p><div class="config-actions"><button type="button" id="unlink-work">取消关联</button><button type="button" id="cancel-work">返回</button><button type="submit" id="apply-work">应用关联</button></div></form>';
    const $=<T extends HTMLElement=HTMLElement>(s:string)=>dialog.querySelector<T>(s)!;
    $('.config-note').textContent=`${targetLabel(target)} · 应用后可通过顶部「作品展示」预览。封面随工程保存；修改已有作品会同步到它的其他入口。`;
    const choice=$<HTMLSelectElement>('#work-choice');choice.add(new Option('新建作品',''));getPlan().portfolio.projects.forEach(w=>choice.add(new Option(w.title,w.id)));
    let cover:string|undefined,processing=false,revision=0;
    function coverPreview(){const img=$<HTMLImageElement>('.config-cover img');img.hidden=!cover;if(cover)img.src=cover;else img.removeAttribute('src');$('#clear-work-cover').hidden=!cover;}
    function load(w?:Work){revision++;processing=false;$<HTMLButtonElement>('#apply-work').disabled=false;$<HTMLInputElement>('#work-name').value=w?.title??'';$<HTMLInputElement>('#work-url').value=w?.url??'';$<HTMLTextAreaElement>('#work-description').value=w?.description??'';$<HTMLInputElement>('#work-tags').value=w?.tags??'';cover=w?.cover;coverPreview();$('.config-error').textContent='';}
    choice.value=work?.id??'';load(work);choice.onchange=()=>load(getPlan().portfolio.projects.find(w=>w.id===choice.value));
    $('#clear-work-cover').onclick=()=>{revision++;processing=false;$<HTMLButtonElement>('#apply-work').disabled=false;cover=undefined;coverPreview();};
    $('#work-cover').onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;const token=++revision;processing=true;$<HTMLButtonElement>('#apply-work').disabled=true;$('.config-error').textContent='正在处理封面…';try{const data=await readPhoto(file);if(token===revision){cover=data;coverPreview();$('.config-error').textContent='';}}catch(error){if(token===revision)$('.config-error').textContent=(error as Error).message;}finally{if(token===revision){processing=false;$<HTMLButtonElement>('#apply-work').disabled=false;}}};
    function close(){dialog.close();}
    $('#cancel-work').onclick=close;$('#unlink-work').hidden=!binding;
    $('#unlink-work').onclick=()=>{const next=structuredClone(getPlan().portfolio);next.bindings=next.bindings.filter(b=>!sameTarget(b.target,target));commit(next);close();};
    dialog.querySelector('form')!.onsubmit=e=>{e.preventDefault();if(processing)return;try{
      const next=structuredClone(getPlan().portfolio),id=choice.value||'work-'+crypto.randomUUID();
      const value:Work={id,title:$<HTMLInputElement>('#work-name').value,description:$<HTMLTextAreaElement>('#work-description').value,tags:$<HTMLInputElement>('#work-tags').value,url:$<HTMLInputElement>('#work-url').value,...(cover?{cover}:{})};
      const index=next.projects.findIndex(w=>w.id===id);if(index<0)next.projects.push(value);else next.projects[index]=value;
      next.bindings=next.bindings.filter(b=>!sameTarget(b.target,target));next.bindings.push({target,projectId:id,action:'openProject'});
      commit(parsePortfolio(next,getPlan().objects));close();
    }catch(error){$('.config-error').textContent=(error as Error).message;}};
    dialog.addEventListener('close',()=>{revision++;dialog.remove();parent.querySelector<HTMLElement>('#configure-work')?.focus({preventScroll:true});},{once:true});
    document.body.append(dialog);dialog.showModal();
  };
}
