import { createGuideProject, parseGuideProject } from './guide-model';
import { mountGuide } from './guide-view';
import { projectSession } from './project-session';
import { parseFilmProject } from './film-model';

const snapshot = new URLSearchParams(location.search).get('snapshot');
const session = snapshot ? null : await projectSession();
const storageKey = 'ideal-study.guide.v1:' + (snapshot ?? session?.record.id ?? 'demo');
// Saved guide is authoritative; a stale tab-transfer payload must not block restoration.
const { project, notice } = (() => {
  let savedError = false;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return { project: parseGuideProject(JSON.parse(saved)), notice: '已恢复上次保存的本地导览，播放保持暂停。' };
  } catch { savedError = true; }
  let project = createGuideProject(session?.record.project);
  let notice = session ? '已载入当前房间与作品的独立导览快照；原工程与保存版本保持完整。' : '示例导览 · 书籍与屏幕关联本项目。点击播放，也可以导入你自己的房间 JSON。';
  if (snapshot) {
    try {
      const source = sessionStorage.getItem('ideal-study.guide.source:' + snapshot);
      if (source) {
        project = createGuideProject(parseFilmProject(JSON.parse(source)).project);
        notice = '已载入当前房间与作品的独立导览快照；原工程与保存版本保持完整。';
      } else notice = '此快照不在当前浏览器中，现显示示例。此链接不能跨设备分享；请导入导览 JSON，或使用网站包发布。';
    } catch { notice = '快照来源无法读取，现显示示例；原始数据保留。可导入导览 JSON 恢复。'; }
  }
  if (savedError) notice = '本地导览未能读取，原始存档保留，尚未覆盖。' + notice;
  return { project, notice };
})();
await mountGuide(project, { storageKey, notice });
