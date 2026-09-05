import type { StudyScene } from './scene';
import type { ProjectRecord } from './project-store';
import { preparePhotos } from './photos';
export function captureThumbnail(scene?:StudyScene){
  if(!scene)return undefined;
  const session=scene.captureSession(480,300);
  try{return session.render(scene.getCamera()).toDataURL('image/jpeg',.78);}finally{session.close();}
}
export async function renderMissingThumbnails(records:ProjectRecord[],accept:(record:ProjectRecord,url:string)=>Promise<void>){
  if(!records.length)return;
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:480px;height:300px;pointer-events:none';host.setAttribute('aria-hidden','true');document.body.append(host);
  let scene:StudyScene|undefined;
  try{const {StudyScene}=await import('./scene');scene=new StudyScene(host,{select:()=>{},begin:()=>{},move:()=>{},end:()=>{},camera:()=>{},error:()=>{}});scene.setInteractionEnabled(false);
    for(const record of records){await preparePhotos(record.project.scene);scene.sync({...record.project.scene,selectedId:null});scene.applyCamera(record.project.scene.camera);const url=captureThumbnail(scene);if(url)await accept(record,url);await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }finally{scene?.destroy();host.remove();}
}
