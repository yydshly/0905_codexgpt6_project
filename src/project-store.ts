import { parseFilmProject, projectSignature, type FilmProject } from './film-model';
import { MAX_JSON_BYTES, ROOM_STORAGE } from './model';

export const PROJECT_DB='ideal-study.projects';
export interface ProjectRecord { schemaVersion:1; id:string; revision:number; createdAt:string; updatedAt:string; project:FilmProject; thumbnail?:string }
export interface ProjectVersion { projectId:string; revision:number; savedAt:string; label:string; project:FilmProject; thumbnail?:string }
let connection:Promise<IDBDatabase>|undefined;
const storageError=(error:unknown)=>error instanceof Error&&error.name==='QuotaExceededError'?new Error('浏览器空间不足，保存未完成。请先导出 JSON 备份，原工程和版本仍保留。'):error instanceof Error?error:new Error('本地工程库不可用，请重试或导出 JSON 备份。');
function database(){
  return connection??=new Promise<IDBDatabase>((resolve,reject)=>{
    let request:IDBOpenDBRequest;try{request=indexedDB.open(PROJECT_DB,1);}catch(error){reject(storageError(error));return;}
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('projects',{keyPath:'id'});const versions=db.createObjectStore('versions',{keyPath:['projectId','revision']});versions.createIndex('projectId','projectId');db.createObjectStore('meta');};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
    request.onerror=()=>{connection=undefined;reject(storageError(request.error));};
    request.onblocked=()=>{connection=undefined;reject(new Error('工程库升级被其他页面占用，请关闭旧版标签页后重试。'));};
  });
}
function result<T>(request:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(storageError(request.error));});}
function complete(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(storageError(tx.error));tx.onerror=()=>{};});}
function checked(project:FilmProject){const value=parseFilmProject(project).project;if(new Blob([JSON.stringify(value)]).size>MAX_JSON_BYTES)throw new Error('工程超过 6 MB，请精简图片后保存。');return value;}
function thumb(value?:string){return value&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)&&value.length<200000?value:undefined;}
function makeRecord(project:FilmProject,thumbnail?:string):ProjectRecord{const now=new Date().toISOString();return {schemaVersion:1,id:crypto.randomUUID(),revision:1,createdAt:now,updatedAt:now,project:checked(project),...(thumb(thumbnail)?{thumbnail}:{} )};}
const version=(record:ProjectRecord,label:string):ProjectVersion=>({projectId:record.id,revision:record.revision,savedAt:record.updatedAt,label,project:record.project,...(record.thumbnail?{thumbnail:record.thumbnail}:{})});
export async function listProjects(){const db=await database();return (await result<ProjectRecord[]>(db.transaction('projects').objectStore('projects').getAll())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function getProject(id:string){const db=await database(),record=await result<ProjectRecord|undefined>(db.transaction('projects').objectStore('projects').get(id));if(!record)throw new Error('找不到这套工程，请返回「我的工程」重新选择。');checked(record.project);return record;}
export async function createProject(project:FilmProject,thumbnail?:string,label='创建工程'){
  const record=makeRecord(project,thumbnail),db=await database(),tx=db.transaction(['projects','versions'],'readwrite'),done=complete(tx);
  tx.objectStore('projects').add(record);tx.objectStore('versions').add(version(record,label));await done;return record;
}
export async function saveProject(id:string,expectedRevision:number,project:FilmProject,thumbnail?:string,label='手动保存'){
  const value=checked(project),db=await database(),tx=db.transaction(['projects','versions'],'readwrite'),done=complete(tx);let saved:ProjectRecord|undefined,conflict:Error|undefined;
  const request=tx.objectStore('projects').get(id);
  request.onsuccess=()=>{
    const old=request.result as ProjectRecord|undefined;
    if(!old||old.revision!==expectedRevision){conflict=new Error('这套工程已在另一个页面更新。请另存为新工程保留当前修改，或重新打开最新版本。');tx.abort();return;}
    const changed=projectSignature(old.project)!==projectSignature(value)||label.startsWith('恢复');
    saved={...old,project:value,thumbnail:thumb(thumbnail)??(JSON.stringify(old.project.scene)===JSON.stringify(value.scene)?old.thumbnail:undefined),...(changed?{revision:old.revision+1,updatedAt:new Date().toISOString()}:{})};
    tx.objectStore('projects').put(saved);if(changed)tx.objectStore('versions').add(version(saved,label));
  };
  try{await done;}catch(error){throw conflict??error;}return saved!;
}
export async function setProjectThumbnail(id:string,revision:number,thumbnail:string){
  if(!thumb(thumbnail))return;const db=await database(),tx=db.transaction('projects','readwrite'),done=complete(tx),request=tx.objectStore('projects').get(id);
  request.onsuccess=()=>{const record=request.result as ProjectRecord|undefined;if(record?.revision===revision&&!record.thumbnail)tx.objectStore('projects').put({...record,thumbnail});};await done;
}
export async function listVersions(id:string){const db=await database();return (await result<ProjectVersion[]>(db.transaction('versions').objectStore('versions').index('projectId').getAll(id))).sort((a,b)=>b.revision-a.revision);}
export async function restoreVersion(id:string,expectedRevision:number,revision:number){const db=await database(),old=await result<ProjectVersion|undefined>(db.transaction('versions').objectStore('versions').get([id,revision]));if(!old)throw new Error('这个保存版本不存在，当前工程未更改。');return saveProject(id,expectedRevision,old.project,old.thumbnail,`恢复版本 ${revision}`);}
export async function migrateLegacyProjects(){
  const notes:string[]=[];
  for(const [source,keys,field] of [['room',[ROOM_STORAGE,'ideal-study.plan.v2','ideal-study.plan.v1'],'plan'],['film',['ideal-study.film.v4','ideal-study.film.v3','ideal-study.film.v2'],'project']] as const){
    try{
      const raw=keys.map(key=>localStorage.getItem(key)).find(Boolean);if(!raw)continue;
      const parsed=JSON.parse(raw),record=makeRecord(parseFilmProject(parsed[field]).project);
      if(source==='room')record.project.name=record.project.scene.name;
      const db=await database(),tx=db.transaction(['projects','versions','meta'],'readwrite'),done=complete(tx),key='legacy-'+source,request=tx.objectStore('meta').get(key);let migrated=false;
      const signature=projectSignature(record.project);
      request.onsuccess=()=>{if(request.result?.signature===signature)return;tx.objectStore('projects').add(record);tx.objectStore('versions').add(version(record,request.result?'迁入快速工作区新保存':'迁入原有存档'));tx.objectStore('meta').put({id:record.id,signature},key);migrated=true;};
      await done;if(migrated)notes.push(`已迁入原${source==='room'?'书房':'短片'}存档，原存档保留。`);
    }catch(error){notes.push(`原${source==='room'?'书房':'短片'}存档未迁入：${(error as Error).message} 原始数据未更改。`);}
  }
  return notes;
}
export const projectURL=(workspace:'room'|'film'|'portfolio',id:string)=>`?workspace=${workspace}&id=${encodeURIComponent(id)}`;
