import './style.css';
import './studio.css';
import {preparePhotos} from './photos';
import { workspaceNav } from './workspace-nav';
import { createIcons, Box, Film, Play, Pause, SkipBack, SkipForward, Plus, ArrowUp, ArrowDown, Save, Download, Undo2, Redo2, Upload, FileJson, X, Check, Info, Camera, Focus, Move, Trash2, SlidersHorizontal, ArrowUpRight, CircleHelp, LockKeyhole, Image, CheckCheck } from 'lucide';
import { clone } from './model';
import { StudyScene } from './scene';
import { FPS, POSE_LIMITS, TARGET_LIMITS, cameraForPose, clamp, createFilmProject, loadFilmProject, parseFilmProject, poseFromCamera, projectSignature, sampleFilm, shotStart, storeFilmProject, totalDuration, type FilmProject, type Pose } from './film-model';
import { detectExportFormats, encodeFilm, type ExportFormat } from './film-export';
import { projectSession } from './project-session';
import { mountProjectMenu } from './project-menu';
import { captureThumbnail } from './project-thumbnail';

const ICONS = { Box, Film, Play, Pause, SkipBack, SkipForward, Plus, ArrowUp, ArrowDown, Save, Download, Undo2, Redo2, Upload, FileJson, X, Check, Info, Camera, Focus, Move, Trash2, SlidersHorizontal, ArrowUpRight, CircleHelp, LockKeyhole, Image, CheckCheck };
const icon = (name: string) => `<i data-lucide="${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}" aria-hidden="true"></i>`;
const icons = () => createIcons({ icons: ICONS, attrs: { 'stroke-width': 1.6 } });
const $ = <T extends HTMLElement = HTMLElement>(q: string) => document.querySelector<T>(q)!;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]!));
const timecode = (t: number) => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round(t * FPS) % FPS).padStart(2, '0')}`;
const session=await projectSession();
const loaded = session?{project:clone(session.record.project),restored:true,message:''}:loadFilmProject();
let leaving=false,saving:Promise<boolean>|null=null;
let project = loaded.project, saved = loaded.restored ? projectSignature(project) : '';
let scene: StudyScene | undefined, playing = false, adjusting = false, sampling = false, exporting = false;
let endpoint: 'start' | 'end' = 'start', frameHandle = 0, playOrigin = 0, playStart = 0;
let past: FilmProject[] = [], future: FilmProject[] = [], transaction: FilmProject | null = null;
let formats: ExportFormat[] = [], encoderReady = false, abort: AbortController | null = null;
let videoUrl = '', videoBlob: Blob | null = null, videoExtension = '', toastTimer = 0;
const thumbnails = new Map<string, { signature: string; url: string }>();
document.title = '理想书房 · 3D 镜头与短片工作台';
document.body.classList.add('film-app');

$('#app').innerHTML = `
<header class="film-header">
  <a class="brand film-brand" href="?workspace=film"><span class="brand-mark">${icon('Box')}</span><span>理想书房<small>THE CONSIDERED SPACE</small></span></a>
  ${workspaceNav('film')}
  <div class="film-project"><span class="film-project-tag">短片工程</span><input id="film-name" aria-label="工程名称" maxlength="48" value="${esc(project.name)}"/><span id="film-save-state"></span></div>
  <div class="film-actions"><button id="film-undo" class="icon-btn" aria-label="撤销" title="撤销 Ctrl+Z">${icon('Undo2')}</button><button id="film-redo" class="icon-btn" aria-label="重做" title="重做 Ctrl+Shift+Z">${icon('Redo2')}</button><span class="divider"></span><button id="film-save" class="button">${icon('Save')}<span>保存工程</span></button><button id="film-export" class="button primary">${icon('Download')}导出视频</button></div>
</header>
<main class="film-layout">
  <aside class="shot-panel" aria-label="镜头列表"><div class="film-section-head"><span class="eyebrow">YOUR STORY IN THREE SHOTS</span><h1>让空间，成为故事</h1><p>3D 镜头与短片工作台</p></div><div class="shot-list-heading"><span>${icon('Film')}镜头列表</span><span id="shot-count"></span></div><div id="shot-list"></div><button id="shot-add" class="film-add">${icon('Plus')}添加镜头 <span>最多 3 段</span></button><div class="shot-panel-footer"><p>先看见空间，再靠近日常。</p><button id="edit-room" class="button">${icon('Box')}保存并布置房间${icon('ArrowUpRight')}</button><small>家具、材质与灯光，沿用你的书房。</small></div></aside>
  <section class="film-preview" aria-label="短片三维预览"><div class="preview-top"><span><span class="film-dot"></span><strong id="preview-state">实时 3D 预览</strong></span><span>16:9 <b> / </b> 720p <b> / </b> 30 fps</span></div><div id="preview-wrap"><div id="film-canvas-host"><div id="film-loading" class="loading"><span class="spinner"></span><strong>让光与时间，走进书房</strong><span>正在编排你的十秒日常…</span></div></div><div class="frame-corners" aria-hidden="true"></div></div><div class="preview-bottom"><div><span id="current-shot-number">01</span><span id="current-shot-name"></span></div><span id="preview-time">00:00</span></div><div class="preview-guidance" id="preview-guidance">${icon('Camera')}选择镜头，调整起点与终点。按空格播放。</div><div class="film-mobile-note">建议使用桌面浏览器编辑镜头。此处可播放与拖动时间轴。</div></section>
  <aside class="shot-properties" aria-label="镜头属性"><div id="shot-properties"></div></aside>
  <section class="film-timeline" aria-label="短片时间轴"><div class="timeline-header"><div class="timeline-heading">${icon('Film')}时间轴 <span id="timeline-count"></span></div><div class="transport"><button id="film-start" class="icon-btn" aria-label="回到开头">${icon('SkipBack')}</button><button id="film-play" class="play-button" aria-label="播放短片">${icon('Play')}</button><button id="film-end" class="icon-btn" aria-label="前往结尾">${icon('SkipForward')}</button><span class="transport-time"><b id="transport-time">00:00</b><span>/</span><span id="total-time"></span></span></div><div class="timeline-hint">${icon('Move')}拖动播放头 · 空格播放/暂停</div></div><div class="timeline-body"><div class="timeline-track-name">${icon('Camera')}镜头轨道<small>平滑启停 · 顺序切换</small></div><div class="timeline-track"><div id="timeline-ruler"></div><div id="timeline-clips"></div><div id="playhead"><span></span></div><input id="film-scrub" type="range" aria-label="播放头" min="0" step="1" value="0"/></div></div><div class="timeline-footer"><span>${icon('LockKeyhole')}工程仅保存在当前浏览器</span><div><button id="film-json">${icon('FileJson')}导出工程 JSON</button><button id="film-import">${icon('Upload')}导入工程 / 旧方案</button></div><span>IDEAL STUDY <b>/</b> FILM 01</span></div></section>
</main>
<div id="film-toast" role="status" aria-live="polite"></div>
<input id="film-file" type="file" accept=".json,application/json" hidden/>
<dialog id="film-export-dialog"><div class="film-dialog-head"><div><span class="eyebrow">A LITTLE FILM OF YOUR OWN</span><h2>把日常，留在画面里</h2></div><button id="film-close-export" class="icon-btn" aria-label="关闭视频导出">${icon('X')}</button></div><p class="film-dialog-intro">导出真实 3D 画面，不包含工作台面板。</p><div class="export-spec"><span>1280 × 720</span><span>30 fps</span><span id="export-duration"></span><span>无音轨</span></div><label class="codec-label">视频格式<select id="film-codec" aria-label="视频编码格式"></select></label><p id="codec-note"></p><div id="export-progress-wrap" hidden><progress id="film-progress" max="1" value="0"></progress><p id="export-progress-text" role="status" aria-live="polite"></p></div><div id="video-result" hidden><video id="film-video" controls playsinline muted preload="auto" aria-label="导出视频回放"></video><p id="video-result-info"></p><button id="film-download" class="button primary">${icon('Download')}下载视频</button></div><p id="export-error" role="alert"></p><div class="film-dialog-actions"><button id="film-cancel" class="button" hidden>取消生成</button><button id="film-render" class="button primary">${icon('Film')}生成视频</button></div></dialog>`;

const selected = () => project.film.shots.find(s => s.id === project.selectedShotId)!;
function toast(message: string, error = false) { const el = $('#film-toast'); el.textContent = message; el.className = `visible ${error ? 'error' : ''}`; clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.className = '', 4400); }
function syncSave() { const dirty = projectSignature(project) !== saved; $('#film-save-state').textContent = dirty ? '未保存更改' : loaded.restored ? '已恢复本地工程' : '已保存到本地'; $('#film-save-state').classList.toggle('dirty', dirty); $('#film-undo').toggleAttribute('disabled', !past.length); $('#film-redo').toggleAttribute('disabled', !future.length); }
function begin() { if (!transaction) transaction = clone(project); }
function finish() { if (!transaction) return; if (projectSignature(transaction) !== projectSignature(project)) { past.push(transaction); if (past.length > 80) past.shift(); future = []; } transaction = null; syncSave(); }
function pause() { playing = false; cancelAnimationFrame(frameHandle); $('#film-play').innerHTML = icon('Play'); $('#film-play').setAttribute('aria-label', '播放短片'); $('#preview-state').textContent = '实时 3D 预览'; icons(); }
function setAdjust(value: boolean) { adjusting = value; scene?.setInteractionEnabled(value); $('#film-adjust')?.setAttribute('aria-pressed', String(value)); $('#preview-guidance').innerHTML = `${icon(value ? 'Move' : 'Camera')}${value ? `拖动调整${endpoint === 'start' ? '起点 A' : '终点 B'}机位，滚轮调整景别；松开即记为一次操作。` : '选择镜头，调整起点与终点。按空格播放。'}`; icons(); }
function drawAt(seconds: number, updateSelection = true) {
  const sample = sampleFilm(project, seconds); project.playhead = sample.time;
  const changed = project.selectedShotId !== sample.shot.id;
  if (updateSelection) project.selectedShotId = sample.shot.id;
  sampling = true; try { scene?.applyCamera(sample.camera); } finally { sampling = false; }
  $('#current-shot-number').textContent = String(sample.index + 1).padStart(2, '0'); $('#current-shot-name').textContent = sample.shot.name;
  $('#preview-time').textContent = timecode(sample.time); $('#transport-time').textContent = timecode(sample.time);
  $<HTMLInputElement>('#film-scrub').value = String(Math.round(sample.time * FPS));
  $('#playhead').style.left = `${sample.time / totalDuration(project) * 100}%`;
  $('#film-scrub').setAttribute('aria-valuetext', `${sample.time.toFixed(2)} 秒，镜头 ${sample.index + 1}：${sample.shot.name}`);
  document.querySelectorAll<HTMLElement>('[data-shot]').forEach(el => { const active = el.dataset.shot === project.selectedShotId; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
  if (changed && updateSelection) renderProperties();
}
function seek(t: number) { if (exporting) return; pause(); setAdjust(false); finish(); drawAt(t); }
function tick(now: number) { if (!playing) return; const time = playOrigin + (now - playStart) / 1000; drawAt(Math.floor(time * FPS) / FPS); if (time >= totalDuration(project)) { drawAt(totalDuration(project)); pause(); return; } frameHandle = requestAnimationFrame(tick); }
function play() { if (!scene || exporting) return; if (playing) { pause(); return; } finish(); setAdjust(false); if (project.playhead >= totalDuration(project)) drawAt(0); playing = true; playOrigin = project.playhead; playStart = performance.now(); $('#film-play').innerHTML = icon('Pause'); $('#film-play').setAttribute('aria-label', '暂停短片'); $('#preview-state').textContent = '正在播放'; icons(); frameHandle = requestAnimationFrame(tick); }
function showEndpoint() { const shot = selected(), start = shotStart(project, shot.id); drawAt(start + (endpoint === 'end' ? shot.duration - 1 / FPS : 0)); }
function mutate(fn: () => void, reposition=true) { pause(); setAdjust(false); finish(); begin(); fn(); if(reposition){const s=selected(); project.playhead=shotStart(project,s.id)+(endpoint==='end'?s.duration-1/FPS:0);} finish(); refresh(true); }
function choose(id: string) { if (exporting) return; pause(); setAdjust(false); finish(); project.selectedShotId = id; endpoint = 'start'; showEndpoint(); renderProperties(); }
function refresh(thumbs = false) { if (scene) scene.sync({ ...project.scene, selectedId: null }); if (thumbs) refreshThumbnails(); renderShots(); renderProperties(); renderTimeline(); syncSave(); drawAt(project.playhead); icons(); }
function refreshThumbnails() {
  if (!scene) return; sampling = true;
  const capture = scene.captureSession(320, 180);
  try { for (const shot of project.film.shots) { const signature = JSON.stringify([shot, project.scene]); if (thumbnails.get(shot.id)?.signature === signature) continue; const sample = sampleFilm(project, shotStart(project, shot.id) + shot.duration / 2); const canvas = capture.render(sample.camera); thumbnails.set(shot.id, { signature, url: canvas.toDataURL('image/jpeg', .82) }); } }
  finally { capture.close(); sampling = false; }
}
function renderShots() {
  $('#shot-count').textContent = `${project.film.shots.length} / 3`;
  $('#shot-list').innerHTML = project.film.shots.map((s, i) => `<button class="shot-card ${s.id === project.selectedShotId ? 'active' : ''}" data-shot="${s.id}" aria-label="选择镜头 ${i + 1}：${esc(s.name)}" aria-pressed="${s.id === project.selectedShotId}"><span class="shot-thumb">${thumbnails.has(s.id) ? `<img src="${thumbnails.get(s.id)!.url}" alt="${esc(s.name)}实时镜头缩略图"/>` : icon('Camera')}<span>${String(i + 1).padStart(2, '0')}</span><small>${s.duration.toFixed(1)} s</small></span><span class="shot-card-title">${esc(s.name)}<span>${icon('ArrowUpRight')}</span></span></button>`).join('');
  $('#shot-add').toggleAttribute('disabled', project.film.shots.length >= 3);
}
function renderProperties() {
  const s = selected(), index = project.film.shots.indexOf(s), pose = s[endpoint];
  $('#shot-properties').innerHTML = `<div class="shot-prop-head"><span>${icon('SlidersHorizontal')}镜头属性</span><b>${String(index + 1).padStart(2, '0')}</b></div><label class="shot-name-label"><input id="shot-name" aria-label="镜头名称" maxlength="24" value="${esc(s.name)}"/>${icon('Camera')}</label><p class="shot-prop-description">${shotStart(project, s.id).toFixed(1)}–${(shotStart(project, s.id) + s.duration).toFixed(1)} s <span> / </span> 当前编辑镜头</p><section><div class="film-label"><span>镜头时长</span><span class="muted">1–10 秒</span></div><label class="duration-field"><input id="shot-duration" aria-label="镜头时长" type="number" min="1" max="10" step="0.1" value="${s.duration.toFixed(1)}"/><span>秒</span></label></section><section><div class="film-label"><span>${icon('Camera')}镜头机位</span><span class="muted">平滑启停</span></div><div class="endpoint-tabs"><button data-endpoint="start" aria-pressed="${endpoint === 'start'}" class="${endpoint === 'start' ? 'active' : ''}"><b>A</b> 起点</button><span>→</span><button data-endpoint="end" aria-pressed="${endpoint === 'end'}" class="${endpoint === 'end' ? 'active' : ''}"><b>B</b> 终点</button></div><div class="pose-fields">${([['azimuth', '水平角', '°', '1'], ['elevation', '俯角', '°', '1'], ['zoom', '景别缩放', '×', '.01']] as const).map(([key, label, unit, step]) => `<label><span>${label}</span><span><input id="pose-${key}" aria-label="${label}" type="number" min="${POSE_LIMITS[key][0]}" max="${POSE_LIMITS[key][1]}" step="${step}" value="${pose[key].toFixed(key === 'zoom' ? 2 : 1)}"/><small>${unit}</small></span></label>`).join('')}</div><button id="film-adjust" class="button adjust-button" aria-pressed="${adjusting}">${icon('Move')}在画面中调整${endpoint === 'start' ? '起点' : '终点'}</button></section><section><div class="film-label"><span>${icon('Focus')}观察目标</span><span class="muted">空间坐标 / m</span></div><div class="target-fields">${['X', 'Y', 'Z'].map((axis, i) => `<label><span>${axis}</span><input id="target-${i}" aria-label="观察目标 ${axis}" type="number" min="${TARGET_LIMITS[i][0]}" max="${TARGET_LIMITS[i][1]}" step="0.05" value="${s.target[i].toFixed(2)}"/></label>`).join('')}</div><p class="target-help">起点与终点始终注视同一位置。<br/>安全机位限定在房间正面。</p></section><section class="shot-order"><div class="film-label">镜头顺序</div><div><button id="shot-up" class="button" ${index === 0 ? 'disabled' : ''}>${icon('ArrowUp')}前移</button><button id="shot-down" class="button" ${index === project.film.shots.length - 1 ? 'disabled' : ''}>${icon('ArrowDown')}后移</button><button id="shot-delete" class="icon-btn" aria-label="删除当前镜头" ${project.film.shots.length === 1 ? 'disabled' : ''}>${icon('Trash2')}</button></div></section>`;
  $<HTMLInputElement>('#shot-name').onchange = e => { const name = (e.target as HTMLInputElement).value.trim(); if (!name) { toast('镜头名称不能为空。', true); renderProperties(); return; } mutate(() => selected().name = name); };
  $<HTMLInputElement>('#shot-duration').onchange = e => { const v = Number((e.target as HTMLInputElement).value); if (!Number.isFinite(v) || v < 1 || v > 10) { toast('每个镜头的时长为 1–10 秒。', true); renderProperties(); return; } mutate(() => selected().duration = Math.round(v * 10) / 10); };
  document.querySelectorAll<HTMLElement>('[data-endpoint]').forEach(b => b.onclick = () => { pause(); setAdjust(false); endpoint = b.dataset.endpoint as typeof endpoint; showEndpoint(); renderProperties(); });
  for (const key of ['azimuth', 'elevation', 'zoom'] as const) $<HTMLInputElement>(`#pose-${key}`).onchange = e => { const input = e.target as HTMLInputElement, n = Number(input.value); if (!input.value.trim() || !Number.isFinite(n)) { toast('请输入有效机位数值。', true); renderProperties(); return; } mutate(() => selected()[endpoint][key] = clamp(n, POSE_LIMITS[key][0], POSE_LIMITS[key][1])); };
  for (let i = 0; i < 3; i++) $<HTMLInputElement>(`#target-${i}`).onchange = e => { const input = e.target as HTMLInputElement, n = Number(input.value); if (!input.value.trim() || !Number.isFinite(n)) { toast('请输入有效目标坐标。', true); renderProperties(); return; } mutate(() => selected().target[i] = clamp(n, TARGET_LIMITS[i][0], TARGET_LIMITS[i][1])); };
  $('#film-adjust').onclick = () => { pause(); if (!adjusting) showEndpoint(); setAdjust(!adjusting); };
  $('#shot-up').onclick = () => reorder(-1); $('#shot-down').onclick = () => reorder(1);
  $('#shot-delete').onclick = () => { if (project.film.shots.length === 1) return; mutate(() => { project.film.shots = project.film.shots.filter(shot => shot.id !== s.id); project.selectedShotId = project.film.shots[Math.min(index, project.film.shots.length - 1)].id; }); };
  icons();
}
function reorder(delta: number) { const index = project.film.shots.indexOf(selected()), next = index + delta; if (next < 0 || next >= project.film.shots.length) return; mutate(() => { [project.film.shots[index], project.film.shots[next]] = [project.film.shots[next], project.film.shots[index]]; }); }
function renderTimeline() {
  const total = totalDuration(project), tick = Math.max(1, Math.ceil(total / 6));
  $('#timeline-count').textContent = `${project.film.shots.length} 个镜头 · ${total.toFixed(1)} 秒`; $('#total-time').textContent = timecode(total);
  $('#timeline-ruler').innerHTML = Array.from({ length: Math.floor(total / tick) + 1 }, (_, i) => `<span style="left:${i * tick / total * 100}%">${i * tick}s</span>`).join('');
  $('#timeline-clips').innerHTML = project.film.shots.map((s, i) => `<button data-shot="${s.id}" class="timeline-clip ${s.id === project.selectedShotId ? 'active' : ''}" style="flex:${s.duration}" aria-label="时间轴镜头 ${i + 1}：${esc(s.name)}"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(s.name)}<small>${s.duration.toFixed(1)} s</small></span>${thumbnails.has(s.id) ? `<img src="${thumbnails.get(s.id)!.url}" alt=""/>` : ''}</button>`).join('');
  $<HTMLInputElement>('#film-scrub').max = String(Math.round(total * FPS));
}
function undo(redo = false) { pause(); setAdjust(false); finish(); const from = redo ? future : past, to = redo ? past : future; if (!from.length) return; to.push(clone(project)); project = from.pop()!; endpoint = 'start'; $('#film-name').setAttribute('value', project.name); $<HTMLInputElement>('#film-name').value = project.name; refresh(true); toast(redo ? '已重做' : '已撤销上一步'); }
function save():Promise<boolean>{
  if(saving)return saving;pause();setAdjust(false);finish();const snapshot=clone(project);
  saving=(async()=>{try{if(session){snapshot.scene.name=snapshot.name;let thumbnail:string|undefined;try{thumbnail=captureThumbnail(scene);}catch{}await session.save(snapshot,thumbnail);project.scene.name=snapshot.scene.name;}else storeFilmProject(snapshot);saved=projectSignature(snapshot);syncSave();if(projectSignature(project)===saved)$('#film-save-state').textContent='已保存到本地';toast(session?`已保存到工程库 · 版本 ${session.record.revision}`:'工程已保存到当前浏览器，刷新后可恢复。');return true;}catch(error){toast('本地保存失败：'+(error as Error).message,true);return false;}})().finally(()=>{saving=null;});return saving;
}
function download(blob: Blob, extension: string, name = project.name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name.replace(/[\\/:*?"<>|]/g, '-') + '.' + extension; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }

// A slow render can update transport descendants between down/up. Pause as soon
// as the primary press arrives, and consume its click so it cannot resume again.
let pausedOnPress=false;
$('#film-play').onpointerdown=e=>{pausedOnPress=false;if(e.button===0&&playing){pausedOnPress=true;pause();}};
$('#film-play').onclick = e=>{if(e.detail>0&&pausedOnPress){pausedOnPress=false;return;}pausedOnPress=false;play();};
$('#film-start').onclick = () => seek(0); $('#film-end').onclick = () => seek(totalDuration(project));
$<HTMLInputElement>('#film-scrub').oninput = e => seek(Number((e.target as HTMLInputElement).value) / FPS);
$('#shot-list').onclick = $('#timeline-clips').onclick = e => { const button = (e.target as HTMLElement).closest<HTMLElement>('[data-shot]'); if (button) choose(button.dataset.shot!); };
$('#shot-add').onclick = () => { if (project.film.shots.length >= 3) return; mutate(() => { const shot = clone(selected()); shot.id = crypto.randomUUID(); shot.name = '新的观察'; project.film.shots.push(shot); project.selectedShotId = shot.id; }); };
$('#film-undo').onclick = () => undo(); $('#film-redo').onclick = () => undo(true); $('#film-save').onclick = save;
$('#edit-room').onclick = async () => { if (await save()) location.href = session?.url('room')??'?workspace=room&project=film'; };
$('#workspace-room').onclick = $('#edit-room').onclick;
$('#workspace-portfolio').onclick=async()=>{if(await save())location.href=session?.url('portfolio')??'?workspace=portfolio&project=film';};
mountProjectMenu({host:$('.film-header'),id:session?.record.id,workspace:'film',getProject:()=>clone(project),hasUnsavedChanges:()=>projectSignature(project)!==saved,save,thumbnail:()=>captureThumbnail(scene),beforeOpen:()=>{pause();finish();},leave:()=>{leaving=true;}});
$<HTMLInputElement>('#film-name').onchange = e => { const name = (e.target as HTMLInputElement).value.trim(); if (!name) { (e.target as HTMLInputElement).value = project.name; toast('请为工程取个名字。', true); return; } mutate(() => project.name = name); };
$('#film-json').onclick = () => { pause(); finish(); download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'json'); toast('v2 工程已交给浏览器下载，包含房间和全部镜头。'); };
$('#film-import').onclick = () => { pause(); $<HTMLInputElement>('#film-file').click(); };
$<HTMLInputElement>('#film-file').onchange = async e => { const input = e.target as HTMLInputElement, file = input.files?.[0]; if (!file) return; try { if (file.size > 6 * 1024 * 1024) throw new Error('请导入小于 6 MB 的 JSON 工程。'); const result = parseFilmProject(JSON.parse(await file.text())); await preparePhotos(result.project.scene); mutate(() => project = result.project,false); $<HTMLInputElement>('#film-name').value = project.name; toast(result.migrated ? '旧版工程已迁移为 v3 短片工程，原文件与存档保持完整。' : '工程已导入，可继续编辑；保存后刷新可恢复。'); } catch (error) { toast(error instanceof SyntaxError ? 'JSON 格式错误，当前工程未更改。' : (error as Error).message, true); } finally { input.value = ''; } };

const dialog = $<HTMLDialogElement>('#film-export-dialog');
function resetExportFeedback() { $('#export-progress-wrap').hidden = true; $('#export-progress-text').textContent = ''; $<HTMLProgressElement>('#film-progress').value = 0; }
$('#film-export').addEventListener('click', resetExportFeedback);
$('#film-export').onclick = () => { pause(); setAdjust(false); $('#export-duration').textContent = `${totalDuration(project).toFixed(1)} 秒`; $('#export-error').textContent = ''; $('#video-result').hidden = true; $('#film-codec').innerHTML = formats.map(f => `<option value="${f.id}">${f.label}</option>`).join(''); $('#film-render').toggleAttribute('disabled', !scene || !formats.length); $('#codec-note').textContent = !encoderReady ? '正在检测此浏览器实际支持的编码…' : formats.length ? '已检测此浏览器的实际编码支持。MP4 便于分享，WebM 适合浏览器播放。' : '此浏览器不支持所需的 WebCodecs 编码。请在 HTTPS / localhost 上使用支持编码的桌面 Chrome 或 Edge；工程 JSON 仍可导出。'; dialog.showModal(); };
$('#film-close-export').onclick = () => { if (!exporting) dialog.close(); };
dialog.addEventListener('cancel', e => { if (exporting) { e.preventDefault(); abort?.abort(); } });
dialog.addEventListener('close', () => { $<HTMLVideoElement>('#film-video').pause(); $('#film-export').focus(); });
$('#film-cancel').onclick = () => abort?.abort();
$('#film-cancel').onpointerdown = e => { if(e.button===0)abort?.abort(); };
$('#film-download').onclick = () => { if (videoBlob) download(videoBlob, videoExtension, $('#film-video').dataset.name); };
$('#film-render').onclick = async () => {
  if (!scene || exporting) return; const format = formats.find(f => f.id === $<HTMLSelectElement>('#film-codec').value); if (!format) return;
  pause(); setAdjust(false); finish(); exporting = true; sampling = true; abort = new AbortController();
  $('#film-render').toggleAttribute('disabled', true); $('#film-codec').toggleAttribute('disabled', true); $('#film-close-export').toggleAttribute('disabled', true); $('#film-cancel').hidden = false; $('#export-progress-wrap').hidden = false; $('#video-result').hidden = true; $('#export-error').textContent = '';
  const snapshot = clone(project), started = performance.now();
  try {
    const blob = await encodeFilm(scene, snapshot, format, abort.signal, (frame, frames) => { $<HTMLProgressElement>('#film-progress').value = frame / frames; if (frame % 3 === 0 || frame === frames) $('#export-progress-text').textContent = `正在生成 ${frame} / ${frames} 帧 · ${Math.round(frame / frames * 100)}%`; });
    $('#export-progress-text').textContent = '正在检查文件尺寸、时长与首帧解码…';
    if (videoUrl) URL.revokeObjectURL(videoUrl); videoUrl = URL.createObjectURL(blob); const video = $<HTMLVideoElement>('#film-video');
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('生成的视频无法在此浏览器回放，请尝试另一种格式。')), 15000); video.onloadeddata = () => { clearTimeout(timer); if (video.videoWidth !== 1280 || video.videoHeight !== 720 || Math.abs(video.duration - totalDuration(snapshot)) > .08) reject(new Error('视频尺寸或时长校验失败，请尝试另一种格式。')); else resolve(); }; video.onerror = () => { clearTimeout(timer); reject(new Error('视频解码失败，请尝试另一种格式。')); }; video.src = videoUrl; video.load(); });
    abort.signal.throwIfAborted(); videoBlob = blob; videoExtension = format.extension; video.dataset.name = snapshot.name;
    $('#video-result').hidden = false; $('#video-result-info').textContent = `${format.label} · ${video.duration.toFixed(1)} 秒 · 1280 × 720 · ${(blob.size / 1048576).toFixed(2)} MB · 可回放`; $('#export-progress-text').textContent = `已生成并验证视频，耗时 ${((performance.now() - started) / 1000).toFixed(1)} 秒。点击播放检查，或下载文件。`;
  } catch (error) { $('#export-error').textContent = abort.signal.aborted ? '已取消生成，工程与预览保持完整。' : `导出失败：${(error as Error).message}`; $('#export-progress-text').textContent = ''; }
  finally { exporting = false; sampling = false; abort = null; $('#film-render').removeAttribute('disabled'); $('#film-codec').removeAttribute('disabled'); $('#film-close-export').removeAttribute('disabled'); $('#film-cancel').hidden = true; drawAt(project.playhead); }
};

document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || exporting) return; const editing = (e.target as HTMLElement).matches('input,select,textarea,[contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (editing) (e.target as HTMLElement).blur(); save(); return; }
  if (editing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(true); return; }
  if (e.code === 'Space') { e.preventDefault(); play(); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(project.playhead + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / FPS)); }
  if (e.key === 'Escape') { pause(); setAdjust(false); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
window.addEventListener('beforeunload', e => { if (!leaving&&(projectSignature(project) !== saved || exporting)) e.preventDefault(); });
renderShots(); renderProperties(); renderTimeline(); syncSave(); icons();
void detectExportFormats().then(result => { formats = result; encoderReady = true; if(dialog.open){$('#film-codec').innerHTML=formats.map(f=>`<option value="${f.id}">${f.label}</option>`).join('');$('#film-render').toggleAttribute('disabled',!scene||!formats.length);$('#codec-note').textContent=formats.length?'已检测此浏览器的实际编码支持。MP4 便于分享，WebM 适合浏览器播放。':'此浏览器不支持所需编码；仍可导出工程 JSON。';} }).catch(() => { encoderReady = true; });
requestAnimationFrame(() => setTimeout(async () => {
  try {
    await preparePhotos(project.scene);
    scene = new StudyScene($('#film-canvas-host'), { select: () => {}, begin: () => {}, move: () => {}, end: () => {}, camera: () => {
      if (!scene || sampling || !adjusting) return; begin(); selected()[endpoint] = poseFromCamera(scene.getCamera());
      for (const key of ['azimuth', 'elevation', 'zoom'] as const) { const input = $<HTMLInputElement>(`#pose-${key}`); if (input) input.value = selected()[endpoint][key].toFixed(key === 'zoom' ? 2 : 1); } syncSave();
    }, error: message => { pause(); abort?.abort(); toast(message, true); } });
    scene.setFraming(16 / 9); scene.setMode('orbit'); scene.setInteractionEnabled(false);
    scene.controls.minAzimuthAngle = POSE_LIMITS.azimuth[0] * Math.PI / 180; scene.controls.maxAzimuthAngle = POSE_LIMITS.azimuth[1] * Math.PI / 180;
    scene.controls.minPolarAngle = (90 - POSE_LIMITS.elevation[1]) * Math.PI / 180; scene.controls.maxPolarAngle = (90 - POSE_LIMITS.elevation[0]) * Math.PI / 180; scene.controls.minZoom = POSE_LIMITS.zoom[0]; scene.controls.maxZoom = POSE_LIMITS.zoom[1];
    scene.controls.addEventListener('start', () => { if (adjusting) begin(); }); scene.controls.addEventListener('end', () => { if (adjusting) { finish(); refreshThumbnails(); renderShots(); renderTimeline(); drawAt(project.playhead); } });
    scene.sync({ ...project.scene, selectedId: null }); $('#film-loading').remove(); refresh(true); drawAt(project.playhead); document.documentElement.dataset.ready = 'true';
    if (loaded.message) toast(loaded.message, /无法/.test(loaded.message));
    if (!loaded.restored && !matchMedia('(prefers-reduced-motion: reduce)').matches) play();
  } catch (error) { $('#film-loading').innerHTML = `<strong>暂时无法打开 3D 预览</strong><span>请启用 WebGL 2 与硬件加速。工程仍可保存与导出 JSON。</span>`; $('#film-play').toggleAttribute('disabled', true); document.documentElement.dataset.ready = 'error'; toast((error as Error).message, true); }
}, 50));

// Read-only witnesses used by actual browser acceptance; editing uses the visible controls.
Object.defineProperty(window, '__film', { value: { getProject: () => clone(project), state: () => ({ playing, adjusting, exporting, endpoint, encoderReady, formats: clone(formats) }), history: () => ({ past: past.length, future: future.length }), sample: (t: number) => sampleFilm(project, t), camera: () => scene?.getCamera(), metrics: () => scene?.getMetrics() } });
