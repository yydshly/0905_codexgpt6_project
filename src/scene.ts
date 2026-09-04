import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createFurniture, createRoom, thumbCamera } from './geometry';
import { CATALOG, DEFAULT_CAMERA, type Plan, type Kind, type CameraState, type Item } from './model';

export interface SceneCallbacks { select(id:string|null):void; begin():void; move(id:string,x:number,z:number):void; end():void; camera():void; error(message:string):void }
export class StudyScene {
  scene=new T.Scene();
  camera=new T.OrthographicCamera(-4,4,3.5,-3.5,.1,100);
  renderer:T.WebGLRenderer;
  controls:OrbitControls;
  composer:EffectComposer;
  ao:SSAOPass;
  groups=new Map<string,T.Group>();
  selection=new T.Group();
  mode:'edit'|'orbit'='edit';
  plan!:Plan;
  private ray=new T.Raycaster();
  private pointer=new T.Vector2();
  private drag:{id:string,startX:number,startY:number,offset:T.Vector3,y:number,moved:boolean}|null=null;
  private dirty=true;
  private sun=new T.DirectionalLight('#fff4de',3.1);
  private ambient=new T.HemisphereLight('#eaf2ef','#b8a48c',2.0);
  private fill=new T.DirectionalLight('#eef3fa',1.3);
  private room:T.Group;
  private frame=0;
  metrics={ renderTimes:[] as number[], renders:0, calls:0, triangles:0 };
  constructor(private host:HTMLElement, private cb:SceneCallbacks) {
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.info.autoReset=false;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.domElement.setAttribute('aria-label','可编辑的三维书房');this.renderer.domElement.tabIndex=0;host.append(this.renderer.domElement);
    this.scene.background=new T.Color('#eeede7');this.room=createRoom(this.scene);this.scene.add(this.ambient,this.sun,this.fill);
    this.sun.position.set(-3.7,5.6,3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-5,right:5,top:6,bottom:-5,near:.5,far:18});this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=3;
    this.fill.position.set(3,4,5);
    this.scene.add(this.selection);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.ao=new SSAOPass(this.scene,this.camera,host.clientWidth,host.clientHeight);this.ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA=0;this.ao.depthRenderMaterial.defines.PERSPECTIVE_CAMERA=0;this.ao.kernelRadius=.28;this.ao.minDistance=.0001;this.ao.maxDistance=.004;this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());this.composer.addPass(new SMAAPass());
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=false;this.controls.enablePan=false;this.controls.minPolarAngle=.05;this.controls.maxPolarAngle=1.43;this.controls.minAzimuthAngle=-.48;this.controls.maxAzimuthAngle=2.02;this.controls.minZoom=.55;this.controls.maxZoom=2.4;this.controls.mouseButtons={LEFT:null as unknown as T.MOUSE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};
    this.controls.addEventListener('change',()=>{this.invalidate();this.cb.camera();});
    this.applyCamera(DEFAULT_CAMERA);
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',this.pointerDown);
    canvas.addEventListener('pointermove',this.pointerMove);
    canvas.addEventListener('pointerup',this.pointerUp);
    canvas.addEventListener('pointercancel',this.pointerUp);
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.cb.error('图形上下文已中断。请先导出 JSON 备份，再刷新页面恢复。');});
    new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.loop();
  }
  private loop=()=>{this.frame=requestAnimationFrame(this.loop);if(this.dirty&&!document.hidden){this.dirty=false;this.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);this.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);const t=performance.now();this.renderer.info.reset();this.composer.render();this.metrics.renderTimes.push(performance.now()-t);if(this.metrics.renderTimes.length>240)this.metrics.renderTimes.shift();this.metrics.renders++;this.metrics.calls=this.renderer.info.render.calls;this.metrics.triangles=this.renderer.info.render.triangles;}};
  invalidate(){this.dirty=true;}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const height=Math.max(6.8,7.4/(w/h));this.camera.left=-height*w/h/2;this.camera.right=height*w/h/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);this.invalidate();}
  getCamera():CameraState{const rounded=(values:number[])=>values.map(v=>Math.round(v*100000)/100000);return {position:rounded(this.camera.position.toArray()),target:rounded(this.controls.target.toArray()),zoom:Math.round(this.camera.zoom*100000)/100000};}
  applyCamera(c:CameraState){this.camera.position.fromArray(c.position);this.controls.target.fromArray(c.target);this.camera.zoom=c.zoom;this.camera.updateProjectionMatrix();this.controls.update();this.invalidate();}
  view(v:'default'|'top'|'close'){if(v==='default')this.applyCamera(DEFAULT_CAMERA);if(v==='top')this.applyCamera({position:[.05,11,.12],target:[0,0,0],zoom:1.1});if(v==='close')this.applyCamera({position:[5.4,3.5,6.2],target:[.25,1.05,-.72],zoom:1.6});}
  zoom(delta:number){this.camera.zoom=T.MathUtils.clamp(this.camera.zoom+delta,.55,2.4);this.camera.updateProjectionMatrix();this.cb.camera();this.invalidate();}
  setMode(mode:'edit'|'orbit'){this.mode=mode;this.controls.mouseButtons.LEFT=mode==='orbit'?T.MOUSE.ROTATE:null as unknown as T.MOUSE;this.renderer.domElement.style.cursor=mode==='orbit'?'grab':'default';}
  sync(plan:Plan){
    this.plan=plan;
    const ids=new Set(plan.objects.map(o=>o.id));for(const [id,g]of this.groups)if(!ids.has(id)){this.scene.remove(g);this.disposeUnique(g);this.groups.delete(id);}
    for(const o of plan.objects){
      const key=o.kind+o.material;let g=this.groups.get(o.id);
      if(!g||g.userData.key!==key){if(g){this.scene.remove(g);this.disposeUnique(g);}g=createFurniture(o);g.userData.key=key;this.groups.set(o.id,g);this.scene.add(g);}
      g.position.set(o.x,o.parentId?.78:o.kind==='chair'&&this.onRug(o,plan)?.027:0,o.z);g.rotation.y=o.rotation*Math.PI/180;
      g.traverse(child=>{if(child.name==='fixtureLight') (child as T.PointLight).intensity=o.on?(o.brightness||0)/100*(o.kind==='taskLamp'?5:8):0;if(child instanceof T.Mesh&&!Array.isArray(child.material)&&child.material.name==='bulb')(child.material as T.MeshStandardMaterial).emissiveIntensity=o.on?(o.brightness||0)/100*1.7:0;});
    }
    const moods={day:{bg:'#eeede7',sky:'#d0dfda',sun:'#fff2d6',intensity:3.1,ambient:1.75,fill:1.05,exposure:1.04,pos:[-3.7,5.6,3]},dusk:{bg:'#e9ded1',sky:'#d6b8a0',sun:'#ffaa5e',intensity:2.5,ambient:.85,fill:.5,exposure:1.08,pos:[-4.5,2.9,1.1]},night:{bg:'#222e35',sky:'#253d59',sun:'#91b3ed',intensity:.5,ambient:.38,fill:.2,exposure:1.14,pos:[-3,5,-.5]}}[plan.mood];
    this.scene.background=new T.Color(moods.bg);this.sun.color.set(moods.sun);this.sun.intensity=moods.intensity;this.sun.position.fromArray(moods.pos);this.ambient.intensity=moods.ambient;this.ambient.color.set(plan.mood==='night'?'#8ba8cc':'#eaf2ef');this.fill.intensity=moods.fill;this.renderer.toneMappingExposure=moods.exposure;
    const sky=this.room.getObjectByName('windowSky') as T.Mesh;(sky.material as T.MeshBasicMaterial).color.set(moods.sky);
    this.updateSelection();this.invalidate();
  }
  private onRug(item:Item,plan:Plan){return plan.objects.some(o=>o.kind==='rug'&&Math.abs(o.x-item.x)<1.1&&Math.abs(o.z-item.z)<.8);}
  private disposeUnique(g:T.Group){g.traverse(c=>{if(c instanceof T.Mesh&&!Array.isArray(c.material)&&(c.material.name==='bulb'||c.material.emissiveIntensity===.35))c.material.dispose();});}
  updateSelection(){
    while(this.selection.children.length){const c=this.selection.children[0] as T.LineSegments;this.selection.remove(c);c.geometry?.dispose();(c.material as T.Material)?.dispose();}
    const o=this.plan?.objects.find(o=>o.id===this.plan.selectedId);if(!o)return;
    const def=CATALOG[o.kind],y=o.parentId?.786:.04;
    const corners=[[-def.width/2-.045,-def.depth/2-.045],[def.width/2+.045,-def.depth/2-.045],[def.width/2+.045,def.depth/2+.045],[-def.width/2-.045,def.depth/2+.045]];
    const points:T.Vector3[]=[];
    for(const [x,z]of corners){points.push(new T.Vector3(x-Math.sign(x)*.12,y,z),new T.Vector3(x,y,z),new T.Vector3(x,y,z),new T.Vector3(x,y,z-Math.sign(z)*.12));}
    const geo=new T.BufferGeometry().setFromPoints(points),line=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#557761',depthTest:false,transparent:true,opacity:.95}));line.renderOrder=100;line.position.set(o.x,0,o.z);line.rotation.y=o.rotation*Math.PI/180;this.selection.add(line);
  }
  private cast(e:PointerEvent){const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);}
  private pointerDown=(e:PointerEvent)=>{
    if(e.button!==0||this.mode!=='edit')return;this.cast(e);
    const hits=this.ray.intersectObjects([...this.groups.values()],true);let id:string|null=null;
    if(hits[0]){let root:T.Object3D|null=hits[0].object;while(root&&!root.userData.itemId)root=root.parent;id=root?.userData.itemId||null;}
    this.cb.select(id);if(!id)return;
    const item=this.plan.objects.find(o=>o.id===id)!;const y=item.parentId?.78:0,p=new T.Vector3();this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-y),p);
    this.drag={id,startX:e.clientX,startY:e.clientY,offset:new T.Vector3(item.x,0,item.z).sub(p),y,moved:false};this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private pointerMove=(e:PointerEvent)=>{
    if(!this.drag)return;const d=this.drag;if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<4)return;
    if(!d.moved){this.cb.begin();d.moved=true;}this.cast(e);const p=new T.Vector3();if(this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-d.y),p)){p.add(d.offset);this.cb.move(d.id,p.x,p.z);}this.renderer.domElement.style.cursor='grabbing';
  };
  private pointerUp=()=>{if(this.drag?.moved)this.cb.end();this.drag=null;this.controls.enabled=true;this.renderer.domElement.style.cursor=this.mode==='edit'?'default':'grab';};
  async exportPNG():Promise<Blob>{
    const w=this.host.clientWidth,h=this.host.clientHeight,ratio=this.renderer.getPixelRatio();
    this.selection.visible=false;
    try{this.renderer.setPixelRatio(1);this.renderer.setSize(w*2,h*2,false);this.composer.setPixelRatio(1);this.composer.setSize(w*2,h*2);this.composer.render();return await new Promise<Blob>((resolve,reject)=>this.renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败，请重试。')),'image/png'));}
    finally{this.selection.visible=true;this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h);this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.invalidate();}
  }
  thumbnails():Record<Kind,string>{
    const result={} as Record<Kind,string>;const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(240,180);r.setPixelRatio(1);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;
    for(const kind of Object.keys(CATALOG) as Kind[]){const s=new T.Scene();s.add(new T.HemisphereLight('#ffffff','#c8bba3',3));const light=new T.DirectionalLight('#ffffff',3);light.position.set(2,4,5);s.add(light);const g=createFurniture({id:'thumb',kind,x:0,z:0,rotation:0,material:CATALOG[kind].materials[0],on:false,brightness:0},true);s.add(g);const info=thumbCamera(kind),h=info.size*.78,cam=new T.OrthographicCamera(-h*4/3/2,h*4/3/2,h/2,-h/2,.1,30);cam.position.set(3,2.4,4);cam.lookAt(info.target);r.render(s,cam);result[kind]=r.domElement.toDataURL('image/png');this.disposeUnique(g);}
    r.dispose();return result;
  }
  getMetrics(){let meshes=0,triangles=0;this.scene.traverse(o=>{if(o instanceof T.Mesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});const gl=this.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {...this.metrics,meshes,sceneTriangles:Math.round(triangles),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:this.renderer.getPixelRatio(),canvas:[this.renderer.domElement.width,this.renderer.domElement.height]};}
  destroy(){cancelAnimationFrame(this.frame);this.controls.dispose();this.composer.dispose();this.renderer.dispose();}
}
