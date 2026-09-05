import { zip, strToU8 } from 'fflate';
import { parseFilmProject, type FilmProject } from './film-model';
import { MAX_JSON_BYTES } from './model';
import { preparePhotos } from './photos';

export async function createSitePackage(raw:FilmProject){
  const project=parseFilmProject(raw).project;await preparePhotos(project.scene);
  // Only reachable works belong to the public page; unlinked drafts stay in the author project.
  project.scene.selectedId=null;project.playhead=0;
  project.scene.portfolio.projects=project.scene.portfolio.projects.filter(w=>project.scene.portfolio.bindings.some(b=>b.projectId===w.id));
  const json=JSON.stringify(project,null,2);if(strToU8(json).length>MAX_JSON_BYTES)throw new Error('发布工程超过 6 MB，请减少封面或照片。');
  const base=import.meta.env.BASE_URL+'site-kit/';
  const response=await fetch(base+'manifest.json',{cache:'no-cache'});if(!response.ok)throw new Error('发布模板暂不可用，请重新启动开发服务或重新构建。');
  const manifest=await response.json();if(manifest.version!==1||!Array.isArray(manifest.files))throw new Error('发布模板版本无效，请重新构建。');
  const files:Record<string,Uint8Array>={'project.json':strToU8(json),'.nojekyll':new Uint8Array()};
  await Promise.all(manifest.files.map(async(name:string)=>{if(!['index.html','assets/site.js','assets/site.css','LICENSES.txt'].includes(name))throw new Error('发布模板包含未知文件。');const r=await fetch(base+name,{cache:'no-cache'});if(!r.ok)throw new Error('发布文件加载失败：'+name);files[name]=new Uint8Array(await r.arrayBuffer());}));
  if(!files['index.html']||!files['assets/site.js']||!files['assets/site.css'])throw new Error('发布模板不完整。');
  const title=project.scene.portfolio.presentation.name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  files['index.html']=strToU8(new TextDecoder().decode(files['index.html']).replace('<title>个人作品</title>','<title>'+title+' · 个人作品</title>'));
  files['部署说明.txt']=strToU8('这是可独立部署的个人 3D 展示页，包含你当前的房间、照片、已关联作品和镜头。无需编辑器或作者浏览器存档。\n\n本机检查：解压后在目录运行 npx http-server -p 8080，用浏览器打开 http://127.0.0.1:8080/；也可使用 Python 的 python -m http.server 8080。不要双击 index.html。\n\nGitHub Pages：将 index.html、project.json、assets 文件夹及 .nojekyll 放入自己的静态网站仓库。Settings → Pages → Deploy from a branch → 选择对应分支和 /(root) → Save。也可通过已有 Pages Actions 上传该目录。无需 Node 构建，根路径和仓库子路径都支持。\n\n更新：重新配置并下载网站包，替换网站文件后重新部署。项目链接在新标签页打开。此包不是云同步；访客无法修改作者存档。服务器上的 JSON、照片和链接是公开内容，只发布你愿意公开的作品。仅打包有入口的作品；未关联草稿不会带出。\n\n许可见 LICENSES.txt。\n');
  const bytes=await new Promise<Uint8Array<ArrayBuffer>>((resolve,reject)=>zip(files,{level:6},(error,result)=>error?reject(error):resolve(result)));
  return new Blob([bytes],{type:'application/zip'});
}
