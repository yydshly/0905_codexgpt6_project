import { emptyPortfolio, parsePortfolio, type Portfolio } from './portfolio-model';
export type Kind = 'desk' | 'chair' | 'monitor' | 'shelf' | 'taskLamp' | 'floorLamp' | 'plant' | 'rug' | 'sofa' | 'bed' | 'wallPhoto';
export type Mood = 'day' | 'dusk' | 'night';
export interface Item { id: string; kind: Kind; x: number; z: number; rotation: number; material: string; label?: string; parentId?: string; on?: boolean; brightness?: number; y?: number; width?: number; height?: number; photo?: string }
export interface CameraState { position: number[]; target: number[]; zoom: number }
export interface Plan { app: 'ideal-study'; version: 3; portfolio: Portfolio; name: string; mood: Mood; objects: Item[]; selectedId: string | null; camera: CameraState }
export const ROOM_STORAGE = 'ideal-study.plan.v3';
export const MAX_JSON_BYTES = 6 * 1024 * 1024;
export const defaultWallPhoto = (): Item => ({ id:'wall-art',kind:'wallPhoto',x:.6,y:1.93,z:-2.17,rotation:0,material:'oak',width:1.15,height:.82 });
export const dimensions = (item: Item) => item.kind === 'wallPhoto' ? { ...CATALOG.wallPhoto, width:item.width ?? 1.15, height:item.height ?? .82 } : CATALOG[item.kind];
export const DEFAULT_CAMERA: CameraState = { position: [7.8, 6.5, 9], target: [0, .85, -.1], zoom: 1 };
export const CAMERA_LIMITS={minZoom:.55,maxZoom:2.4,minPolar:.05,maxPolar:1.43,minAzimuth:-.48,maxAzimuth:2.02};
export const CATALOG: Record<Kind, { name: string; en: string; category: string; width: number; depth: number; height: number; materials: string[]; icon: string }> = {
  desk: { name: '原木书桌', en: 'Oak writing desk', category: '家具', width: 1.95, depth: .85, height: .78, materials: ['oak','walnut','ivory'], icon: 'Table2' },
  chair: { name: '弧背工作椅', en: 'Arc lounge chair', category: '家具', width: .62, depth: .65, height: .9, materials: ['sage','linen','charcoal'], icon: 'Armchair' },
  monitor: { name: '极简显示器', en: 'Studio display', category: '配饰', width: .82, depth: .25, height: .52, materials: ['charcoal','silver'], icon: 'Monitor' },
  shelf: { name: '格栅书架', en: 'Open oak shelf', category: '家具', width: 1.18, depth: .38, height: 2.05, materials: ['oak','walnut','ivory'], icon: 'LibraryBig' },
  taskLamp: { name: '蘑菇台灯', en: 'Mushroom table light', category: '灯光', width: .34, depth: .34, height: .42, materials: ['sage','ivory','terracotta'], icon: 'LampDesk' },
  floorLamp: { name: '弧线落地灯', en: 'Soft floor light', category: '灯光', width: .55, depth: .55, height: 1.65, materials: ['linen','sage','charcoal'], icon: 'LampFloor' },
  plant: { name: '琴叶榕', en: 'Fiddle-leaf fig', category: '配饰', width: .7, depth: .7, height: 1.35, materials: ['ivory','terracotta','charcoal'], icon: 'Sprout' },
  rug: { name: '手织羊毛毯', en: 'Woven wool rug', category: '配饰', width: 2.5, depth: 1.85, height: .025, materials: ['linen','sage','clay'], icon: 'RectangleHorizontal' },
  sofa: { name: '云朵双人沙发', en: 'Soft reading sofa', category: '家具', width:1.5,depth:.78,height:.78,materials:['linen','sage','clay'],icon:'Armchair' },
  bed: { name: '原木单人床', en: 'Oak guest bed', category: '家具', width:1.25,depth:2.0,height:.86,materials:['oak','walnut','ivory'],icon:'BedDouble' },
  wallPhoto: { name: '墙面相框', en: 'Your wall gallery', category: '配饰', width:1.15,depth:.04,height:.82,materials:['oak','walnut','charcoal'],icon:'Image' },
};
export const MATERIALS: Record<string, { name: string; color: string; detail: string }> = {
  oak: { name: '自然橡木', color: '#bb9469', detail: '哑光木纹 · 温润触感' },
  walnut: { name: '深胡桃木', color: '#66503d', detail: '细腻木纹 · 沉静自然' },
  ivory: { name: '暖陶白', color: '#e8e4d8', detail: '细磨砂 · 柔和哑光' },
  sage: { name: '鼠尾草绿', color: '#768270', detail: '自然低饱和 · 哑光质地' },
  linen: { name: '亚麻米白', color: '#c9bfaa', detail: '织物肌理 · 温暖柔软' },
  charcoal: { name: '石墨黑', color: '#363c39', detail: '深色哑光 · 克制细节' },
  silver: { name: '雾银', color: '#a5aaa6', detail: '拉丝金属 · 细腻反射' },
  terracotta: { name: '赤陶', color: '#ad7359', detail: '自然陶土 · 温柔暖色' },
  clay: { name: '浅陶粉', color: '#c89b88', detail: '织物肌理 · 柔和暖调' },
};
export const clone = <T>(value: T): T => structuredClone(value);
export function displayName(item:Item,objects:Item[]) {
  if(item.label)return item.label;
  const siblings=objects.filter(o=>o.kind===item.kind);
  return CATALOG[item.kind].name+(siblings.length>1?' '+String(siblings.findIndex(o=>o.id===item.id)+1).padStart(2,'0'):'');
}
export function initialPlan(): Plan {
  return { app: 'ideal-study', version: 3, portfolio: emptyPortfolio(), name: '林间 · 我的创作书房', mood: 'day', selectedId: null, camera: clone(DEFAULT_CAMERA), objects: [
    { id: 'rug-1', kind: 'rug', x: .25, z: .4, rotation: 0, material: 'linen' },
    { id: 'desk-1', kind: 'desk', x: .65, z: -1.12, rotation: 0, material: 'oak' },
    { id: 'chair-1', kind: 'chair', x: .58, z: -.02, rotation: -12, material: 'sage' },
    { id: 'monitor-1', kind: 'monitor', x: .65, z: -1.27, rotation: 0, material: 'charcoal', parentId: 'desk-1' },
    { id: 'shelf-1', kind: 'shelf', x: -1.48, z: -1.87, rotation: 0, material: 'oak' },
    { id: 'taskLamp-1', kind: 'taskLamp', x: -.05, z: -1.18, rotation: 0, material: 'sage', parentId: 'desk-1', on: true, brightness: 65 },
    { id: 'floorLamp-1', kind: 'floorLamp', x: 2.04, z: -1.5, rotation: 0, material: 'linen', on: true, brightness: 70 },
    { id: 'plant-1', kind: 'plant', x: -1.88, z: .91, rotation: 15, material: 'ivory' },
    defaultWallPhoto(),
  ] };
}
export function localPoint(x: number, z: number, parent: Item) {
  const a = parent.rotation * Math.PI / 180, dx = x - parent.x, dz = z - parent.z;
  return { x: dx * Math.cos(a) - dz * Math.sin(a), z: dx * Math.sin(a) + dz * Math.cos(a) };
}
export function worldPoint(x: number, z: number, parent: Item) {
  const a = parent.rotation * Math.PI / 180;
  return { x: parent.x + x * Math.cos(a) + z * Math.sin(a), z: parent.z - x * Math.sin(a) + z * Math.cos(a) };
}
export function halfBounds(item: Item) {
  const c = dimensions(item), a = item.rotation * Math.PI / 180;
  return { x: (Math.abs(Math.cos(a))*c.width + Math.abs(Math.sin(a))*c.depth)/2, z: (Math.abs(Math.sin(a))*c.width + Math.abs(Math.cos(a))*c.depth)/2 };
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function constrain(item: Item, objects: Item[], snap = true): Item {
  if(item.kind==='wallPhoto') {
    const width=clamp(item.width??1.15,.4,1.8),height=clamp(item.height??.82,.3,1.2);
    return {...item,width,height,x:clamp(snap?Math.round(item.x*10)/10:item.x,-2.55+width/2,2.55-width/2),y:clamp(snap?Math.round((item.y??1.93)*10)/10:item.y??1.93,.25+height/2,2.75-height/2),z:-2.17,rotation:0};
  }
  let { x, z } = item;
  if (snap) { x = Math.round(x*10)/10; z = Math.round(z*10)/10; }
  const parent = objects.find(o=>o.id===item.parentId);
  if (parent) {
    const p = localPoint(x,z,parent), bounds = halfBounds({...item, rotation:item.rotation-parent.rotation});
    const v = worldPoint(clamp(p.x,-.965+bounds.x,.965-bounds.x),clamp(p.z,-.415+bounds.z,.415-bounds.z),parent);
    x = v.x; z = v.z;
  } else {
    const b = halfBounds(item);
    x = clamp(x,-2.6+b.x,2.6-b.x); z = clamp(z,-2.2+b.z,2.2-b.z);
  }
  return {...item, x: Math.round(x*10000)/10000, z:Math.round(z*10000)/10000, rotation: ((item.rotation%360)+360)%360};
}
export function updateItem(plan: Plan, id: string, patch: Partial<Item>, snap = false) {
  const before = plan.objects.find(o=>o.id===id);
  if (!before) return;
  const after = constrain({...before,...patch},plan.objects,snap);
  plan.objects = plan.objects.map(o=> {
    if(o.id===id) return after;
    if(o.parentId===id) {
      const p=localPoint(o.x,o.z,before), v=worldPoint(p.x,p.z,after);
      return {...o,...v,rotation:(o.rotation+after.rotation-before.rotation+360)%360};
    }
    return o;
  });
}
export function createItem(plan: Plan, kind: Kind): Item {
  if(plan.objects.length>=40) throw new Error('当前方案最多容纳 40 件物件，请先移除一些物件。');
  const item: Item = { id: `${kind}-${crypto.randomUUID()}`, kind, x:0, z:.8, rotation:0,material:CATALOG[kind].materials[0] };
  if(kind==='wallPhoto') {
    if(plan.objects.filter(o=>o.kind==='wallPhoto').length>=3)throw new Error('最多放置 3 个墙面相框，可替换已有相框的照片。');
    for(const x of [1.65,-.6,-1.8,.6]) {
      const candidate=constrain({...item,x,y:2.02,width:.65,height:.55},plan.objects,false);
      if(!plan.objects.some(o=>o.kind==='wallPhoto'&&Math.abs(o.x-candidate.x)<((o.width??1.15)+.65)/2+.08))return candidate;
    }
    throw new Error('背墙画框空间不足，请先调整已有相框。');
  }
  if(plan.objects.some(o=>o.kind===kind)) {
    const names=new Set(plan.objects.map(o=>displayName(o,plan.objects)));let number=2;
    while(names.has(`${CATALOG[kind].name} ${String(number).padStart(2,'0')}`))number++;
    item.label=`${CATALOG[kind].name} ${String(number).padStart(2,'0')}`;
  }
  if(kind==='taskLamp'||kind==='floorLamp') { item.on=true; item.brightness=70; }
  if(kind==='taskLamp'||kind==='monitor') {
    for(const desk of plan.objects.filter(o=>o.kind==='desk')) {
      for (const x of [.68,-.68,0,.4,-.4]) for (const z of [0,-.15,.15]) {
        const p = worldPoint(x,z,desk), candidate=constrain({...item,...p,parentId:desk.id,rotation:desk.rotation},plan.objects,false);
        if(!plan.objects.some(o=>o.parentId===desk.id && Math.abs(localPoint(candidate.x,candidate.z,desk).x-localPoint(o.x,o.z,desk).x)<(CATALOG[o.kind].width+CATALOG[kind].width)/2+.03 && Math.abs(localPoint(candidate.x,candidate.z,desk).z-localPoint(o.x,o.z,desk).z)<(CATALOG[o.kind].depth+CATALOG[kind].depth)/2+.02)) return candidate;
      }
    }
    throw new Error('书桌暂时没有足够空间。请移动桌面物件，或先添加一张书桌。');
  }
  for (let z=.8;z>=-1.9;z-=.5) for (let x=0;x<=2.5;x+=.5) for (const sign of [1,-1]) {
    const candidate=constrain({...item,x:x*sign,z},plan.objects,false), b=halfBounds(candidate);
    if(kind==='rug'||!plan.objects.some(o=>!o.parentId&&o.kind!=='rug'&&o.kind!=='wallPhoto'&&Math.abs(o.x-candidate.x)<halfBounds(o).x+b.x+.06&&Math.abs(o.z-candidate.z)<halfBounds(o).z+b.z+.06)) return candidate;
  }
  throw new Error('地面空间不足，请先调整现有家具。');
}
export function parsePlan(raw: unknown): Plan {
  if(!raw||typeof raw!=='object') throw new Error('文件内容不是有效的方案。');
  const p = raw as Plan;
  const version=(raw as {version:unknown}).version;
  if(p.app!=='ideal-study'||![1,2,3].includes(version as number)||typeof p.name!=='string'||!p.name.trim()||p.name.length>48||!['day','dusk','night'].includes(p.mood)||!Array.isArray(p.objects)||p.objects.length>40) throw new Error('请导入理想书房 v1、v2 或 v3 JSON 方案。');
  const ids=new Set<string>();
  const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
  for(const o of p.objects) {
    if(!o||typeof o!=='object'||typeof o.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(o.id)||ids.has(o.id)||!Object.hasOwn(CATALOG,o.kind)||!finite(o.x)||!finite(o.z)||!finite(o.rotation)||Math.abs(o.rotation)>3600||!CATALOG[o.kind].materials.includes(o.material)) throw new Error('方案物件数据无效或存在重复编号，当前方案未更改。');
    ids.add(o.id);
    if(version===1&&['sofa','bed','wallPhoto'].includes(o.kind))throw new Error('新增家具需要 v2 书房方案。');
    if(o.kind==='wallPhoto') {
      if(!finite(o.y)||!finite(o.width)||!finite(o.height)||o.width!<.4||o.width!>1.8||o.height!<.3||o.height!>1.2||o.rotation!==0||Math.abs(o.z+2.17)>.001)throw new Error('相框尺寸或墙面位置无效。');
      if(o.photo!==undefined&&(typeof o.photo!=='string'||o.photo.length>450000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(o.photo)))throw new Error('照片数据无效或过大，当前方案未更改。');
    }
    if(o.label!==undefined&&(typeof o.label!=='string'||!o.label.trim()||o.label.length>24)) throw new Error('物件名称须为 1–24 个字符，当前方案未更改。');
    if(['taskLamp','floorLamp'].includes(o.kind)&&(typeof o.on!=='boolean'||!finite(o.brightness)||o.brightness!<0||o.brightness!>100)) throw new Error('方案的灯光数据无效。');
    if(o.parentId!==undefined && typeof o.parentId!=='string') throw new Error('方案的桌面关联无效。');
  }
  for(const o of p.objects) {
    const tabletop=o.kind==='taskLamp'||o.kind==='monitor';
    if(tabletop!==!!o.parentId||(o.parentId&&!p.objects.some(parent=>parent.id===o.parentId&&parent.kind==='desk'))) throw new Error('桌面物件缺少有效的书桌，当前方案未更改。');
    const c=constrain(o,p.objects,false);
    if(Math.abs(c.x-o.x)>.005||Math.abs(c.z-o.z)>.005||(o.kind==='wallPhoto'&&Math.abs(c.y!-o.y!)>.005)) throw new Error('方案中有物件超出房间、墙面或桌面边界。');
  }
  if(p.objects.filter(o=>o.kind==='wallPhoto').length>3)throw new Error('方案最多支持 3 个墙面相框。');
  if(!p.camera||![p.camera.position,p.camera.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n)&&Math.abs(n)<100))||!finite(p.camera.zoom)||p.camera.zoom<CAMERA_LIMITS.minZoom||p.camera.zoom>CAMERA_LIMITS.maxZoom) throw new Error('方案镜头数据无效，当前方案未更改。');
  const [tx,ty,tz]=p.camera.target,[dx,dy,dz]=p.camera.position.map((n,i)=>n-p.camera.target[i]),distance=Math.hypot(dx,dy,dz);
  const polar=Math.acos(Math.max(-1,Math.min(1,dy/distance))),azimuth=Math.atan2(dx,dz),tolerance=.00002;
  // Exported poses round to five decimal places; retain a small angular tolerance at orbit limits.
  if(Math.abs(tx)>2.6||ty<0||ty>2.8||Math.abs(tz)>2.2||distance<1||distance>40||polar<CAMERA_LIMITS.minPolar-tolerance||polar>CAMERA_LIMITS.maxPolar+tolerance||azimuth<CAMERA_LIMITS.minAzimuth-tolerance||azimuth>CAMERA_LIMITS.maxAzimuth+tolerance) throw new Error('方案镜头超出可用观察范围，当前方案未更改。');
  const objects=p.objects.map(o=>({id:o.id,kind:o.kind,x:o.x,z:o.z,rotation:o.rotation,material:o.material,...(o.label!==undefined?{label:o.label.trim()}:{}),...(o.parentId?{parentId:o.parentId}:{}),...(o.kind==='wallPhoto'?{y:o.y,width:o.width,height:o.height,...(o.photo?{photo:o.photo}:{})}:{}),...(['taskLamp','floorLamp'].includes(o.kind)?{on:o.on,brightness:o.brightness}:{})}));
  // The formerly fixed decoration becomes editable; legacy furniture and camera stay intact.
  if(version===1&&objects.length<40){const art=defaultWallPhoto();while(ids.has(art.id))art.id+='-m';objects.push(art);}
  return { app:'ideal-study', version:3,portfolio:version===3?parsePortfolio(p.portfolio,objects):emptyPortfolio(),name:p.name.trim(),mood:p.mood,objects,camera:clone(p.camera),selectedId:typeof p.selectedId==='string'&&ids.has(p.selectedId)?p.selectedId:null };
}
