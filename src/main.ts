import './style.css';
import { createIcons, Box, ChevronDown, ArrowUpRight, Undo2, Redo2, Download, Save, MousePointer2, Orbit, ZoomIn, ZoomOut, RotateCcw, Move, RotateCw, Trash2, X, Sun, Sunset, Moon, Check, Plus, SlidersHorizontal, Layers3, Grid2X2, Maximize, Focus, Upload, Image, FileJson, ArrowLeft, Lightbulb, LockKeyhole, Info, Command, CheckCheck, Leaf, PanelLeftClose, Table2, Armchair, Monitor, LibraryBig, LampDesk, LampFloor, Sprout, RectangleHorizontal, Pencil } from 'lucide';
import { CATALOG, MATERIALS, CAMERA_LIMITS, displayName, clone, initialPlan, createItem, parsePlan, updateItem, type Plan, type Kind, type Mood } from './model';
import { StudyScene } from './scene';

const ICONS={Box,ChevronDown,ArrowUpRight,Undo2,Redo2,Download,Save,MousePointer2,Orbit,ZoomIn,ZoomOut,RotateCcw,Move,RotateCw,Trash2,X,Sun,Sunset,Moon,Check,Plus,SlidersHorizontal,Layers3,Grid2X2,Maximize,Focus,Upload,Image,FileJson,ArrowLeft,Lightbulb,LockKeyhole,Info,Command,CheckCheck,Leaf,PanelLeftClose,Table2,Armchair,Monitor,LibraryBig,LampDesk,LampFloor,Sprout,RectangleHorizontal,Pencil};
const icon=(name:string,cls='')=>`<i data-lucide="${name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase()}" class="${cls}" aria-hidden="true"></i>`;
const icons=()=>createIcons({icons:ICONS,attrs:{'stroke-width':1.6}});
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const escapeHTML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
const STORAGE='ideal-study.plan.v1';
let plan=initialPlan(),savedSignature='',restored=false,loadError='';
try{const raw=localStorage.getItem(STORAGE);if(raw){const stored=JSON.parse(raw);plan=parsePlan(stored.plan);savedSignature=signature(plan);restored=true;}}catch{loadError='本地方案无法读取，已安全打开默认书房。原始存档未被覆盖。';}
let scene:StudyScene|undefined;
let past:Plan[]=[],future:Plan[]=[],transaction:Plan|null=null;
let category='全部',thumbs:Record<string,string>={},saveLabel=restored?'已恢复本地方案':'尚未保存',toastTimer=0,renderedSelection:string|null|undefined;
function signature(p:Plan){return JSON.stringify({...p,selectedId:null});}

$('#app').innerHTML=`
  <header class="topbar">
    <a class="brand" href="#" aria-label="理想书房首页"><span class="brand-mark">${icon('Box')}</span><span>理想书房<small>THE CONSIDERED SPACE</small></span></a>
    <div class="project"><span class="project-tag">我的空间</span><span class="slash">/</span><input id="plan-name" aria-label="方案名称" maxlength="48" value="${escapeHTML(plan.name)}"/><span class="name-edit">${icon('SlidersHorizontal')}</span><span id="save-state" class="save-state"></span></div>
    <nav class="top-actions" aria-label="方案操作"><button class="icon-btn" id="undo" title="撤销 Ctrl+Z" aria-label="撤销">${icon('Undo2')}</button><button class="icon-btn" id="redo" title="重做 Ctrl+Shift+Z" aria-label="重做">${icon('Redo2')}</button><span class="divider"></span><button class="button save-btn" id="save">${icon('Save')}<span>保存方案</span></button><button class="button primary" id="export">${icon('Download')}<span>导出</span>${icon('ChevronDown')}</button></nav>
  </header>
  <main class="workspace">
    <aside class="library panel" aria-label="物件库"><div class="panel-title"><div><span class="eyebrow">CURATED COLLECTION</span><h1>好物，恰到好处</h1></div><button class="icon-btn mobile-close" data-close-panel aria-label="关闭物件库">${icon('X')}</button></div><p class="panel-subtitle">为你的日常，添一点灵感。</p><div class="categories" role="group" aria-label="物件分类">${['全部','家具','灯光','配饰'].map(c=>`<button data-category="${c}" class="${c==='全部'?'active':''}">${c}</button>`).join('')}</div><div id="catalog" class="catalog"></div><div class="collection-note">${icon('Leaf')}<span>8 件精选好物，无限布置可能</span></div><div class="library-footer"><div class="little-symbol">${icon('Box')}</div><div><strong>空间由你定义</strong><span>点击物件，即可加入书房</span></div>${icon('ArrowUpRight')}</div></aside>
    <section class="stage" aria-label="三维空间编辑区">
      <div id="canvas-host"><div class="loading" id="loading"><span class="spinner"></span><strong>让灵感，有处安放</strong><span>正在构建你的 3D 书房…</span></div></div>
      <div class="stage-meta"><span class="live-dot"></span><span>实时空间</span><span class="meta-divider">/</span><span>5.2 × 4.4 m</span></div>
      <button class="mobile-library button" id="open-library">${icon('Grid2X2')}物件库</button>
      <div class="stage-heading"><div class="eyebrow">A ROOM OF YOUR OWN</div><span id="scene-caption">光落之处，灵感生长。</span></div>
      <div class="view-switch" role="group" aria-label="视角预设"><button class="active" data-view="default">${icon('Box')}透视</button><button data-view="top">${icon('Grid2X2')}俯视</button><button data-view="close">${icon('Focus')}近景</button></div>
      <div class="mode-switch" role="group" aria-label="操作模式"><button id="edit-mode" class="active" aria-pressed="true" title="选择与移动 V">${icon('MousePointer2')}<span>布置</span><kbd>V</kbd></button><button id="orbit-mode" aria-pressed="false" title="旋转观察 C">${icon('Orbit')}<span>观察</span><kbd>C</kbd></button></div>
      <div class="camera-tools"><button class="icon-btn" id="zoom-in" title="放大" aria-label="放大">${icon('ZoomIn')}</button><button class="icon-btn" id="zoom-out" title="缩小" aria-label="缩小">${icon('ZoomOut')}</button><span></span><button class="icon-btn" id="reset-view" title="恢复默认视角" aria-label="恢复默认视角">${icon('RotateCcw')}</button></div>
      <div class="stage-hint" id="stage-hint">${icon('MousePointer2')}点击选择 · 拖动物件移动<span>右键拖动观察 · 滚轮缩放</span></div>
      <div class="atmosphere"><div class="atmosphere-label">${icon('Sun')}<span>此刻的光</span></div><div class="mood-buttons" role="group" aria-label="光照预设"><button data-mood="day">${icon('Sun')}<span>白昼<small>10:00 AM</small></span></button><button data-mood="dusk">${icon('Sunset')}<span>黄昏<small>05:30 PM</small></span></button><button data-mood="night">${icon('Moon')}<span>深夜<small>10:00 PM</small></span></button></div><span class="mood-note" id="mood-note">让自然光，照亮思绪</span></div>
    </section>
    <aside id="properties" class="properties panel" aria-label="属性面板"></aside>
  </main>
  <footer class="statusbar"><span>${icon('CheckCheck')}<span id="object-count"></span><span class="status-sep">·</span><span>0.1 m 位置吸附</span></span><span>${icon('LockKeyhole')}方案仅保存在当前浏览器<span class="status-sep">·</span><span class="version">IDEAL STUDY / 01</span></span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="export-dialog"><div class="dialog-head"><div><span class="eyebrow">KEEP YOUR INSPIRATION</span><h2>留住这一刻的理想</h2></div><button id="close-dialog" class="icon-btn" aria-label="关闭导出">${icon('X')}</button></div><p>把布置分享成图片，或将方案带到另一个浏览器。</p><button class="export-option" id="export-png"><span class="export-icon">${icon('Image')}</span><span><strong>导出空间图片</strong><small>PNG · 2 倍清晰度 · 仅含当前 3D 画面</small></span>${icon('ArrowUpRight')}</button><button class="export-option" id="export-json"><span class="export-icon">${icon('FileJson')}</span><span><strong>导出可编辑方案</strong><small>JSON · 保留物件、材质、灯光与镜头</small></span>${icon('ArrowUpRight')}</button><div class="import-divider"><span>或继续已有的灵感</span></div><button class="button import-button" id="import-json">${icon('Upload')}导入 JSON 方案</button><div class="dialog-note">${icon('Info')}导入会替换当前画面，可通过「撤销」恢复。</div></dialog>
  <input type="file" id="file-input" accept=".json,application/json" hidden />
`;

function toast(message:string,error=false){
  const el=$('#toast'),modal=$<HTMLDialogElement>('#export-dialog'),inDialog=modal?.open;
  (inDialog?modal:document.body).append(el);
  el.innerHTML=`${icon(error?'Info':'Check')}<span>${escapeHTML(message)}</span>`;el.className=`toast visible ${inDialog?'in-dialog':''} ${error?'error':''}`;icons();window.clearTimeout(toastTimer);
  if(!inDialog)toastTimer=window.setTimeout(()=>el.classList.remove('visible'),4400);
}
function current(){return plan.objects.find(o=>o.id===plan.selectedId);}
function begin(){if(!transaction){if(scene)plan.camera=scene.getCamera();transaction=clone(plan);}}
function finish(){if(!transaction)return;if(signature(transaction)!==signature(plan)){past.push(transaction);if(past.length>80)past.shift();future=[];}transaction=null;refresh(false);}
function mutate(fn:()=>void,panel=true){begin();fn();finish();refresh(panel);}
function refresh(panel=true){scene?.sync(plan);$('#undo').toggleAttribute('disabled',!past.length);$('#redo').toggleAttribute('disabled',!future.length);$('#object-count').textContent=`${plan.objects.length} 件物件`;const dirty=signature(plan)!==savedSignature;$('#save-state').innerHTML=`<span class="${dirty?'unsaved':''}"></span>${dirty?'未保存更改':saveLabel}`;document.querySelectorAll<HTMLElement>('[data-mood]').forEach(b=>{b.classList.toggle('active',b.dataset.mood===plan.mood);b.setAttribute('aria-pressed',String(b.dataset.mood===plan.mood));});$('#mood-note').textContent={day:'让自然光，照亮思绪',dusk:'让暖光，放慢时间',night:'给深夜，留一盏灯'}[plan.mood];$('#scene-caption').textContent={day:'光落之处，灵感生长。',dusk:'把时间，交给温柔的光。',night:'世界安静，思绪明亮。'}[plan.mood];$('.stage').dataset.mood=plan.mood;if(panel)renderPanel();updateCameraUI();icons();}
function renderCatalog(){const list=(Object.keys(CATALOG) as Kind[]).filter(k=>category==='全部'||CATALOG[k].category===category);$('#catalog').innerHTML=list.map(k=>`<button class="catalog-card" data-add="${k}" aria-label="添加${CATALOG[k].name}"><span class="thumb">${thumbs[k]?`<img src="${thumbs[k]}" alt="${CATALOG[k].name}三维缩略图" draggable="false"/>`:icon(CATALOG[k].icon)}<span class="add-mark">${icon('Plus')}</span></span><strong>${CATALOG[k].name}</strong><small>${CATALOG[k].category} <span> / </span> ${k==='desk'?'1.95 m':k==='shelf'?'2.05 m':k==='rug'?'2.50 m':'精选'}</small></button>`).join('');document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{try{const item=createItem(plan,(b as HTMLElement).dataset.add as Kind);mutate(()=>{plan.objects.push(item);plan.selectedId=item.id;});toast(`已添加${CATALOG[item.kind].name}${item.parentId?'，已放置在书桌上':''}`);document.body.classList.remove('library-open');}catch(e){toast((e as Error).message,true);}}));icons();}
function pickerMarkup(){return `<span class="object-picker-wrap">${icon('Layers3')}<select id="object-picker" aria-label="切换当前物件" title="切换物件或返回空间概览"><option value="">空间概览 · ${plan.objects.length} 件物件</option>${plan.objects.map(item=>`<option value="${item.id}" ${item.id===plan.selectedId?'selected':''}>${escapeHTML(displayName(item,plan.objects))}</option>`).join('')}</select>${icon('ChevronDown')}</span>`;}
function wirePicker(){const picker=$<HTMLSelectElement>('#object-picker');picker.onchange=()=>{select(picker.value||null);$('#object-picker').focus({preventScroll:true});};}
function renderPanel(){
  const o=current();
  const focused=document.activeElement as HTMLElement|null;
  const restoreFocus=focused?.closest('#properties')?(focused.id?`#${focused.id}`:focused.dataset.material?`[data-material="${focused.dataset.material}"]`:null):null;
  const selectionChanged=renderedSelection!==plan.selectedId;renderedSelection=plan.selectedId;
  if(selectionChanged)$('#properties').scrollTop=0;
  if(!o){$('#properties').innerHTML=`<div class="panel-heading">${pickerMarkup()}<span class="subtle-tag">STUDIO 01</span></div><div class="intro-card"><span class="intro-overline">你的理想，自有形状。</span><h2>为灵感，<br/>留一处空间<span>。</span></h2><p>一张书桌，一盏暖灯。<br/>从这里，开始你喜欢的日常。</p><div class="intro-rule"></div><div class="space-stats"><span><strong>22.9<small>m²</small></strong>房间面积</span><span><strong>08<small>类</small></strong>精选物件</span></div><span class="intro-leaf">${icon('Sprout')}</span></div><div class="guide-title">让布置变得简单</div><div class="guide"><span>${icon('MousePointer2')}</span><div><strong>选中你喜欢的物件</strong><p>点击场景物件，查看与修改属性</p></div></div><div class="guide"><span>${icon('Move')}</span><div><strong>挪到刚刚好的位置</strong><p>直接拖动，自动吸附 0.1 米网格</p></div></div><div class="guide"><span>${icon('Orbit')}</span><div><strong>换个角度看生活</strong><p>右键拖动观察，滚轮拉近细节</p></div></div><div class="scene-list-title"><span>${icon('Layers3')}空间中的物件</span><small>${String(plan.objects.length).padStart(2,'0')}</small></div><div class="scene-list">${plan.objects.map(item=>`<button data-select="${item.id}" title="${escapeHTML(displayName(item,plan.objects))}">${icon(CATALOG[item.kind].icon)}<span>${escapeHTML(displayName(item,plan.objects))}</span>${icon('ArrowUpRight')}</button>`).join('')}</div><div class="property-tip">${icon('LockKeyhole')}灵感私藏于此，无需登录。</div>`;
    document.querySelectorAll<HTMLElement>('[data-select]').forEach(b=>b.onclick=()=>select(b.dataset.select!));wirePicker();icons();return;
  }
  const def=CATALOG[o.kind],m=MATERIALS[o.material];
  $('#properties').innerHTML=`<div class="panel-heading">${pickerMarkup()}<button class="icon-btn small" id="deselect" aria-label="取消选择">${icon('X')}</button></div><div class="selected-preview">${thumbs[o.kind]?`<img src="${thumbs[o.kind]}" alt="${def.name}"/>`:''}<span class="selected-badge"><span></span>已选中</span><span class="preview-category">${def.category}</span></div><div class="selected-title"><label class="object-name-label"><input id="object-name" aria-label="物件名称" title="为这个物件命名" maxlength="24" value="${escapeHTML(displayName(o,plan.objects))}"/>${icon('Pencil')}</label><p>${def.en}</p></div><div class="dimensions">${def.width.toFixed(2)} × ${def.depth.toFixed(2)} × ${def.height.toFixed(2)} m</div><section class="property-section"><div class="section-label"><span>${icon('Move')}位置</span><small>${o.parentId?'固定于桌面 · 0.78 m':'地面放置'} / m</small></div><div class="position-fields"><label><span>X</span><input id="pos-x" aria-label="X 位置" type="number" step="0.1" value="${o.x.toFixed(2)}"/></label><label><span>Z</span><input id="pos-z" aria-label="Z 位置" type="number" step="0.1" value="${o.z.toFixed(2)}"/></label></div><div class="rotation-label"><span>朝向</span><span><input id="rotation" type="number" aria-label="朝向角度" min="0" max="360" step="15" value="${Math.round(o.rotation)}"/>°</span></div><div class="rotate-controls"><button id="rotate-left" aria-label="向左旋转15度">${icon('RotateCcw')} −15°</button><button id="rotate-right" aria-label="向右旋转15度">${icon('RotateCw')} +15°</button></div></section><section class="property-section"><div class="section-label"><span>${icon('Layers3')}材质与颜色</span></div><div class="material-options">${def.materials.map(k=>`<button class="material-option ${o.material===k?'active':''}" data-material="${k}" aria-label="材质：${MATERIALS[k].name}" aria-pressed="${o.material===k}"><span class="swatch ${k==='oak'||k==='walnut'?'wood':''}" style="--swatch:${MATERIALS[k].color}">${o.material===k?icon('Check'):''}</span><small>${MATERIALS[k].name}</small></button>`).join('')}</div><p class="material-description">${m.detail}</p></section>${['taskLamp','floorLamp'].includes(o.kind)?`<section class="property-section light-section"><div class="section-label"><span>${icon('Lightbulb')}灯光</span><button id="light-toggle" role="switch" aria-checked="${o.on}" aria-label="灯具开关" class="toggle ${o.on?'on':''}"><span></span></button></div><div class="brightness-label"><label for="brightness">亮度</label><span id="brightness-value">${o.brightness}%</span></div><input id="brightness" aria-label="灯光亮度" type="range" min="0" max="100" step="1" value="${o.brightness}" ${!o.on?'disabled':''}/><div class="range-labels"><span>柔和</span><span>明亮</span></div></section>`:''}<div class="selection-help">${icon('Info')}方向键微调位置 · R 旋转<br/>Delete 删除 · Esc 取消选择</div><button class="delete-button" id="delete-item">${icon('Trash2')}移除${o.kind==='desk'?'书桌及桌面物件':'物件'}</button>`;
  wirePicker();
  $<HTMLInputElement>('#object-name').onchange=e=>{
    const input=e.target as HTMLInputElement,label=input.value.trim();
    if(!label||label.length>24){toast('物件名称须为 1–24 个字符。',true);renderPanel();return;}
    if(plan.objects.some(item=>item.id!==o.id&&displayName(item,plan.objects)===label)){toast('已有同名物件，请换个名称。',true);renderPanel();return;}
    if(label===displayName(o,plan.objects))return;
    mutate(()=>{plan.objects=plan.objects.map(item=>item.id===o.id?{...item,label}:item);});
  };
  $('#deselect').onclick=()=>select(null);
  for(const field of ['x','z'] as const){const input=$<HTMLInputElement>('#pos-'+field);input.onchange=()=>{const n=Number(input.value);if(!Number.isFinite(n)||input.value.trim()===''){toast('请输入有效的坐标。',true);renderPanel();return;}mutate(()=>updateItem(plan,o.id,{[field]:n},true));};}
  $<HTMLInputElement>('#rotation').onchange=e=>{const input=e.target as HTMLInputElement,n=Number(input.value);if(!Number.isFinite(n)||!input.value.trim()){toast('请输入有效的角度。',true);renderPanel();return;}mutate(()=>updateItem(plan,o.id,{rotation:n}));};
  $('#rotate-left').onclick=()=>rotate(-15);$('#rotate-right').onclick=()=>rotate(15);
  document.querySelectorAll<HTMLElement>('[data-material]').forEach(b=>b.onclick=()=>mutate(()=>updateItem(plan,o.id,{material:b.dataset.material!})));
  if($('#light-toggle'))$('#light-toggle').onclick=()=>mutate(()=>updateItem(plan,o.id,{on:!current()!.on}));
  const range=$<HTMLInputElement>('#brightness');if(range){range.onpointerdown=()=>begin();range.oninput=()=>{begin();updateItem(plan,o.id,{brightness:Number(range.value)});$('#brightness-value').textContent=range.value+'%';refresh(false);};range.onchange=()=>finish();range.onblur=()=>finish();}
  const preview=$<HTMLImageElement>('.selected-preview img');if(preview&&thumbs[`${o.kind}:${o.material}`])preview.src=thumbs[`${o.kind}:${o.material}`];
  $('#delete-item').onclick=remove;icons();if(selectionChanged)$('#properties').scrollTop=0;else if(restoreFocus)$(restoreFocus)?.focus({preventScroll:true});
}
function select(id:string|null){plan.selectedId=id;refresh();}
function rotate(delta:number){const o=current();if(o)mutate(()=>updateItem(plan,o.id,{rotation:o.rotation+delta}));}
function remove(){const o=current();if(!o)return;mutate(()=>{plan.objects=plan.objects.filter(item=>item.id!==o.id&&item.parentId!==o.id);plan.selectedId=null;});toast(`已移除${CATALOG[o.kind].name}，可撤销恢复`);}
function undo(){finish();if(!past.length)return;future.push(clone(plan));plan=past.pop()!;scene?.applyCamera(plan.camera);$<HTMLInputElement>('#plan-name').value=plan.name;refresh();toast('已撤销上一步');}
function redo(){finish();if(!future.length)return;past.push(clone(plan));plan=future.pop()!;scene?.applyCamera(plan.camera);$<HTMLInputElement>('#plan-name').value=plan.name;refresh();toast('已重做');}
function save(){finish();if(scene)plan.camera=scene.getCamera();try{localStorage.setItem(STORAGE,JSON.stringify({plan,savedAt:new Date().toISOString()}));savedSignature=signature(plan);saveLabel='已保存到本地';refresh(false);toast('方案已保存到当前浏览器，刷新后可恢复');}catch{toast('本地保存失败，浏览器存储不可用或已满。请导出 JSON 备份。',true);}}
function download(blob:Blob,extension:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(plan.name.replace(/[\\/:*?"<>|]/g,'-')||'理想书房')+'.'+extension;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),10000);}
function updateCameraUI(){if(!scene)return;const view=scene.getView();document.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('#zoom-in').toggleAttribute('disabled',scene.camera.zoom>=CAMERA_LIMITS.maxZoom);$('#zoom-out').toggleAttribute('disabled',scene.camera.zoom<=CAMERA_LIMITS.minZoom);}
function setMode(mode:'edit'|'orbit'){scene?.setMode(mode);$('#edit-mode').setAttribute('aria-pressed',String(mode==='edit'));$('#orbit-mode').setAttribute('aria-pressed',String(mode==='orbit'));$('#edit-mode').classList.toggle('active',mode==='edit');$('#orbit-mode').classList.toggle('active',mode==='orbit');$('#stage-hint').innerHTML=mode==='edit'?`${icon('MousePointer2')}点击选择 · 拖动物件移动<span>右键拖动观察 · 滚轮缩放</span>`:`${icon('Orbit')}拖动旋转观察 · 滚轮缩放<span>切回「布置」即可编辑物件</span>`;icons();}
$('#undo').onclick=undo;$('#redo').onclick=redo;$('#save').onclick=save;
$('#edit-mode').onclick=()=>setMode('edit');$('#orbit-mode').onclick=()=>setMode('orbit');
$('#zoom-in').onclick=()=>scene?.zoom(.15);$('#zoom-out').onclick=()=>scene?.zoom(-.15);
$('#reset-view').onclick=()=>{scene?.view('default');updateCameraUI();};
document.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>b.onclick=()=>{scene?.view(b.dataset.view as 'default'|'top'|'close');updateCameraUI();});
document.querySelectorAll<HTMLElement>('[data-mood]').forEach(b=>b.onclick=()=>mutate(()=>{plan.mood=b.dataset.mood as Mood;},false));
document.querySelectorAll<HTMLElement>('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category!;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x===b));renderCatalog();});
$<HTMLInputElement>('#plan-name').onchange=e=>{const input=e.target as HTMLInputElement,name=input.value.trim();if(!name){input.value=plan.name;toast('给这间书房取个名字吧。',true);return;}mutate(()=>{plan.name=name;},false);};
const dialog=$<HTMLDialogElement>('#export-dialog');$('#export').onclick=()=>{$('#toast').classList.remove('visible');dialog.showModal();};dialog.addEventListener('close',()=>{const el=$('#toast');if(el.parentElement===dialog){el.classList.remove('visible','in-dialog');document.body.append(el);}});$('#close-dialog').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}};
$('#export-json').onclick=()=>{try{finish();if(scene)plan.camera=scene.getCamera();download(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}),'json');toast('JSON 方案已生成，已交给浏览器下载');}catch{toast('方案导出失败，请重试。',true);}};
$('#export-png').onclick=async()=>{if(!scene){toast('3D 渲染不可用，暂时无法生成图片。',true);return;}const b=$<HTMLButtonElement>('#export-png');b.disabled=true;try{toast('正在生成高清空间图片…');const blob=await scene.exportPNG();download(blob,'png');toast('PNG 图片已生成，已交给浏览器下载');}catch(e){toast((e as Error).message,true);}finally{b.disabled=false;}};
$('#import-json').onclick=()=>$<HTMLInputElement>('#file-input').click();
$<HTMLInputElement>('#file-input').onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('文件过大，请导入小于 2 MB 的 JSON 方案。');const imported=parsePlan(JSON.parse(await file.text()));mutate(()=>{plan=imported;});scene?.applyCamera(plan.camera);$<HTMLInputElement>('#plan-name').value=plan.name;dialog.close();toast('方案已导入，可继续编辑；请保存以保留到本地');}catch(e){toast(e instanceof SyntaxError?'JSON 格式错误，当前方案未更改。':(e as Error).message,true);}finally{input.value='';}};
$('#open-library').onclick=()=>document.body.classList.add('library-open');document.querySelectorAll<HTMLElement>('[data-close-panel]').forEach(b=>b.onclick=()=>document.body.classList.remove('library-open'));
document.addEventListener('keydown',e=>{
  const editing=(e.target as HTMLElement).matches('input,textarea,select,[contenteditable]');
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(editing)(e.target as HTMLElement).blur();save();return;}
  if(editing||dialog.open)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(e.key==='Escape'){select(null);const wasOpen=document.body.classList.contains('library-open');document.body.classList.remove('library-open');if(wasOpen)$('#open-library').focus();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
  if(e.key.toLowerCase()==='r')rotate(15);
  if(e.key.toLowerCase()==='v')setMode('edit');if(e.key.toLowerCase()==='c')setMode('orbit');
  const o=current();if(o&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const d=e.shiftKey?.5:.1;mutate(()=>updateItem(plan,o.id,{x:o.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0),z:o.z+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0)},true));}
});
window.addEventListener('beforeunload',e=>{if(signature(plan)!==savedSignature){e.preventDefault();}});

renderCatalog();refresh();
requestAnimationFrame(()=>{window.setTimeout(()=>{
  try{
    scene=new StudyScene($('#canvas-host'),{select,begin,move:(id,x,z)=>{updateItem(plan,id,{x,z},true);scene?.sync(plan);const o=current();if(o){const xField=$<HTMLInputElement>('#pos-x'),zField=$<HTMLInputElement>('#pos-z');if(xField)xField.value=o.x.toFixed(2);if(zField)zField.value=o.z.toFixed(2);}},end:()=>{finish();refresh();},camera:()=>{if(scene){plan.camera=scene.getCamera();updateCameraUI();const dirty=signature(plan)!==savedSignature;$('#save-state').innerHTML=`<span class="${dirty?'unsaved':''}"></span>${dirty?'未保存更改':saveLabel}`;}},error:message=>toast(message,true)});
    scene.sync(plan);scene.applyCamera(plan.camera);thumbs=scene.thumbnails();$('#loading').remove();renderCatalog();refresh();
    document.documentElement.dataset.ready='true';
    if(restored)toast('已从当前浏览器恢复你的书房');if(loadError)toast(loadError,true);
  }catch(error){$('#loading').innerHTML=`${icon('Info')}<strong>暂时无法打开 3D 空间</strong><span>请使用支持 WebGL 2 的桌面浏览器并开启硬件加速。<br/>你仍可通过顶部「导出」备份或导入 JSON 方案。</span>`;document.documentElement.dataset.ready='error';icons();console.error(error);}
},50);});

// Read-only instrumentation for reproducible browser acceptance. No test-only state mutations.
Object.defineProperty(window,'__study',{value:{getPlan:()=>clone(plan),history:()=>({past:past.length,future:future.length}),metrics:()=>scene?.getMetrics(),project:(id:string,local?:[number,number,number])=>{const group=scene?.groups.get(id);if(!group||!scene)return null;const v=group.position.clone();if(local){group.updateMatrixWorld(true);group.localToWorld(v.set(...local));}else v.y+=CATALOG[plan.objects.find(o=>o.id===id)!.kind].height*.5;v.project(scene.camera);const r=scene.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};},getCamera:()=>scene?.getCamera()},writable:false});
