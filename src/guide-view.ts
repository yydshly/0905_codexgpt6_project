import { StudyScene } from './scene';
import { createGuideCharacter } from './adult-character';
import { compileGuide, guideDuration, guideSignature, guideStart, guideTarget, guideWork, parseGuideProject, sampleGuide, type GuideProject } from './guide-model';
import { FPS, cameraForPose } from './film-model';
import { MAX_JSON_BYTES, displayName } from './model';
import { detectExportFormats, encodeSequence, type ExportFormat } from './film-export';
import { preparePhotos } from './photos';
import { createProjectDialog } from './project-dialog';
import { mountHotspots } from './hotspots';
import './guide.css';

export async function mountGuide(initial: GuideProject, options: { visitor?: boolean; storageKey?: string; notice?: string } = {}) {
  let project = parseGuideProject(initial), route = compileGuide(project), playing = false, frame = 0, exporting = false, manualEnd: number | null = null;
  let startClock = 0, startTime = 0, saved = guideSignature(project), disposed = false;
  const past: GuideProject[] = [], future: GuideProject[] = [];
  const visitor = !!options.visitor;
  document.body.className = 'guide-app'; document.title = project.name + ' · 角色导览';
  document.querySelector('#app')!.innerHTML = `<main class="guide-shell">
    <header class="guide-header"><a class="guide-brand" href="${visitor ? '#' : '?workspace=projects'}"><span>◇</span> 理想书房 <small>/ 角色导览</small></a><span class="guide-edition">${visitor ? 'INTERACTIVE PORTFOLIO' : 'LAB 01 · 青年导览'}</span><nav>${visitor ? '' : '<button id="guide-undo" aria-label="撤销">↶</button><button id="guide-redo" aria-label="重做">↷</button><button id="guide-save">保存导览</button><button id="guide-export" class="guide-primary">导出视频 ↗</button>'}</nav></header>
    <div class="guide-main"><aside class="guide-sidebar"><div class="guide-intro"><span class="guide-eyebrow">A LITTLE COMPANY</span><h1>让作品，<br/>有人带你看。</h1><p><span id="guide-name-label"></span>会带你认识书房里的创作。<br/>点一件作品，开始一段小小的探索。</p></div>
      <div class="guide-section-title"><span>导览段落</span><small id="guide-total"></small></div><div id="guide-stops" class="guide-stops"></div>
      <section class="guide-current"><span class="guide-eyebrow" id="guide-action-title"></span><h2 id="guide-work-title"></h2><p id="guide-work-description"></p><button id="guide-open">直接查看作品 ↗</button><small>可跳过动作，直接打开作品详情。</small></section>
      ${visitor ? '' : '<details class="guide-settings" open><summary>角色与段落设置</summary><label>导览名称<input id="guide-title" maxlength="48" aria-label="导览名称"/></label><div class="guide-field-row"><label>角色名字<input id="guide-name" maxlength="12" aria-label="角色名字"/></label><label>上衣颜色<select id="guide-color" aria-label="上衣颜色"><option value="sage">鼠尾草绿</option><option value="clay">陶土橘</option><option value="blue">雾蓝色</option></select></label></div><div class="guide-field-row"><label>当前段落时长<select id="guide-duration" aria-label="当前段落时长"></select></label><button id="guide-order">交换顺序 ⇅</button></div><p class="guide-setting-note">18 岁青年形象 · 长袖上衣、深色长裤。携带手册，阅读后介绍屏幕作品。房间与作品来自工程快照。</p></details>'}
    </aside><section class="guide-stage" aria-label="角色导览预览"><div class="guide-stage-top"><span><i></i> LIVE 3D <b id="guide-status">正在打开书房…</b></span><div class="guide-camera-actions"><button id="guide-character-close">角色近景</button><button id="guide-camera">恢复导览镜头</button></div></div><div class="guide-frame"><div id="guide-canvas"></div><div id="guide-loading">正在加载书房与青年角色…</div></div><div class="guide-caption"><span id="guide-caption-index">01 / 02</span><div><strong id="guide-caption-title"></strong><p id="guide-caption-text"></p></div><span class="guide-character-tag">青年创作者<br/><b>XIAOHE · 18</b></span></div><div class="guide-stage-foot"><span>拖动旋转 · 滚轮缩放 · 点击标记探索作品</span><div>${['day','dusk','night'].map((m,i)=>`<button data-guide-mood="${m}">${['白昼','黄昏','深夜'][i]}</button>`).join('')}</div></div></section></div>
    <footer class="guide-timeline"><div class="guide-transport"><button id="guide-start" aria-label="回到开头">↤</button><button id="guide-play" class="guide-primary" aria-label="播放导览">▶ 播放导览</button><span id="guide-time">00.0 / 16.0 s</span></div><div class="guide-track"><div id="guide-track-labels"></div><input id="guide-scrub" type="range" min="0" step="0.03333333333333333" aria-label="导览播放头" /></div><div class="guide-timeline-end"><span id="guide-save-state">${visitor ? '点击物品，认识作品' : '独立导览 · 本地保存'}</span>${visitor ? '' : '<div><button id="guide-import">导入工程</button><button id="guide-json">JSON ↓</button><button id="guide-publish">网站包 ↓</button></div>'}</div></footer>
    <p id="guide-message" class="guide-message" role="status" aria-live="polite"></p><input type="file" id="guide-file" accept=".json,application/json" hidden />
  </main>`;
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
  const report = (message: string, error = false) => { $('#guide-message').textContent = message; $('#guide-message').classList.toggle('error', error); };
  const download = (blob: Blob, suffix: string) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = project.name.replace(/[\\/:*?"<>|]/g, '-') + suffix; a.click(); setTimeout(() => URL.revokeObjectURL(url), 15000); };
  const detail = createProjectDialog();
  let scene: StudyScene | undefined, actor: Awaited<ReturnType<typeof createGuideCharacter>> | undefined, hotspots: ReturnType<typeof mountHotspots> | undefined;
  const setButtons = () => { $('#guide-play').textContent = playing ? 'Ⅱ 暂停导览' : '▶ 播放导览'; $('#guide-play').setAttribute('aria-label', playing ? '暂停导览' : '播放导览'); if (!visitor) { $<HTMLButtonElement>('#guide-undo').disabled = !past.length || exporting; $<HTMLButtonElement>('#guide-redo').disabled = !future.length || exporting; } };
  function pause() { playing = false; cancelAnimationFrame(frame); setButtons(); scene?.setInteractionEnabled(!exporting); $('#guide-status').textContent = exporting ? '正在生成视频' : '已暂停 · 可自由观察'; }
  function renderSample(time: number, camera = true) {
    const sample = sampleGuide(project, route, time); actor?.apply(sample, project.guide.color);
    if (scene) { scene.renderer.shadowMap.needsUpdate = true; if (camera) scene.applyCamera(sample.camera); scene.invalidate(); }
    return sample;
  }
  function updatePlayback() {
    const s = sampleGuide(project, route, project.playhead), stop = project.guide.stops[s.index];
    $('#guide-time').textContent = `${s.time.toFixed(1).padStart(4, '0')} / ${guideDuration(project).toFixed(1)} s`;
    $<HTMLInputElement>('#guide-scrub').value = String(s.time);
    $('#guide-status').textContent = exporting ? '正在生成视频' : playing ? s.phase : '已暂停 · 可自由观察';
    $('#guide-caption-index').textContent = `${String(s.index + 1).padStart(2, '0')} / ${String(project.guide.stops.length).padStart(2, '0')}`;
    $('#guide-caption-title').textContent = stop ? (stop.action === 'read' ? '从一本书，认识一段创作。' : '屏幕里，装着另一个世界。') : '给书房留一点探索的空间。';
    $('#guide-caption-text').textContent = `${project.guide.name} · ${s.phase}${playing ? '' : ' / 播放或拖动时间轴继续'}`;
    document.querySelectorAll<HTMLElement>('[data-stop]').forEach(el => el.classList.toggle('is-active', Number(el.dataset.stop) === project.selected));
    document.querySelectorAll<HTMLElement>('[data-track]').forEach(el => { el.classList.toggle('is-active', Number(el.dataset.track) === s.index); el.style.setProperty('--played', `${Math.max(0, Math.min(100, (s.time - guideStart(project, Number(el.dataset.track))) / project.guide.stops[Number(el.dataset.track)].duration * 100))}%`); });
  }
  function updateSelection() {
    const stop = project.guide.stops[project.selected], work = stop && guideWork(project, stop);
    $('#guide-action-title').textContent = stop ? `CURRENT / ${stop.action === 'read' ? '阅读手册' : '屏幕介绍'}` : 'CURRENT / 等待物件';
    $('#guide-work-title').textContent = work?.title ?? '这个物件还没有关联作品';
    $('#guide-work-description').textContent = work?.description ?? '在布置书房中为书籍或屏幕关联作品，再导出 JSON 导入这里。';
    $<HTMLButtonElement>('#guide-open').disabled = !work || exporting;
    if (!visitor) { $<HTMLSelectElement>('#guide-duration').value = String(stop?.duration ?? 8); $<HTMLSelectElement>('#guide-duration').disabled = !stop; }
  }
  function refresh() {
    document.title = project.name + ' · 角色导览';
    $('#guide-name-label').textContent = project.guide.name;
    $('#guide-total').textContent = `${project.guide.stops.length} 段 · ${guideDuration(project)} 秒`;
    $('#guide-stops').replaceChildren(); $('#guide-track-labels').replaceChildren();
    project.guide.stops.forEach((stop, i) => {
      const button = document.createElement('button'); button.dataset.stop = String(i); button.className = 'guide-stop';
      const mark = document.createElement('span'); mark.className = 'guide-stop-art ' + stop.action; mark.textContent = stop.action === 'read' ? '▤' : '▣';
      const copy = document.createElement('span'), title = document.createElement('b'), small = document.createElement('small');
      title.textContent = `${String(i + 1).padStart(2, '0')} · ${stop.action === 'read' ? '书页间的灵感' : '屏幕里的创作'}`;
      small.textContent = `${displayName(project.project.scene.objects.find(o => o.id === stop.itemId)!, project.project.scene.objects)} · ${stop.duration} 秒`;
      copy.append(title, small); button.append(mark, copy); button.onclick = () => selectStop(i, false); $('#guide-stops').append(button);
      const track = document.createElement('button'); track.dataset.track = String(i); track.style.flex = String(stop.duration); track.textContent = `${i + 1} / ${stop.action === 'read' ? '阅读手册' : '屏幕介绍'} · ${stop.duration}s`; track.onclick = () => selectStop(i, false); $('#guide-track-labels').append(track);
    });
    $<HTMLInputElement>('#guide-scrub').max = String(guideDuration(project));
    if (!visitor) { $<HTMLInputElement>('#guide-title').value = project.name; $<HTMLInputElement>('#guide-name').value = project.guide.name; $<HTMLSelectElement>('#guide-color').value = project.guide.color; $<HTMLButtonElement>('#guide-order').disabled = project.guide.stops.length !== 2; $<HTMLButtonElement>('#guide-export').disabled = !scene || !actor || !!route.error || exporting; }
    document.querySelectorAll<HTMLElement>('[data-guide-mood]').forEach(b => b.classList.toggle('is-active', b.dataset.guideMood === project.project.scene.mood));
    updateSelection(); updatePlayback(); setButtons();
    $('#guide-save-state').textContent = visitor ? '点击物品，认识作品' : saved === guideSignature(project) ? '独立导览 · 本地保存' : '有未保存的修改';
    $<HTMLButtonElement>('#guide-play').disabled = !scene || !actor || !!route.error || exporting;
    if (route.error) report(route.error, true);
  }
  function seek(time: number) { pause(); manualEnd = null; const s = renderSample(time); project.playhead = s.time; project.selected = s.index; updateSelection(); updatePlayback(); }
  function openCurrent() { pause(); manualEnd = null; const stop = project.guide.stops[project.selected], work = stop && guideWork(project, stop); if (work) detail.open(work); else report('此物件尚未关联作品，请在房间编辑器中配置。'); }
  function play() {
    if (!scene || !actor || route.error || exporting) return;
    if (project.playhead >= guideDuration(project)) seek(0);
    playing = true; startClock = performance.now(); startTime = project.playhead; setButtons();
    const tick = (now: number) => {
      if (!playing || disposed) return;
      const end = manualEnd ?? guideDuration(project), time = Math.min(end, Math.floor((startTime + (now - startClock) / 1000) * FPS) / FPS);
      if (time !== project.playhead) {
        const sample = renderSample(time); project.playhead = sample.time;
        if (project.selected !== sample.index) { project.selected = sample.index; updateSelection(); }
        updatePlayback();
      }
      if (time >= end) { const open = manualEnd !== null; pause(); manualEnd = null; if (open) openCurrent(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  function selectStop(index: number, run: boolean) {
    if (exporting) return;
    seek(guideStart(project, index)); project.selected = index; updateSelection(); updatePlayback();
    if (run) { manualEnd = guideStart(project, index) + project.guide.stops[index].duration - 1 / FPS; play(); report('已跳到此段落起点；动作完成后打开作品。可随时直接查看或暂停。'); }
  }
  function commit(change: (next: GuideProject) => void) {
    if (exporting) return; pause(); manualEnd = null;
    const before = structuredClone(project), next = structuredClone(project); change(next); next.playhead = Math.min(next.playhead, guideDuration(next));
    try { project = parseGuideProject(next); } catch (error) { report((error as Error).message, true); refresh(); return; }
    if (guideSignature(before) !== guideSignature(project)) { past.push(before); if (past.length > 60) past.shift(); future.length = 0; }
    route = compileGuide(project); scene?.sync(project.project.scene); renderSample(project.playhead); hotspots?.refresh(); refresh();
  }
  $('#guide-play').onclick = () => { if (playing) pause(); else { manualEnd = null; play(); } };
  $('#guide-start').onclick = () => seek(0); $('#guide-open').onclick = openCurrent;
  $('#guide-camera').onclick = () => { if (exporting) return; pause(); renderSample(project.playhead); updatePlayback(); };
  $('#guide-character-close').onclick = () => {
    if (!scene || !actor || exporting) return;
    pause(); const s = sampleGuide(project, route, project.playhead);
    scene.applyCamera(cameraForPose({ azimuth: 22, elevation: 12, zoom: 3.8 }, [s.position.x, 1.30 + s.position.y, s.position.z]));
    report('角色近景 · 可拖动观察。播放或恢复导览镜头可回到作品构图；视频使用导览镜头。');
  };
  $<HTMLInputElement>('#guide-scrub').oninput = e => seek(Number((e.target as HTMLInputElement).value));
  document.querySelectorAll<HTMLButtonElement>('[data-guide-mood]').forEach(b => b.onclick = () => commit(next => { next.project.scene.mood = b.dataset.guideMood as 'day' | 'dusk' | 'night'; }));
  if (!visitor) {
    $<HTMLSelectElement>('#guide-duration').innerHTML = Array.from({ length: 13 }, (_, i) => `<option value="${6 + i * .5}">${6 + i * .5} 秒</option>`).join('');
    $<HTMLInputElement>('#guide-title').onchange = e => commit(next => { next.name = (e.target as HTMLInputElement).value; });
    $<HTMLInputElement>('#guide-name').onchange = e => commit(next => { next.guide.name = (e.target as HTMLInputElement).value; });
    $<HTMLSelectElement>('#guide-color').onchange = e => commit(next => { next.guide.color = (e.target as HTMLSelectElement).value as GuideProject['guide']['color']; });
    $<HTMLSelectElement>('#guide-duration').onchange = e => commit(next => { next.guide.stops[next.selected].duration = Number((e.target as HTMLSelectElement).value); });
    $('#guide-order').onclick = () => commit(next => { next.guide.stops.reverse(); next.selected = 1 - next.selected; next.playhead = guideStart(next, next.selected); });
    function history(from: GuideProject[], to: GuideProject[]) { if (!from.length || exporting) return; pause(); manualEnd = null; to.push(structuredClone(project)); project = from.pop()!; route = compileGuide(project); scene?.sync(project.project.scene); renderSample(project.playhead); hotspots?.refresh(); refresh(); }
    $('#guide-undo').onclick = () => history(past, future); $('#guide-redo').onclick = () => history(future, past);
    $('#guide-save').onclick = () => { pause(); try { localStorage.setItem(options.storageKey!, JSON.stringify(project)); saved = guideSignature(project); $('#guide-save-state').textContent = '已保存到本地'; report('导览快照已保存到当前浏览器，刷新可恢复。原房间工程保持完整；也可下载 JSON 备份。'); } catch { report('本地保存失败，请导出 JSON 备份后重试。', true); } };
    $('#guide-json').onclick = () => { pause(); download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), '.guide.json'); report('导览 JSON 已交给浏览器下载。'); };
    $('#guide-import').onclick = () => { pause(); $<HTMLInputElement>('#guide-file').click(); };
    $<HTMLInputElement>('#guide-file').onchange = async e => {
      const input = e.target as HTMLInputElement, file = input.files?.[0]; input.value = ''; if (!file || exporting) return;
      try { if (file.size > MAX_JSON_BYTES) throw new Error('请选择 6 MB 以内的 JSON 工程。'); const raw = JSON.parse(await file.text()), next = parseGuideProject(raw); await preparePhotos(next.project.scene); commit(p => Object.assign(p, next)); report(route.error ? '已导入。' + route.error : raw.app === 'ideal-study-guide' ? '导览已导入，可继续编辑；原存档尚未覆盖。' : '已从旧房间 / 短片生成独立导览快照；作品关联已保留。', !!route.error); } catch (error) { report('导入失败：' + (error as Error).message, true); }
    };
    $('#guide-export').onclick = () => void exportVideo();
    $('#guide-publish').onclick = async () => { pause(); const button = $<HTMLButtonElement>('#guide-publish'); button.disabled = true; try { const { createGuideSitePackage } = await import('./guide-site-export'); const blob = await createGuideSitePackage(project); download(blob, '.website.zip'); report('独立导览网站包已交给浏览器下载；解压后可部署到 GitHub Pages。'); } catch (error) { report('网站包生成失败：' + (error as Error).message, true); } finally { button.disabled = false; } };
  }
  async function exportVideo() {
    pause(); if (!scene || !actor || route.error) { report(route.error || '3D 预览尚未就绪。', true); return; }
    const dialog = document.createElement('dialog'); dialog.className = 'guide-export-dialog'; dialog.setAttribute('aria-label', '导出角色导览视频');
    dialog.innerHTML = '<button id="guide-export-close" aria-label="关闭导览视频导出">×</button><span class="guide-eyebrow">TAKE THE STORY WITH YOU</span><h2>带走这段小小的探索。</h2><p>1280 × 720 · 30 fps · 无音轨<br/>使用当前导览的角色、动作、房间与镜头。</p><label>编码格式<select id="guide-codec" aria-label="导览视频编码"></select></label><p id="guide-codec-note">正在检测浏览器实际编码能力…</p><button id="guide-render" class="guide-primary" disabled>生成视频</button><button id="guide-cancel" hidden>取消生成</button><progress id="guide-progress" max="1" value="0" hidden></progress><p id="guide-export-message" role="status"></p><div id="guide-video-result" hidden><video id="guide-video" controls muted playsinline></video><a id="guide-video-download" class="guide-primary">下载视频 ↓</a></div>';
    document.body.append(dialog); dialog.showModal();
    let controller: AbortController | undefined, resultURL = '', formats: ExportFormat[] = [], busy = false;
    const close = () => { if (busy) { controller?.abort(); return; } dialog.close(); dialog.remove(); if (resultURL) URL.revokeObjectURL(resultURL); $('#guide-export').focus(); };
    dialog.querySelector('#guide-export-close')!.addEventListener('click', close); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    const note = dialog.querySelector<HTMLElement>('#guide-export-message')!, render = dialog.querySelector<HTMLButtonElement>('#guide-render')!;
    try { formats = await detectExportFormats(); } catch { formats = []; }
    if (!dialog.isConnected) return;
    dialog.querySelector<HTMLSelectElement>('#guide-codec')!.innerHTML = formats.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
    dialog.querySelector('#guide-codec-note')!.textContent = formats.length ? '只列出当前浏览器实际支持的编码。完成后可在这里重新播放。' : '当前浏览器不支持所需编码。请用支持 WebCodecs 的桌面浏览器，在 HTTPS 或 localhost 打开；仍可导出 JSON 和网站包。';
    render.disabled = !formats.length;
    dialog.querySelector('#guide-cancel')!.addEventListener('click', () => controller?.abort());
    render.onclick = async () => {
      const format = formats.find(f => f.id === dialog.querySelector<HTMLSelectElement>('#guide-codec')!.value)!;
      if (busy) return; busy = exporting = true; controller = new AbortController(); render.disabled = true;
      const cancel = dialog.querySelector<HTMLElement>('#guide-cancel')!, progress = dialog.querySelector<HTMLProgressElement>('#guide-progress')!;
      cancel.hidden = progress.hidden = false; dialog.querySelector<HTMLElement>('#guide-video-result')!.hidden = true; note.textContent = '逐帧生成中…'; scene!.setInteractionEnabled(false);
      try {
        const blob = await encodeSequence(scene!, { name: project.name, duration: guideDuration(project), sample(time) { return renderSample(time, false).camera; } }, format, controller.signal, (frame, frames) => { progress.value = frame / frames; note.textContent = `正在生成 ${Math.round(frame / frames * 100)}% · ${frame} / ${frames} 帧`; });
        controller.signal.throwIfAborted(); if (resultURL) URL.revokeObjectURL(resultURL); resultURL = URL.createObjectURL(blob);
        const video = dialog.querySelector<HTMLVideoElement>('#guide-video')!;
        await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { cleanup(); reject(new Error('文件已编码，但浏览器未能及时读取视频。')); }, 15000); const cleanup = () => { clearTimeout(timer); video.onloadeddata = video.onerror = null; }; video.onloadeddata = () => { cleanup(); resolve(); }; video.onerror = () => { cleanup(); reject(new Error('视频文件无法在当前浏览器重新播放，请尝试另一种格式。')); }; video.src = resultURL; });
        controller.signal.throwIfAborted();
        if (video.videoWidth !== 1280 || video.videoHeight !== 720 || Math.abs(video.duration - guideDuration(project)) > .1) throw new Error('视频尺寸或时长校验失败，请重试。');
        const link = dialog.querySelector<HTMLAnchorElement>('#guide-video-download')!; link.href = resultURL; link.download = project.name.replace(/[\\/:*?"<>|]/g, '-') + '.' + format.extension;
        dialog.querySelector<HTMLElement>('#guide-video-result')!.hidden = false;
        note.textContent = `已生成并读取视频 · ${video.duration.toFixed(1)} 秒 · 1280 × 720 · ${(blob.size / 1048576).toFixed(1)} MB。点击播放检查内容。`;
      } catch (error) { note.textContent = controller.signal.aborted ? '已取消生成；导览与播放位置已恢复。' : '生成失败：' + (error as Error).message; }
      finally { exporting = busy = false; render.disabled = false; cancel.hidden = progress.hidden = true; renderSample(project.playhead); scene!.setInteractionEnabled(true); refresh(); }
    };
  }
  refresh();
  try {
    await preparePhotos(project.project.scene);
    scene = new StudyScene($('#guide-canvas'), { select() {}, begin() {}, move() {}, end() {}, camera() {}, error: message => report(message, true) });
    scene.sync(project.project.scene); scene.setMode('orbit'); scene.setFraming(16 / 9); scene.controls.maxZoom = 4.2;
    actor = await createGuideCharacter();
    if (disposed) { actor.dispose(); return { destroy() {} }; }
    scene.scene.add(actor.root); scene.contentOccluders.push(actor.root); scene.renderer.domElement.setAttribute('aria-label', '角色导览三维预览'); renderSample(project.playhead);
    scene.controls.addEventListener('start', () => { if (playing) { pause(); updatePlayback(); } });
    hotspots = mountHotspots($('#guide-canvas'), scene, () => project.project.scene.portfolio, event => {
      const index = project.guide.stops.findIndex(s => s.itemId === event.target.itemId && (guideTarget(s).partId === event.target.partId || event.target.partId === 'object'));
      if (index >= 0) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) { selectStop(index, false); openCurrent(); } else selectStop(index, true); }
      else { pause(); detail.open(event.project); }
    });
    $('#guide-loading').hidden = true; document.documentElement.dataset.ready = 'true'; refresh();
  } catch (error) { $('#guide-loading').textContent = '书房或角色未能加载，请检查网络后重试。仍可保存 / 导出 JSON；浏览器需要支持 WebGL。'; report((error as Error).message, true); document.documentElement.dataset.ready = 'error'; refresh(); }
  if (options.notice && !route.error && actor) report(options.notice);
  const visibility = () => { if (document.hidden) pause(); }; document.addEventListener('visibilitychange', visibility);
  const beforeUnload = (e: BeforeUnloadEvent) => { if (!visitor && guideSignature(project) !== saved) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', beforeUnload);
  const destroy = () => { disposed = true; pause(); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('beforeunload', beforeUnload); hotspots?.destroy(); detail.destroy(); actor?.dispose(); scene?.destroy(); };
  window.addEventListener('pagehide', destroy, { once: true });
  Object.assign(window, { __guide: { project: () => structuredClone(project), sample: (time: number) => sampleGuide(project, route, time), state: () => ({ playing, exporting, routeError: route.error, past: past.length, future: future.length }), route: () => structuredClone(route), camera: () => scene?.getCamera(), metrics: () => scene?.getMetrics(), avatar: () => actor?.metrics() } });
  return { destroy };
}
