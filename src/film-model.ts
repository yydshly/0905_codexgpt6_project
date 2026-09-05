import { clone, initialPlan, parsePlan, type CameraState, type Plan } from './model';

export const FILM_STORAGE = 'ideal-study.film.v2';
export const FPS = 30;
export interface Pose { azimuth: number; elevation: number; zoom: number }
export interface Shot { id: string; name: string; duration: number; start: Pose; end: Pose; target: number[] }
export interface FilmProject { app: 'ideal-study-film'; version: 2; name: string; scene: Plan; film: { version: 1; shots: Shot[] }; selectedShotId: string; playhead: number }
export const POSE_LIMITS = { azimuth: [15, 70], elevation: [25, 65], zoom: [.85, 1.9] } as const;
export const TARGET_LIMITS = [[-1.8, 1.8], [.4, 1.7], [-1.6, .8]];
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const totalDuration = (p: FilmProject) => Math.round(p.film.shots.reduce((n, s) => n + s.duration, 0) * FPS) / FPS;
export const shotStart = (p: FilmProject, id: string) => p.film.shots.slice(0, p.film.shots.findIndex(s => s.id === id)).reduce((n, s) => n + s.duration, 0);
export const projectSignature = (p: FilmProject) => JSON.stringify({ ...p, selectedShotId: '', playhead: 0, scene: { ...p.scene, selectedId: null } });

export function createFilmProject(scene = initialPlan()): FilmProject {
  return { app: 'ideal-study-film', version: 2, name: '光落书房 · 十秒日常', scene: clone(scene), film: { version: 1, shots: [
    { id: 'shot-1', name: '光落书房', duration: 3.4, target: [0, .85, -.1], start: { azimuth: 46, elevation: 34, zoom: 1.08 }, end: { azimuth: 38, elevation: 31, zoom: 1.16 } },
    { id: 'shot-2', name: '桌边的灵感', duration: 3.6, target: [.5, 1.05, -.8], start: { azimuth: 32, elevation: 27, zoom: 1.65 }, end: { azimuth: 40, elevation: 30, zoom: 1.78 } },
    { id: 'shot-3', name: '为日常留白', duration: 3, target: [0, .82, -.05], start: { azimuth: 48, elevation: 43, zoom: 1.2 }, end: { azimuth: 44, elevation: 39, zoom: 1.06 } },
  ] }, selectedShotId: 'shot-1', playhead: 0 };
}

export function cameraForPose(pose: Pose, target: number[]): CameraState {
  const a = pose.azimuth * Math.PI / 180, e = pose.elevation * Math.PI / 180, r = 12;
  return { position: [target[0] + r * Math.cos(e) * Math.sin(a), target[1] + r * Math.sin(e), target[2] + r * Math.cos(e) * Math.cos(a)], target: [...target], zoom: pose.zoom };
}
export function poseFromCamera(c: CameraState): Pose {
  const [x, y, z] = c.position.map((n, i) => n - c.target[i]);
  return { azimuth: clamp(Math.atan2(x, z) * 180 / Math.PI, ...POSE_LIMITS.azimuth), elevation: clamp(Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI, ...POSE_LIMITS.elevation), zoom: clamp(c.zoom, ...POSE_LIMITS.zoom) };
}

// The only director: time is absolute and frame-quantized, never accumulated into a pose.
export function sampleFilm(p: FilmProject, seconds: number) {
  const duration = totalDuration(p), time = clamp(Math.round(seconds * FPS) / FPS, 0, duration);
  let offset = 0, index = 0;
  while (index < p.film.shots.length - 1 && time >= Math.round((offset + p.film.shots[index].duration) * FPS) / FPS) { offset += p.film.shots[index++].duration; }
  const shot = p.film.shots[index], progress = clamp((time - offset) / shot.duration, 0, 1);
  const x = clamp((progress - .08) / .82, 0, 1), eased = x * x * x * (x * (x * 6 - 15) + 10);
  const pose = Object.fromEntries((['azimuth', 'elevation', 'zoom'] as const).map(k => [k, shot.start[k] + (shot.end[k] - shot.start[k]) * eased])) as unknown as Pose;
  return { time, index, shot, progress, camera: cameraForPose(pose, shot.target) };
}

export function parseFilmProject(raw: unknown): { project: FilmProject; migrated: boolean } {
  if (!raw || typeof raw !== 'object') throw new Error('不是有效的工程文件，当前工程未更改。');
  const p = raw as FilmProject;
  if ((raw as Plan).app === 'ideal-study' && (raw as Plan).version === 1) {
    const scene = parsePlan(raw), project = createFilmProject(scene);
    project.name = (scene.name + ' · 短片').slice(0, 48);
    return { project, migrated: true };
  }
  if (p.app !== 'ideal-study-film' || p.version !== 2 || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 48 || p.film?.version !== 1 || !Array.isArray(p.film.shots) || p.film.shots.length < 1 || p.film.shots.length > 3) throw new Error('请导入 v2 短片工程或旧版 v1 书房方案。');
  const scene = parsePlan(p.scene), ids = new Set<string>();
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  for (const s of p.film.shots) {
    if (!s || typeof s.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(s.id) || ids.has(s.id) || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 24 || !finite(s.duration) || s.duration < 1 || s.duration > 10 || Math.abs(s.duration * 10 - Math.round(s.duration * 10)) > .00001) throw new Error('镜头名称、编号或时长无效；每段须为 1–10 秒，步长 0.1 秒。');
    ids.add(s.id);
    for (const pose of [s.start, s.end]) for (const k of ['azimuth', 'elevation', 'zoom'] as const) if (!pose || !finite(pose[k]) || pose[k] < POSE_LIMITS[k][0] || pose[k] > POSE_LIMITS[k][1]) throw new Error('镜头机位超出安全观察范围，当前工程未更改。');
    if (!Array.isArray(s.target) || s.target.length !== 3 || s.target.some((n, i) => !finite(n) || n < TARGET_LIMITS[i][0] || n > TARGET_LIMITS[i][1])) throw new Error('观察目标超出书房范围，当前工程未更改。');
  }
  if (!finite(p.playhead) || p.playhead < 0 || p.playhead > totalDuration(p) + .00001 || !ids.has(p.selectedShotId)) throw new Error('工程播放位置无效，当前工程未更改。');
  return { migrated: false, project: { app: 'ideal-study-film', version: 2, name: p.name.trim(), scene, film: { version: 1, shots: p.film.shots.map(s => ({ id: s.id, name: s.name.trim(), duration: s.duration, start: { ...s.start }, end: { ...s.end }, target: [...s.target] })) }, selectedShotId: p.selectedShotId, playhead: Math.round(p.playhead * FPS) / FPS } };
}

export function loadFilmProject(): { project: FilmProject; restored: boolean; message: string } {
  try {
    const saved = localStorage.getItem(FILM_STORAGE);
    if (saved) return { project: parseFilmProject(JSON.parse(saved).project).project, restored: true, message: '' };
    const legacy = localStorage.getItem('ideal-study.plan.v1');
    if (legacy) return { ...parseFilmProject(JSON.parse(legacy).plan), restored: false, message: '已载入旧版书房并编排默认短片；原存档保持完整。' };
  } catch { return { project: createFilmProject(), restored: false, message: '本地工程无法读取，已打开默认作品。原始存档未被覆盖。' }; }
  return { project: createFilmProject(), restored: false, message: '' };
}
export function storeFilmProject(project: FilmProject) { localStorage.setItem(FILM_STORAGE, JSON.stringify({ project, savedAt: new Date().toISOString() })); }
