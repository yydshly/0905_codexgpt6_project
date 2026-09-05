import * as T from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mountHotspots } from './hotspots';
import { resolveContentTarget, targetKey, type ContentTarget, type Portfolio, type WorkActivation } from './portfolio-model';
import { contentAnchor } from './content-anchor';

/** Standalone GLB adapter: needs no StudyScene or procedural furniture code. */
export function attachGLBPortfolio(host:HTMLElement,root:T.Object3D,camera:T.Camera,canvas:HTMLCanvasElement,controls:OrbitControls,portfolio:Portfolio,onActivate:(event:WorkActivation)=>void) {
  const ray=new T.Raycaster(),targets=new Map<string,{target:ContentTarget;part:T.Object3D}>();
  function resolve(node:T.Object3D|null){let partId:ContentTarget['partId']|undefined;while(node){if(node.userData.partId)partId=node.userData.partId;if(node.userData.itemId)return resolveContentTarget(portfolio,node.userData.itemId,partId);node=node.parent;}return null;}
  root.traverse(part=>{if(part.userData.itemId){const target:ContentTarget={itemId:part.userData.itemId,partId:'object'};targets.set(targetKey(target),{target,part});}else if(part.userData.partId){const target=resolve(part);if(target&&target.partId!=='object')targets.set(targetKey(target),{target,part});}});
  const matching={...portfolio,bindings:portfolio.bindings.filter(b=>targets.has(targetKey(b.target)))};
  function pick(x:number,y:number){root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);return resolve(ray.intersectObject(root,true)[0]?.object??null);}
  const surface={renderer:{domElement:canvas},controls,contentTargetAt:pick,contentAnchors:()=>{
    root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);const r=canvas.getBoundingClientRect();return matching.bindings.map(b=>{
      return contentAnchor(b.target,targets.get(targetKey(b.target))!.part,camera,r,pick);
    });
  }};
  const hotspots=mountHotspots(host,surface,()=>matching,onActivate);
  return {...hotspots,matched:matching.bindings.length,missing:portfolio.bindings.length-matching.bindings.length};
}
