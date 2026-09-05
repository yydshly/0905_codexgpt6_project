import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Bake instances into ordinary meshes so receiving products need no instancing extension.
export async function exportSceneGLB(roots:T.Object3D[],name:string,localOrigin:boolean) {
  const output=new T.Scene();output.name=name;output.userData={app:'ideal-study',assetVersion:1,units:'meters',upAxis:'Y',scope:localOrigin?'item':'room'};
  const copies:T.Material[]=[];
  for(const source of roots) {
    source.updateWorldMatrix(true,true);
    const root=source.clone(true);
    if(localOrigin){root.position.set(0,0,0);root.quaternion.identity();}else{root.matrix.copy(source.matrixWorld);root.matrix.decompose(root.position,root.quaternion,root.scale);}
    if(source instanceof T.DirectionalLight){
      root.lookAt(source.target.getWorldPosition(new T.Vector3()));
      const light=root as T.DirectionalLight;light.target=new T.Object3D();light.target.position.set(0,0,-1);light.add(light.target);
    }
    root.name=source.userData.itemId??(source instanceof T.Light?'scene-light':'room');
    output.add(root);
    const batches:T.InstancedMesh[]=[];root.traverse(o=>{o.userData=o.userData.itemId?{itemId:o.userData.itemId}:{};if(o instanceof T.InstancedMesh)batches.push(o);});
    for(const batch of batches){const group=new T.Group();group.position.copy(batch.position);group.quaternion.copy(batch.quaternion);group.scale.copy(batch.scale);for(let index=0;index<batch.count;index++){const part=new T.Mesh(batch.geometry,batch.material),matrix=new T.Matrix4();batch.getMatrixAt(index,matrix);matrix.decompose(part.position,part.quaternion,part.scale);group.add(part);}batch.parent!.add(group);batch.removeFromParent();}
  }
  // Bump-only detail and renderer postprocessing are not part of this portable asset.
  output.traverse(o=>{if(o instanceof T.Mesh){const convert=(source:T.Material)=>{const m=source.clone();copies.push(m);if(m instanceof T.MeshStandardMaterial)m.bumpMap=null;return m;};o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);}});
  try {
    const data=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true,maxTextureSize:1024});
    if(!(data instanceof ArrayBuffer)||data.byteLength<20)throw new Error('模型导出未生成有效的 GLB 文件。');
    return new Blob([data],{type:'model/gltf-binary'});
  } finally { copies.forEach(m=>m.dispose()); }
}
