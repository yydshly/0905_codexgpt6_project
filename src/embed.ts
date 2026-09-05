import { createStudyPlayer } from './player';
import './viewer.css';

// For a different parent domain, add that exact production origin here before building.
const allowedParentOrigins=new Set([location.origin]);
document.querySelector('#app')!.innerHTML='<div id="embed-stage"><span id="embed-status" role="status">正在构建可复用书房…</span></div>';
try {
  const player=await createStudyPlayer(document.querySelector('#embed-stage')!);
  document.querySelector('#embed-status')!.remove();document.documentElement.dataset.ready='true';
  window.addEventListener('message',async e=>{
    if(e.source!==parent||!allowedParentOrigins.has(e.origin)||!e.data||e.data.channel!=='ideal-study'||e.data.version!==1||typeof e.data.id!=='string'||e.data.id.length>100)return;
    const {id,command,payload}=e.data;
    try {
      switch(command){
        case 'loadProject':await player.loadProject(payload);break;
        case 'setMood':player.setMood(payload);break;
        case 'setMaterial':player.setMaterial(payload?.id,payload?.material);break;
        case 'seek':player.seek(payload);break;
        case 'play':player.play();break;
        case 'pause':player.pause();break;
        case 'getState':break;
        default:throw new Error('不支持的播放器指令。');
      }
      parent.postMessage({channel:'ideal-study',version:1,id,ok:true,state:player.getState(),project:player.getProject()},e.origin);
    }catch(error){parent.postMessage({channel:'ideal-study',version:1,id,ok:false,error:(error as Error).message},e.origin);}
  });
  window.addEventListener('pagehide',()=>player.destroy(),{once:true});
}catch(error){document.querySelector('#embed-status')!.textContent=(error as Error).message;document.documentElement.dataset.ready='error';}
