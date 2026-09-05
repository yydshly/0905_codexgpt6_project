import * as T from 'three';
import { sameTarget, type ContentTarget } from './portfolio-model';

/** Test visible geometry, including hollow furniture, without clicking through occluders. */
export function contentAnchor(target:ContentTarget,part:T.Object3D,camera:T.Camera,rect:DOMRect,pick:(x:number,y:number)=>ContentTarget|null){
  const box=new T.Box3().setFromObject(part),center=box.getCenter(new T.Vector3());
  const points=[center];
  if(target.partId==='object')for(const y of [.72,.3,.92])for(const x of [.5,.2,.8])points.push(new T.Vector3(T.MathUtils.lerp(box.min.x,box.max.x,x),T.MathUtils.lerp(box.min.y,box.max.y,y),center.z));
  let result={target,x:0,y:0,visible:false};
  for(const point of points){const p=point.project(camera),x=(p.x+1)*rect.width/2,y=(1-p.y)*rect.height/2;result={target,x,y,visible:false};if(p.z < -1||p.z>1||x<18||x>rect.width-18||y<18||y>rect.height-18)continue;const hit=pick(rect.left+x,rect.top+y);if(hit&&sameTarget(hit,target))return {...result,visible:true};}
  return result;
}
