import { createGuideProject, parseGuideProject } from './guide-model';
import { mountGuide } from './guide-view';
import { projectSession } from './project-session';
import { parseFilmProject } from './film-model';

const snapshot = new URLSearchParams(location.search).get('snapshot');
const session = snapshot ? null : await projectSession();
const storageKey = 'ideal-study.guide.v1:' + (snapshot ?? session?.record.id ?? 'demo');
const source = snapshot ? sessionStorage.getItem('ideal-study.guide.source:' + snapshot) : null;
let project = createGuideProject(source ? parseFilmProject(JSON.parse(source)).project : session?.record.project), notice = session || source ? '已载入当前房间与作品的独立导览快照；原工程与保存版本保持完整。' : '示例导览 · 书籍与屏幕关联本项目。点击播放，也可以导入你自己的房间 JSON。';
try { const saved = localStorage.getItem(storageKey); if (saved) { project = parseGuideProject(JSON.parse(saved)); notice = '已恢复上次保存的本地导览，播放保持暂停。'; } else if (snapshot && !source) { notice = '此快照不在当前浏览器中，现显示示例。请导入原导览 JSON；分享作品请使用网站包。'; } }
catch { notice = '本地导览未能读取，已打开初始快照。原始存档保留，尚未覆盖。'; }
await mountGuide(project, { storageKey, notice });
