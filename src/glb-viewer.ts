import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './viewer.css';
import { parseFilmProject } from './film-model';
import { preparePhotos } from './photos';
import { attachGLBPortfolio } from './glb-portfolio';
import { createProjectDialog } from './project-dialog';
import { emptyPortfolio, type Portfolio } from './portfolio-model';

document.querySelector('#app')!.innerHTML=`<main class="reuse-page"><header><a href="?workspace=room">← 返回布置书房</a><a href="?workspace=integration">网页驱动示例 →</a></header><h1>从你的作品，到下一个产品。</h1><p>独立使用 Three.js GLTFLoader 打开实际 GLB 文件。这里不调用书房建模代码；光照与后期不同，观感会有差异。</p><div class="viewer-toolbar"><label class="viewer-upload">打开 GLB <input id="glb-file" type="file" accept=".glb,model/gltf-binary"/></label><button class="viewer-upload" id="glb-reset">恢复视角</button><span>左键旋转 · 滚轮缩放 · 右键平移</span></div><div id="glb-stage"><span id="glb-empty">将刚刚导出的整屋或单件 GLB 打开，检查模型与照片。</span></div><p id="glb-info" role="status">文件仅在当前浏览器读取，不上传。</p></main>`;
const host=document.querySelector<HTMLElement>('#glb-stage')!,info=document.querySelector('#glb-info')!;
const projectLabel=document.createElement('label');projectLabel.className='viewer-upload';projectLabel.innerHTML='关联工程 JSON <input id="glb-project" type="file" accept=".json,application/json"/>';
document.querySelector('.viewer-toolbar')!.append(projectLabel);const workStatus=document.createElement('p');workStatus.id='glb-work-status';workStatus.setAttribute('role','status');workStatus.textContent='可同时打开 GLB 与对应工程 JSON，点击模型里的书籍和屏幕。';info.after(workStatus);
const detail=createProjectDialog();
try {
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;host.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#eeede7');scene.add(new T.HemisphereLight('#eaf2ef','#b8a48c',1.8));
  const fill=new T.DirectionalLight('#fff5df',2.2);fill.position.set(3,6,5);scene.add(fill);
  const camera=new T.PerspectiveCamera(38,1,.01,300),controls=new OrbitControls(camera,renderer.domElement);let root:T.Group|undefined,dirty=true;
  let portfolio:Portfolio=emptyPortfolio(),hotspots:ReturnType<typeof attachGLBPortfolio>|undefined;
  function connect(){hotspots?.destroy();if(!root)return;hotspots=attachGLBPortfolio(host,root,camera,renderer.domElement,controls,portfolio,e=>detail.open(e.project));workStatus.textContent=portfolio.bindings.length?`已关联 ${hotspots.matched} 个作品入口${hotspots.missing?`；${hotspots.missing} 个入口不在当前模型中`:''}。点击标记或模型查看。`:'模型已载入；打开对应工程 JSON 可恢复作品交互。';}
  document.querySelector('#glb-project')!.addEventListener('change',async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>6*1024*1024)throw new Error('请选择 6 MB 以内的工程 JSON。');const p=parseFilmProject(JSON.parse(await file.text())).project;await preparePhotos(p.scene);portfolio=p.scene.portfolio;connect();workStatus.className='';if(!root)workStatus.textContent='工程已就绪，请打开对应 GLB。';}catch(error){workStatus.textContent=(error as Error).message;workStatus.className='error';}});
  const invalidate=()=>dirty=true;controls.addEventListener('change',invalidate);
  const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);invalidate();};new ResizeObserver(resize).observe(host);resize();
  const frame=()=>{requestAnimationFrame(frame);if(dirty&&!document.hidden){dirty=false;renderer.render(scene,camera);}};frame();
  function reset(){if(!root)return;const box=new T.Box3().setFromObject(root),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),r=Math.max(size.x,size.y,size.z)*1.55;camera.position.copy(center).add(new T.Vector3(r*.76,r*.65,r));controls.target.copy(center);controls.update();invalidate();}
  document.querySelector('#glb-reset')!.addEventListener('click',reset);
  const manager=new T.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('查看器只接受贴图嵌入文件的 GLB，不加载外部资源。');});
  const loader=new GLTFLoader(manager);
  document.querySelector('#glb-file')!.addEventListener('change',async e=>{
    const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
    try {
      info.className='';info.textContent='正在解码模型与贴图…';
      if(file.size>60*1024*1024)throw new Error('请选择 60 MB 以内的 GLB。');
      const bytes=await file.arrayBuffer(),header=new DataView(bytes);
      if(bytes.byteLength<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength)throw new Error('不是有效的 GLB 2.0 文件，当前模型保持不变。');
      const result=await loader.parseAsync(bytes,'');let meshes=0,triangles=0,textures=0;const maps=new Set<T.Texture>();
      result.scene.traverse(o=>{if(o instanceof T.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)maps.add(m.map);}});textures=maps.size;
      if(!meshes)throw new Error('文件没有可显示的网格，当前模型保持不变。');
      if(root){scene.remove(root);const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
      root=result.scene;scene.add(root);reset();document.querySelector<HTMLElement>('#glb-empty')!.hidden=true;document.querySelector<HTMLElement>('#glb-empty')!.style.display='none';
      connect();
      const bounds=new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray();
      info.textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB\n${meshes} 个网格 · ${Math.round(triangles).toLocaleString()} 三角形 · ${textures} 张贴图\n包围尺寸 ${bounds.map(n=>n.toFixed(2)).join(' × ')} m`;
      document.documentElement.dataset.loaded='true';
      const parts:string[]=[];root.traverse(o=>{if(o.userData.partId)parts.push(o.userData.partId);});
      Object.defineProperty(window,'__glb',{value:{name:file.name,meshes,triangles,textures,bounds,nodes:root.children.map(o=>o.name),parts},configurable:true});
    }catch(error){info.textContent=(error as Error).message;info.className='error';}
  });
  document.documentElement.dataset.ready='true';
}catch(error){info.textContent='无法创建 3D 查看器：'+(error as Error).message;info.className='error';document.documentElement.dataset.ready='error';}
