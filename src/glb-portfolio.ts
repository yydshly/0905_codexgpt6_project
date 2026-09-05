import * as T from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mountHotspots } from './hotspots';
import { sameTarget, targetKey, type ContentTarget, type Portfolio, type WorkActivation } from './portfolio-model';

/** Standalone GLB adapter: needs no StudyScene or procedural furniture code. */
export function attachGLBPortfolio(host:HTMLElement,root:T.Object3D,camera:T.Camera,canvas:HTMLCanvasElement,controls:OrbitControls,portfolio:Portfolio,onActivate:(event:WorkActivation)=>void) {
  const ray=new T.Raycaster(),targets=new Map<string,{target:ContentTarget;part:T.Object3D}>();
  function resolve(node:T.Object3D|null){let partId:ContentTarget['partId']|undefined;while(node){if(node.userData.partId)partId=node.userData.partId;if(node.userData.itemId)return partId?{itemId:node.userData.itemId,partId}:null;node=node.parent;}return null;}
  root.traverse(part=>{if(part.userData.partId){const target=resolve(part);if(target)targets.set(targetKey(target),{target,part});}});
  const matching={...portfolio,bindings:portfolio.bindings.filter(b=>targets.has(targetKey(b.target)))};
  function pick(x:number,y:number){root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);return resolve(ray.intersectObject(root,true)[0]?.object??null);}
  const surface={renderer:{domElement:canvas},controls,contentTargetAt:pick,contentAnchors:()=>{
    root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);const r=canvas.getBoundingClientRect();return matching.bindings.map(b=>{
      const part=targets.get(targetKey(b.target))!.part,p=new T.Box3().setFromObject(part).getCenter(new T.Vector3()).project(camera),x=(p.x+1)*r.width/2,y=(1-p.y)*r.height/2,hit=pick(r.left+x,r.top+y);
      return {target:b.target,x,y,visible:p.z>=-1&&p.z<=1&&x>18&&x<r.width-18&&y>18&&y<r.height-18&&!!hit&&sameTarget(b.target,hit)};
    });
  }};
  const hotspots=mountHotspots(host,surface,()=>matching,onActivate);
  return {...hotspots,matched:matching.bindings.length,missing:portfolio.bindings.length-matching.bindings.length};
}
