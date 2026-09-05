import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createFurniture, createRoom, thumbCamera } from './geometry';
import { CATALOG, DEFAULT_CAMERA, CAMERA_LIMITS, displayName, localPoint, type Plan, type Kind, type CameraState, type Item } from './model';

const CAMERA_VIEWS={default:DEFAULT_CAMERA,top:{position:[.05,11,.12],target:[0,0,0],zoom:1.1},close:{position:[5.4,3.5,6.2],target:[.25,1.05,-.72],zoom:1.6}} satisfies Record<string,CameraState>;

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
  private selectionLabel=document.createElement('div');
  private selectionText=document.createElement('span');
  private shadowKey='';
  private selectionKey='';
  private exporting=false;
  private interactionEnabled=true;
  private frameAspect:number|null=null;
  private frame=0;
  metrics={ renderTimes:[] as number[], renders:0, calls:0, triangles:0 };
  constructor(private host:HTMLElement, private cb:SceneCallbacks) {
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.info.autoReset=false;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.domElement.setAttribute('aria-label','可编辑的三维书房');this.renderer.domElement.tabIndex=0;host.append(this.renderer.domElement);
    this.selectionLabel.className='object-label';this.selectionLabel.hidden=true;this.selectionLabel.setAttribute('aria-hidden','true');this.selectionText.className='object-label-text';this.selectionLabel.append(this.selectionText);host.append(this.selectionLabel);
    this.scene.background=new T.Color('#eeede7');this.room=createRoom(this.scene);this.scene.add(this.ambient,this.sun,this.fill);
    this.sun.position.set(-3.7,5.6,3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-5,right:5,top:6,bottom:-5,near:.5,far:18});this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=3;
    // Camera-only changes reuse the world-space shadow map.
    this.renderer.shadowMap.autoUpdate=false;
    this.fill.position.set(3,4,5);
    this.scene.add(this.selection);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.ao=new SSAOPass(this.scene,this.camera,host.clientWidth,host.clientHeight);this.ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA=0;this.ao.depthRenderMaterial.defines.PERSPECTIVE_CAMERA=0;this.ao.kernelRadius=.28;this.ao.minDistance=.0001;this.ao.maxDistance=.004;this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());this.composer.addPass(new SMAAPass());
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=false;this.controls.enablePan=false;this.controls.minPolarAngle=CAMERA_LIMITS.minPolar;this.controls.maxPolarAngle=CAMERA_LIMITS.maxPolar;this.controls.minAzimuthAngle=CAMERA_LIMITS.minAzimuth;this.controls.maxAzimuthAngle=CAMERA_LIMITS.maxAzimuth;this.controls.minZoom=CAMERA_LIMITS.minZoom;this.controls.maxZoom=CAMERA_LIMITS.maxZoom;this.controls.mouseButtons={LEFT:null as unknown as T.MOUSE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.ROTATE};
    this.controls.addEventListener('change',()=>{this.invalidate();this.positionSelectionLabel();this.cb.camera();});
    this.applyCamera(DEFAULT_CAMERA);
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',this.pointerDown);
    canvas.addEventListener('pointermove',this.pointerMove);
    canvas.addEventListener('pointerup',this.pointerUp);
    canvas.addEventListener('pointercancel',this.pointerUp);
    canvas.addEventListener('lostpointercapture',this.pointerUp);
    canvas.addEventListener('pointerleave',()=>{if(!this.drag)canvas.style.cursor=this.mode==='orbit'?'grab':'default';});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.cb.error('图形上下文已中断。请先导出 JSON 备份，再刷新页面恢复。');});
    new ResizeObserver(()=>this.resize()).observe(host);this.resize();this.loop();
  }
  private loop=()=>{this.frame=requestAnimationFrame(this.loop);if(this.dirty&&!document.hidden&&!this.exporting)this.renderNow();};
  renderNow(){this.dirty=false;this.camera.updateMatrixWorld(true);this.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);this.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);const t=performance.now();this.renderer.info.reset();this.composer.render();this.metrics.renderTimes.push(performance.now()-t);if(this.metrics.renderTimes.length>240)this.metrics.renderTimes.shift();this.metrics.renders++;this.metrics.calls=this.renderer.info.render.calls;this.metrics.triangles=this.renderer.info.render.triangles;}
  invalidate(){this.dirty=true;}
  private projection(w:number,h:number){const aspect=this.frameAspect??w/h,height=Math.max(6.8,7.4/aspect);this.camera.left=-height*aspect/2;this.camera.right=height*aspect/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();}
  setFraming(aspect:number|null){this.frameAspect=aspect;this.resize();}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h||this.exporting)return;this.projection(w,h);this.renderer.setSize(w,h);this.composer.setSize(w,h);this.positionSelectionLabel();this.invalidate();}
  setInteractionEnabled(enabled:boolean){this.interactionEnabled=enabled;this.controls.enabled=enabled;}
  captureSession(width:number,height:number){
    if(this.exporting)throw new Error('已有画面正在生成，请稍后重试。');
    const ratio=this.renderer.getPixelRatio(),camera=this.getCamera(),selection=this.selection.visible,interaction=this.interactionEnabled;
    this.exporting=true;this.selection.visible=false;this.setInteractionEnabled(false);
    this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false);this.composer.setPixelRatio(1);this.composer.setSize(width,height);this.projection(width,height);
    let closed=false;
    return {render:(pose:CameraState)=>{if(closed)throw new Error('画面生成已结束');this.applyCamera(pose);this.renderNow();return this.renderer.domElement;},close:()=>{if(closed)return;closed=true;this.exporting=false;this.selection.visible=selection;this.renderer.setPixelRatio(ratio);this.composer.setPixelRatio(ratio);this.setInteractionEnabled(interaction);this.resize();this.applyCamera(camera);}};
  }
  getCamera():CameraState{const rounded=(values:number[])=>values.map(v=>Math.round(v*100000)/100000);return {position:rounded(this.camera.position.toArray()),target:rounded(this.controls.target.toArray()),zoom:Math.round(this.camera.zoom*100000)/100000};}
  applyCamera(c:CameraState){this.camera.position.fromArray(c.position);this.controls.target.fromArray(c.target);this.camera.zoom=c.zoom;this.camera.updateProjectionMatrix();this.controls.update();this.camera.updateMatrixWorld(true);this.positionSelectionLabel();this.cb.camera();this.invalidate();}
  view(v:keyof typeof CAMERA_VIEWS){this.applyCamera(CAMERA_VIEWS[v]);}
  getView():keyof typeof CAMERA_VIEWS|null {
    for(const [name,preset]of Object.entries(CAMERA_VIEWS)) {
      const target=new T.Vector3().fromArray(preset.target),offset=new T.Vector3().fromArray(preset.position).sub(target),s=new T.Spherical().setFromVector3(offset);
      s.phi=T.MathUtils.clamp(s.phi,this.controls.minPolarAngle,this.controls.maxPolarAngle);s.theta=T.MathUtils.clamp(s.theta,this.controls.minAzimuthAngle,this.controls.maxAzimuthAngle);
      const position=offset.setFromSpherical(s).add(target);
      if(this.camera.position.distanceTo(position)<.0001&&this.controls.target.distanceTo(target)<.0001&&Math.abs(this.camera.zoom-preset.zoom)<.0001)return name as keyof typeof CAMERA_VIEWS;
    }
    return null;
  }
  zoom(delta:number){this.camera.zoom=T.MathUtils.clamp(this.camera.zoom+delta,CAMERA_LIMITS.minZoom,CAMERA_LIMITS.maxZoom);this.camera.updateProjectionMatrix();this.positionSelectionLabel();this.cb.camera();this.invalidate();}
  setMode(mode:'edit'|'orbit'){this.pointerUp();this.mode=mode;this.controls.mouseButtons.LEFT=mode==='orbit'?T.MOUSE.ROTATE:null as unknown as T.MOUSE;this.renderer.domElement.style.cursor=mode==='orbit'?'grab':'default';this.positionSelectionLabel();}
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
    const shadowKey=JSON.stringify([plan.mood,plan.objects.map(o=>[o.id,o.kind,o.material,o.x,o.z,o.rotation,o.parentId])]);
    if(this.shadowKey!==shadowKey){this.shadowKey=shadowKey;this.renderer.shadowMap.needsUpdate=true;}
    this.updateSelection();this.invalidate();
  }
  private onRug(item:Item,plan:Plan){return plan.objects.some(o=>{if(o.kind!=='rug')return false;const p=localPoint(item.x,item.z,o);return Math.abs(p.x)<1.1&&Math.abs(p.z)<.8;});}
  private disposeUnique(g:T.Group){g.traverse(c=>{if(c instanceof T.InstancedMesh)c.dispose();if(c instanceof T.Mesh&&!Array.isArray(c.material)&&(c.material.name==='bulb'||c.material.emissiveIntensity===.35))c.material.dispose();});}
  updateSelection(){
    const o=this.plan?.objects.find(o=>o.id===this.plan.selectedId);
    const key=JSON.stringify([o?.id,o?.kind,this.plan?.mood]);
    if(key===this.selectionKey){if(o){this.selection.position.set(o.x,0,o.z);this.selection.rotation.y=o.rotation*Math.PI/180;}this.positionSelectionLabel();return;}
    this.selectionKey=key;
    while(this.selection.children.length){const c=this.selection.children[0] as T.LineSegments;this.selection.remove(c);c.geometry?.dispose();(c.material as T.Material)?.dispose();}
    if(!o){this.selectionLabel.hidden=true;return;}
    const def=CATALOG[o.kind],y=o.parentId?.786:.04;
    const corners=[[-def.width/2-.045,-def.depth/2-.045],[def.width/2+.045,-def.depth/2-.045],[def.width/2+.045,def.depth/2+.045],[-def.width/2-.045,def.depth/2+.045]];
    const points:T.Vector3[]=[];
    for(const [cx,cz]of corners)for(const inset of [0,.009,.018]){const x=cx-Math.sign(cx)*inset,z=cz-Math.sign(cz)*inset;points.push(new T.Vector3(x-Math.sign(x)*.12,y,z),new T.Vector3(x,y,z),new T.Vector3(x,y,z),new T.Vector3(x,y,z-Math.sign(z)*.12));}
    const geo=new T.BufferGeometry().setFromPoints(points),line=new T.LineSegments(geo,new T.LineBasicMaterial({color:this.plan.mood==='night'?'#c9e6ab':'#49734e',depthTest:false,depthWrite:false,transparent:true,opacity:.95}));line.renderOrder=100;this.selection.add(line);this.selection.position.set(o.x,0,o.z);this.selection.rotation.y=o.rotation*Math.PI/180;this.positionSelectionLabel();
  }
  private positionSelectionLabel(){
    const item=this.plan?.objects.find(o=>o.id===this.plan.selectedId),group=item&&this.groups.get(item.id);
    if(!item||!group){this.selectionLabel.hidden=true;return;}
    // OrbitControls updates the pose before the next renderer frame updates its inverse matrix.
    this.camera.updateMatrixWorld(true);
    const p=group.position.clone();p.y+=CATALOG[item.kind].height+.14;p.project(this.camera);
    const w=this.host.clientWidth,h=this.host.clientHeight;
    this.selectionLabel.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1.15||Math.abs(p.y)>1.15;
    this.selectionText.textContent=displayName(item,this.plan.objects)+' · '+(this.drag?.moved?`X ${item.x.toFixed(2)} / Z ${item.z.toFixed(2)} m`:this.mode==='edit'?'拖动移动':'已选中');
    this.selectionLabel.classList.toggle('is-dragging',!!this.drag?.moved);
    const halfLabel=this.selectionLabel.offsetWidth/2+12;
    this.selectionLabel.style.left=`${T.MathUtils.clamp((p.x+1)/2*w,Math.min(halfLabel,w/2),Math.max(w-halfLabel,w/2))}px`;
    this.selectionLabel.style.top=`${T.MathUtils.clamp((1-p.y)/2*h,115,h-75)}px`;
  }
  private cast(e:PointerEvent){this.camera.updateMatrixWorld(true);for(const group of this.groups.values())group.updateMatrixWorld(true);const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);}
  private pick(e:PointerEvent){this.cast(e);const hit=this.ray.intersectObjects([...this.groups.values()],true)[0];let root:T.Object3D|null=hit?.object||null;while(root&&!root.userData.itemId)root=root.parent;return root?.userData.itemId as string|undefined;}
  private pointerDown=(e:PointerEvent)=>{
    if(e.button!==0||this.mode!=='edit'||!this.interactionEnabled)return;const id=this.pick(e)||null;
    this.cb.select(id);if(!id)return;
    const item=this.plan.objects.find(o=>o.id===id)!;const y=item.parentId?.78:0,p=new T.Vector3();this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-y),p);
    this.drag={id,startX:e.clientX,startY:e.clientY,offset:new T.Vector3(item.x,0,item.z).sub(p),y,moved:false};this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private pointerMove=(e:PointerEvent)=>{
    if(!this.drag){if(this.mode==='edit'&&e.buttons===0)this.renderer.domElement.style.cursor=this.pick(e)?'grab':'default';return;}const d=this.drag;if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<4)return;
    if(!d.moved){this.cb.begin();d.moved=true;}this.cast(e);const p=new T.Vector3();if(this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-d.y),p)){p.add(d.offset);this.cb.move(d.id,p.x,p.z);}this.renderer.domElement.style.cursor='grabbing';
  };
  private pointerUp=()=>{const moved=this.drag?.moved;this.drag=null;if(moved)this.cb.end();this.controls.enabled=this.interactionEnabled;this.renderer.domElement.style.cursor=this.mode==='edit'?'default':'grab';this.positionSelectionLabel();};
  async exportPNG():Promise<Blob>{
    const w=this.host.clientWidth,h=this.host.clientHeight,ratio=this.renderer.getPixelRatio();
    this.selection.visible=false;this.exporting=true;
    try{this.renderer.setPixelRatio(1);this.renderer.setSize(w*2,h*2,false);this.composer.setPixelRatio(1);this.composer.setSize(w*2,h*2);this.composer.render();return await new Promise<Blob>((resolve,reject)=>this.renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('图片生成失败，请重试。')),'image/png'));}
    finally{this.selection.visible=true;this.exporting=false;this.renderer.setPixelRatio(ratio);this.renderer.setSize(w,h);this.composer.setPixelRatio(ratio);this.composer.setSize(w,h);this.resize();this.invalidate();}
  }
  thumbnails():Record<string,string>{
    const result:Record<string,string>={};const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(240,180);r.setPixelRatio(1);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;
    for(const kind of Object.keys(CATALOG) as Kind[])for(const material of CATALOG[kind].materials){const s=new T.Scene();s.add(new T.HemisphereLight('#ffffff','#c8bba3',3));const light=new T.DirectionalLight('#ffffff',3);light.position.set(2,4,5);s.add(light);const g=createFurniture({id:'thumb',kind,x:0,z:0,rotation:0,material,on:false,brightness:0},true);s.add(g);const info=thumbCamera(kind),h=info.size*.78,cam=new T.OrthographicCamera(-h*4/3/2,h*4/3/2,h/2,-h/2,.1,30);cam.position.set(3,2.4,4);cam.lookAt(info.target);r.render(s,cam);result[`${kind}:${material}`]=r.domElement.toDataURL('image/png');if(material===CATALOG[kind].materials[0])result[kind]=result[`${kind}:${material}`];this.disposeUnique(g);}
    r.dispose();return result;
  }
  getMetrics(){let meshes=0,triangles=0,instanceBatches=0;this.scene.traverse(o=>{if(o instanceof T.Mesh){meshes++;const count=o instanceof T.InstancedMesh?o.count:1;if(o instanceof T.InstancedMesh)instanceBatches++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*count;}});const gl=this.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {...this.metrics,meshes,instanceBatches,sceneTriangles:Math.round(triangles),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:this.renderer.getPixelRatio(),canvas:[this.renderer.domElement.width,this.renderer.domElement.height]};}
  destroy(){cancelAnimationFrame(this.frame);this.controls.dispose();this.composer.dispose();this.renderer.dispose();}
}
