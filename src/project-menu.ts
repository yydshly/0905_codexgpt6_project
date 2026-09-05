import { createProject, projectURL } from './project-store';
import type { FilmProject } from './film-model';
import './projects.css';
export function mountProjectMenu(options:{host:HTMLElement;getProject:()=>FilmProject;save:()=>Promise<boolean>;thumbnail:()=>string|undefined;beforeOpen?:()=>void;leave:()=>void;id?:string;workspace:'room'|'film'|'portfolio'}){
  const button=document.createElement('button');button.id='project-library';button.className='project-library-button';button.textContent='我的工程';button.title='切换工程、另存为和查看保存版本';options.host.append(button);
  button.onclick=()=>{
    (document.activeElement as HTMLElement)?.blur();options.beforeOpen?.();
    const dialog=document.createElement('dialog');dialog.className='project-manager-dialog';dialog.setAttribute('aria-labelledby','project-menu-title');
    dialog.innerHTML='<form><span class="project-overline">YOUR COLLECTION</span><h2 id="project-menu-title">每一份灵感，都有自己的位置。</h2><p class="project-dialog-note">当前工程</p><strong id="project-current-name"></strong><p class="project-dialog-note">返回工程库前会先保存当前修改。另存为会带走当前画面与配置，原工程保持原样。</p><button type="button" id="projects-open" class="project-action primary">保存并返回工程库 ↗</button><button type="button" id="project-versions" class="project-action">查看保存版本</button><label>新工程名称<input id="project-copy-name" maxlength="48" required /></label><button type="submit" id="project-save-as" class="project-action">另存为新工程</button><p class="project-feedback" role="status" aria-live="polite"></p><button type="button" id="project-menu-close" class="project-action quiet">继续编辑</button></form>';
    const $=<T extends HTMLElement=HTMLElement>(s:string)=>dialog.querySelector<T>(s)!;
    $('#project-current-name').textContent=options.getProject().name;$<HTMLInputElement>('#project-copy-name').value=(options.getProject().name.slice(0,43)+' · 副本');$('#project-versions').hidden=!options.id;
    let busy=false;const run=async(action:()=>Promise<void>)=>{if(busy)return;busy=true;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);$('.project-feedback').textContent='正在保存，请稍候…';try{await action();}catch(error){$('.project-feedback').textContent=(error as Error).message;}finally{busy=false;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);}};
    $('#projects-open').onclick=()=>void run(async()=>{if(!await options.save())throw new Error('保存未完成，请继续编辑查看错误，或另存为新工程。');options.leave();location.href='?workspace=projects';});
    $('#project-versions').onclick=()=>void run(async()=>{if(!await options.save())throw new Error('保存未完成；当前修改仍在编辑器中。');options.leave();location.href='?workspace=projects&history='+encodeURIComponent(options.id!);});
    dialog.querySelector('form')!.onsubmit=e=>{e.preventDefault();void run(async()=>{const name=$<HTMLInputElement>('#project-copy-name').value.trim();if(!name)throw new Error('请填写新工程名称。');const project=structuredClone(options.getProject());project.name=name;project.scene.name=name;let thumbnail:string|undefined;try{thumbnail=options.thumbnail();}catch{}const next=await createProject(project,thumbnail,'另存为新工程');options.leave();location.href=projectURL(options.workspace,next.id);});};
    $('#project-menu-close').onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();button.focus();},{once:true});document.body.append(dialog);dialog.showModal();
  };
}
