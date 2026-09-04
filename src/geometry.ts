import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CATALOG, MATERIALS, type Item, type Kind } from './model';

const mats = new Map<string,T.MeshStandardMaterial>();
const geos = new Map<string,T.BufferGeometry>();
function seeded(seed=14) { return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}; }
function texture(type:'wood'|'fabric') {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d')!,rand=seeded();ctx.fillStyle=type==='wood'?'#ccc7be':'#dedad0';ctx.fillRect(0,0,512,512);
  if(type==='wood') for(let i=0;i<900;i++) { const y=rand()*512;ctx.strokeStyle=`rgba(72,48,26,${rand()*.13})`;ctx.lineWidth=rand()*1.2;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=512;x+=16)ctx.lineTo(x,y+Math.sin(x*.018+y)*rand()*3);ctx.stroke(); }
  else for(let i=0;i<512;i+=2){ctx.strokeStyle=i%4?'#bdb8aa':'#f1eee5';ctx.globalAlpha=.34;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;tex.repeat.set(type==='wood'?1:3,type==='wood'?1:3);return tex;
}
let wood:T.Texture, fabric:T.Texture;
export function material(name:string,kind?:Kind):T.MeshStandardMaterial {
  const key=name+':'+(kind||'');if(mats.has(key))return mats.get(key)!;
  const def=MATERIALS[name];const woodLike=name==='oak'||name==='walnut';const woven=kind==='rug'||kind==='chair'||(kind==='floorLamp'&&name==='linen');
  const m=new T.MeshStandardMaterial({color:def?.color||name,roughness:woodLike?.58:woven?.95:.7,metalness:name==='silver'?.65:name==='charcoal'?.22:0});
  if(woodLike) { wood ||= texture('wood');m.map=wood;m.bumpMap=wood;m.bumpScale=.0012; }
  if(woven) {fabric ||= texture('fabric');m.map=fabric;m.bumpMap=fabric;m.bumpScale=.009;}
  mats.set(key,m);return m;
}
export function mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0) {
  const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function box(p:T.Object3D,w:number,h:number,d:number,mat:T.Material,x=0,y=0,z=0,r=.008) {
  const key=`box:${w}:${h}:${d}:${r}`;let g=geos.get(key);if(!g){g=r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new T.BoxGeometry(w,h,d);geos.set(key,g);}return mesh(p,g,mat,x,y,z);
}
export function cylinder(p:T.Object3D,rt:number,rb:number,h:number,mat:T.Material,x=0,y=0,z=0,n=32) {
  const key=`cyl:${rt}:${rb}:${h}:${n}`;let g=geos.get(key);if(!g){g=new T.CylinderGeometry(rt,rb,h,n);geos.set(key,g);}return mesh(p,g,mat,x,y,z);
}
function sphere(p:T.Object3D,r:number,mat:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1) {
  const key=`sphere:${r}`;let g=geos.get(key);if(!g){g=new T.SphereGeometry(r,20,12);geos.set(key,g);}const m=mesh(p,g,mat,x,y,z);m.scale.set(sx,sy,sz);return m;
}
function rod(p:T.Object3D,a:number[],b:number[],r:number,mat:T.Material){const av=new T.Vector3(...a),bv=new T.Vector3(...b);const c=cylinder(p,r,r,av.distanceTo(bv),mat);c.position.copy(av.clone().add(bv).multiplyScalar(.5));c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return c;}
function cup(p:T.Object3D,x:number,y:number,z:number){const white=material('#d7d2c2');cylinder(p,.044,.039,.085,white,x,y+.043,z);cylinder(p,.037,.037,.002,material('#574537'),x,y+.086,z);const h=mesh(p,new T.TorusGeometry(.03,.007,8,20),white,x+.045,y+.05,z);h.rotation.y=Math.PI/2;}
function books(p:T.Object3D,x:number,y:number,z:number,count:number,seed:number){const rand=seeded(seed),colors=['#5e7464','#c4b49a','#e2d7be','#ab7c59','#545953','#949780'];let cursor=x;for(let i=0;i<count;i++){const w=.04+rand()*.035,h=.17+rand()*.1;box(p,w,h,.2,material(colors[Math.floor(rand()*colors.length)]),cursor+w/2,y+h/2,z,.003);for(const dy of [-.045,.045])box(p,w*.74,.006,.003,material('#dad1b8'),cursor+w/2,y+h/2+dy,z+.101,.001);cursor+=w+.007;}}
function vase(p:T.Object3D,x:number,y:number,z:number){cylinder(p,.06,.085,.18,material('#d8c9ab'),x,y+.09,z);cylinder(p,.045,.06,.06,material('#d8c9ab'),x,y+.21,z);for(let i=0;i<5;i++){rod(p,[x,y+.2,z],[x+(i-2)*.027,y+.42+(i%2)*.08,z+.02],.002,material('#7a7154'));sphere(p,.045,material('#a9946d'),x+(i-2)*.033,y+.41+(i%2)*.08,z+.02,.7,1.8,.6);}}
export function createFurniture(item:Item,preview=false):T.Group {
  const g=new T.Group();g.userData.itemId=item.id;const m=material(item.material,item.kind),metal=material('#333a34'),oak=material('oak'),cream=material('#e9e5da');
  if(item.kind==='desk') {
    box(g,1.95,.085,.85,m,0,.738,0,.025);
    for(const x of [-.83,.83])for(const z of [-.31,.31]){const leg=box(g,.055,.68,.055,metal,x,.35,z,.012);leg.rotation.z=x>0?-.035:.035;}
    box(g,1.69,.055,.045,metal,0,.63,-.31);
    box(g,.43,.13,.64,m,.55,.63,0,.013);box(g,.15,.012,.025,metal,.55,.63,.328);
    box(g,.58,.014,.22,material('#d6d2c4'),0,.791,.23,.013);
    for(let row=0;row<4;row++)for(let col=0;col<14;col++)box(g,.028,.006,.032,cream,-.259+col*.039,.801,.147+row*.043,.003);
    box(g,.074,.033,.112,cream,.43,.803,.22,.023);
    box(g,.19,.027,.26,material('#b88665'),-.68,.796,.18,.005);box(g,.175,.017,.247,cream,-.68,.809,.18,.002);
    cup(g,.80,.784,-.30);
  }
  if(item.kind==='chair') {
    box(g,.55,.11,.5,m,0,.455,0,.075);
    const back=box(g,.57,.36,.095,m,0,.71,.245,.09);back.rotation.x=-.1;
    for(const x of [-.24,.24]){rod(g,[x,.4,-.18],[x*1.15,.035,-.23],.021,metal);rod(g,[x,.4,.18],[x*1.15,.035,.28],.021,metal);rod(g,[x,.47,.13],[x,.65,.13],.015,metal);box(g,.065,.035,.34,oak,x,.66,.015,.017);}
  }
  if(item.kind==='monitor') {
    box(g,.31,.018,.22,m,0,.011,.01,.03);box(g,.045,.22,.045,m,0,.13,-.04,.012);
    box(g,.82,.47,.042,m,0,.29,-.055,.016);
    const screenmat=new T.MeshStandardMaterial({color:'#879a8d',emissive:'#698577',emissiveIntensity:.35,roughness:.36});
    box(g,.781,.416,.004,screenmat,0,.295,-.031,.008);
    // The screen is geometric artwork, not a photograph of the room.
    box(g,.27,.416,.006,material('#253b35'),-.25,.295,-.027,.003);
    box(g,.19,.012,.007,material('#d0d6be'),-.26,.424,-.022,.002);
    for(let i=0;i<5;i++)box(g,.13-(i%2)*.035,.004,.007,material('#7c9583'),-.285,.386-i*.021,-.022,.001);
    const disc=mesh(g,new T.CircleGeometry(.115,40),material('#c9c2a0'),.16,.318,-.023);disc.castShadow=false;
    box(g,.39,.052,.01,material('#50695b'),.17,.132,-.02,.005);
    sphere(g,.003,cream,0,.074,-.031);
  }
  if(item.kind==='shelf') {
    for(const x of [-.557,.557])box(g,.045,2.0,.36,m,x,1.025,0,.006);
    for(const y of [.12,.5,.89,1.28,1.68,2.04])box(g,1.18,.045,.38,m,0,y,0,.007);
    box(g,1.08,.33,.023,material('#c2ab87'),0,.295,-.17,.003);
    box(g,1.08,.005,.012,metal,0,.14,.194,.001);
    books(g,-.49,.524,0,6,14);books(g,.11,.914,0,5,8);books(g,-.47,1.305,0,5,3);books(g,-.47,1.705,0,3,18);
    vase(g,.31,1.703,.01);vase(g,.27,.524,0);
    box(g,.25,.065,.21,material('#bca783'),-.26,.946,0,.003);box(g,.22,.05,.19,material('#6c7b69'),-.26,1.002,0,.003);
    const frame=box(g,.21,.27,.015,metal,.29,1.44,.015,.004);frame.rotation.z=-.06;box(g,.18,.235,.01,cream,.29,1.44,.026,.001);sphere(g,.06,material('#ad8860'),.29,1.44,.034,1,1,.01);
  }
  if(item.kind==='taskLamp') {
    cylinder(g,.112,.13,.028,m,0,.018,0);cylinder(g,.038,.057,.27,m,0,.16,0);
    mesh(g,new T.SphereGeometry(.177,40,20,0,Math.PI*2,0,Math.PI/2),m,0,.29,0);
    const bulb=new T.MeshStandardMaterial({color:'#ffedc1',emissive:'#ffd48c',emissiveIntensity:item.on?1.2:0,roughness:.65});bulb.name='bulb';cylinder(g,.17,.17,.015,bulb,0,.29,0);
    if(!preview){const light=new T.PointLight('#ffd297',item.on?(item.brightness||0)/100*5:0,2.6,2);light.position.set(0,.255,.02);light.name='fixtureLight';g.add(light);}
  }
  if(item.kind==='floorLamp') {
    cylinder(g,.22,.23,.035,metal,0,.024,0);cylinder(g,.016,.02,1.39,metal,0,.71,0);
    const shade=cylinder(g,.20,.285,.34,m,0,1.47,0,48);shade.material=material(item.material,item.kind);
    const bulb=new T.MeshStandardMaterial({color:'#f6e7c8',emissive:'#ffd28a',emissiveIntensity:item.on?.8:0});bulb.name='bulb';cylinder(g,.273,.273,.012,bulb,0,1.295,0);
    cylinder(g,.035,.035,.04,metal,0,1.665,0);
    if(!preview){const light=new T.PointLight('#ffcc8d',item.on?(item.brightness||0)/100*8:0,4.7,2);light.position.set(0,1.24,0);light.name='fixtureLight';g.add(light);}
  }
  if(item.kind==='plant') {
    cylinder(g,.19,.145,.33,m,0,.18,0,40);cylinder(g,.17,.17,.015,material('#514432'),0,.347,0);
    const trunk=material('#77604a'),leaf1=material('#425f36'),leaf2=material('#637c43');
    for(let j=0;j<3;j++){const a=j*2.4;rod(g,[0,.31,0],[Math.cos(a)*.12,1.2-j*.12,Math.sin(a)*.12],.009,trunk);for(let i=0;i<5;i++){const phi=a+i*2.3,y=.53+i*.15-j*.02,x=Math.cos(phi)*(.18+i*.008),z=Math.sin(phi)*(.18+i*.008);rod(g,[Math.cos(a)*.065,y-.06,Math.sin(a)*.065],[x,y,z],.003,trunk);const leaf=sphere(g,.16,i%2?leaf1:leaf2,x,y+.04,z,.75,.22,1.35);leaf.rotation.set(.28,phi,.3);}}
  }
  if(item.kind==='rug') {
    box(g,2.5,.022,1.85,m,0,.014,0,.04);
    const border=material('#a49980');for(const z of [-.82,.82])box(g,2.36,.001,.015,border,0,.026,z,.001);
    for(const x of [-1.18,1.18])box(g,.014,.001,1.65,border,x,.026,0,.001);
    for(let i=0;i<34;i++)for(const x of [-1.28,1.28])box(g,.08,.008,.009,material('#c9bda6'),x,.012,-.84+i*.05,.002);
  }
  return g;
}

export function createRoom(scene:T.Scene) {
  const room=new T.Group();scene.add(room);const wall=material('#e5e2d7'),trim=material('#d2cdbb'),woodMat=material('oak');
  box(room,5.48,.22,4.68,material('#d7d1c2'),0,-.13,0,.025);
  // Individually joined oak boards and shared procedural grain.
  for(let row=0;row<16;row++)for(let col=0;col<4;col++){
    const m=woodMat.clone();m.color.set(['#c7b697','#c5b396','#cbbb9e','#cebd9f'][(row*7+col*3)%4]);
    const x=-2.6+(col+.5)*1.3;const plank=box(room,1.3,.035,.275,m,x,-.012,-2.2+(row+.5)*.275,0);plank.castShadow=false;
  }
  box(room,5.4,2.8,.12,wall,0,1.4,-2.26,.006);
  // West wall with a true opening: 1.85 m wide × 1.58 m tall.
  box(room,.12,2.8,1.05,wall,-2.66,1.4,-1.675,.003);
  box(room,.12,2.8,1.45,wall,-2.66,1.4,1.475,.003);
  box(room,.12,.79,1.9,wall,-2.66,.395,-.2,.003);
  box(room,.12,.43,1.9,wall,-2.66,2.585,-.2,.003);
  box(room,5.18,.09,.025,trim,0,.045,-2.185,.004);box(room,.025,.09,4.4,trim,-2.585,.045,0,.004);
  const windowM=material('#e5dcc6');
  for(const z of [-1.13,.73])box(room,.14,1.65,.045,windowM,-2.64,1.58,z,.005);
  for(const y of [.79,2.37])box(room,.14,.048,1.9,windowM,-2.64,y,-.2,.005);
  box(room,.10,1.58,.038,windowM,-2.64,1.58,-.2,.005);box(room,.1,.035,1.85,windowM,-2.64,1.57,-.2,.004);
  box(room,.24,.055,2.04,woodMat,-2.59,.785,-.2,.005);
  const skyMat=new T.MeshBasicMaterial({color:'#d3dfd6',side:T.DoubleSide});const sky=box(room,.01,1.55,1.82,skyMat,-2.72,1.58,-.2,0);sky.castShadow=false;sky.receiveShadow=false;sky.name='windowSky';
  // Sheer curtain: narrow folded geometry keeps most of the window open.
  const curtain=material('#dedacf');for(let i=0;i<10;i++){const c=cylinder(room,.027,.03,1.92,curtain,-2.48+(i%2)*.014,1.32,.64+i*.022,12);c.scale.z=.8;}
  rod(room,[-2.49,2.42,-1.23],[-2.49,2.42,1.02],.016,metalTrim());
  // Two framed geometric prints on the back wall.
  const art=new T.Group();art.position.set(.6,1.93,-2.177);room.add(art);
  box(art,1.15,.82,.026,woodMat,0,0,0,.005);box(art,1.10,.77,.01,material('#f0e9d9'),0,0,.02,.001);
  const arch=mesh(art,new T.CircleGeometry(.25,48,0,Math.PI),material('#85917c'),0,-.08,.027);arch.castShadow=false;
  box(art,.5,.18,.007,material('#85917c'),0,-.17,.03,.001);
  const sun=mesh(art,new T.CircleGeometry(.098,40),material('#c49a65'),.245,.195,.027);sun.castShadow=false;
  for(let i=0;i<4;i++)box(art,.77,.009,.009,material('#e1cfac'),0,-.11+i*.07,.042,.001);
  // Under-floor gallery plinth and an infinite neutral studio ground.
  const ground=mesh(scene,new T.PlaneGeometry(200,200),material('#edece5'),0,-.255,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.receiveShadow=false;
  return room;
}
function metalTrim(){return material('#7b7767');}
export function thumbCamera(kind:Kind) { const c=CATALOG[kind];const h=c.height;return {target:new T.Vector3(0,h*.43,0),size:Math.max(c.width,c.depth,h)*1.48}; }
