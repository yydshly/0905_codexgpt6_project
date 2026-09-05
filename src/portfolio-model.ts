import type { Item, Plan } from './model';

export interface Work { id:string; title:string; description:string; tags:string; url:string; cover?:string }
export interface ContentTarget { itemId:string; partId:'book-1'|'screen' }
export interface Binding { target:ContentTarget; projectId:string; action:'openProject' }
export interface Portfolio { version:1; projects:Work[]; bindings:Binding[] }
export interface WorkActivation { target:ContentTarget; project:Work; action:'openProject' }
export const emptyPortfolio=():Portfolio=>({version:1,projects:[],bindings:[]});
export const targetKey=(t:ContentTarget)=>`${t.itemId}/${t.partId}`;
export const partFor=(item:Item)=>item.kind==='desk'?'book-1':item.kind==='monitor'?'screen':null;
export const targetLabel=(t:ContentTarget)=>t.partId==='book-1'?'桌面书籍':'显示器屏幕';
export const sameTarget=(a:ContentTarget,b:ContentTarget)=>targetKey(a)===targetKey(b);
export function boundWorks(p:Portfolio){return p.projects.filter(w=>p.bindings.some(b=>b.projectId===w.id));}
export function activation(p:Portfolio,t:ContentTarget):WorkActivation|null {
  const b=p.bindings.find(b=>sameTarget(b.target,t)),w=p.projects.find(w=>w.id===b?.projectId);
  return w?{target:{...t},project:structuredClone(w),action:'openProject'}:null;
}
export function safeProjectURL(value:string) {
  if(value.length>2048)throw new Error('项目链接过长。');
  let url:URL;try{url=new URL(value);}catch{throw new Error('请输入完整的 http:// 或 https:// 项目链接。');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('项目链接须为不含登录凭据的 HTTP(S) 地址。');
  return url.href;
}
export function parsePortfolio(raw:unknown,objects:Item[]):Portfolio {
  const p=raw as Portfolio,fail=()=>{throw new Error('作品配置无效，当前工程未更改。');};
  if(!p||p.version!==1||!Array.isArray(p.projects)||p.projects.length>12||!Array.isArray(p.bindings)||p.bindings.length>40)return fail();
  const ids=new Set<string>(),targets=new Set<string>();
  const projects=p.projects.map(w=>{
    if(!w||typeof w.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(w.id)||ids.has(w.id)||typeof w.title!=='string'||!w.title.trim()||w.title.length>60||typeof w.description!=='string'||w.description.length>600||typeof w.tags!=='string'||w.tags.length>120||typeof w.url!=='string')return fail();
    if(w.cover!==undefined&&(typeof w.cover!=='string'||w.cover.length>450000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(w.cover)))return fail();
    ids.add(w.id);return {id:w.id,title:w.title.trim(),description:w.description.trim(),tags:w.tags.trim(),url:safeProjectURL(w.url),...(w.cover?{cover:w.cover}:{})};
  });
  const bindings=p.bindings.map(b=>{
    const t=b?.target,item=objects.find(o=>o.id===t?.itemId);
    if(!item||!t||partFor(item)!==t.partId||!ids.has(b.projectId)||b.action!=='openProject'||targets.has(targetKey(t)))return fail();
    targets.add(targetKey(t));return {target:{itemId:t.itemId,partId:t.partId},projectId:b.projectId,action:'openProject' as const};
  });
  return {version:1,projects,bindings};
}
export function removeMissingBindings(plan:Plan){plan.portfolio.bindings=plan.portfolio.bindings.filter(b=>plan.objects.some(o=>o.id===b.target.itemId&&partFor(o)===b.target.partId));}

/** Opt-in sample, never inserted into an imported/saved personal room. */
export function demoPortfolio(objects:Item[]):Portfolio {
  const desk=objects.find(o=>o.kind==='desk'),monitor=objects.find(o=>o.kind==='monitor');
  return {version:1,projects:[
    {id:'study-source',title:'理想书房 · 开源创作',description:'一间可布置、可保存、可带走的 3D 书房。此示例关联本项目的真实 GitHub 仓库；你可以将它替换为自己的作品。',tags:'Three.js / TypeScript / 空间设计',url:'https://github.com/yydshly/0905_codexgpt6_project'},
    {id:'study-live',title:'让空间，成为作品',description:'从一张书桌开始，布置属于自己的创作空间。此示例链接打开已发布的原版书房编辑器。',tags:'WebGL / 交互设计 / 在线体验',url:'https://yydshly.github.io/0905_codexgpt6_project/'}
  ],bindings:[...(desk?[{target:{itemId:desk.id,partId:'book-1' as const},projectId:'study-source',action:'openProject' as const}]:[]),...(monitor?[{target:{itemId:monitor.id,partId:'screen' as const},projectId:'study-live',action:'openProject' as const}]:[])]};
}
