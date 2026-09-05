import { deleteProject, listVersions, type ProjectRecord } from './project-store';

export async function confirmProjectDeletion(record:ProjectRecord,backup:()=>void,onDeleted:()=>Promise<void>){
  const versions=await listVersions(record.id),focus=document.activeElement as HTMLElement;
  const dialog=document.createElement('dialog');dialog.className='project-manager-dialog project-delete-dialog';dialog.setAttribute('aria-labelledby','project-delete-title');dialog.setAttribute('aria-describedby','project-delete-note');
  dialog.innerHTML='<span class="project-overline">MANAGE YOUR COLLECTION</span><h2 id="project-delete-title">删除这套工程？</h2><strong class="project-delete-name"></strong><p id="project-delete-note" class="project-dialog-note"></p><p class="project-dialog-note">此操作无法撤销，也没有回收站。其他工程、快速工作区存档和已发布的网站不受影响。</p><button type="button" class="project-action" id="project-delete-backup">先备份当前工程 JSON ↓</button><p class="project-dialog-note">JSON 保留当前房间、镜头与作品配置，不包含历史版本。</p><p class="project-feedback" role="status" aria-live="polite"></p><button type="button" class="project-action" id="project-delete-cancel" autofocus>取消，保留工程</button><button type="button" class="project-action danger" id="project-delete-confirm">确认删除工程及全部版本</button>';
  dialog.querySelector('.project-delete-name')!.textContent=record.project.name;
  dialog.querySelector('#project-delete-note')!.textContent=`将从当前浏览器删除这套工程及其 ${versions.length} 个保存版本（当前版本 ${record.revision}）。`;
  const feedback=dialog.querySelector('.project-feedback')!;let busy=false,deleted=false;
  dialog.querySelector('#project-delete-cancel')!.addEventListener('click',()=>dialog.close());
  dialog.querySelector('#project-delete-backup')!.addEventListener('click',()=>{backup();feedback.textContent='当前工程 JSON 已交给浏览器下载，请确认文件已保存。';});
  dialog.querySelector<HTMLButtonElement>('#project-delete-confirm')!.onclick=async()=>{
    if(busy)return;busy=true;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);feedback.textContent='正在删除工程与保存版本…';
    try{await deleteProject(record.id,record.revision);deleted=true;}catch(error){feedback.textContent='删除未完成：'+(error as Error).message;}
    busy=false;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=false);
    if(deleted){dialog.close();await onDeleted();document.querySelector<HTMLButtonElement>('#project-new')?.focus();}
  };
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();if(!deleted)focus?.focus();},{once:true});document.body.append(dialog);dialog.showModal();
}
