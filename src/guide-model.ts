import { cameraForPose, clamp, createFilmProject, FPS, parseFilmProject, type FilmProject } from './film-model';
import { dimensions, localPoint, worldPoint, type Plan } from './model';
import { activation, demoPortfolio, type ContentTarget } from './portfolio-model';

export type GuideAction = 'read' | 'point';
export interface GuideStop { action: GuideAction; itemId: string; duration: number }
export interface GuideProject {
  app: 'ideal-study-guide'; version: 1; name: string; project: FilmProject;
  guide: { version: 1; name: string; color: 'sage' | 'clay' | 'blue'; stops: GuideStop[] };
  playhead: number; selected: number;
}
export interface Point { x: number; z: number }
export const guideDuration = (p: GuideProject) => p.guide.stops.reduce((n, s) => n + s.duration, 0);
export const guideStart = (p: GuideProject, index: number) => p.guide.stops.slice(0, index).reduce((n, s) => n + s.duration, 0);
export const guideTarget = (s: GuideStop): ContentTarget => ({ itemId: s.itemId, partId: s.action === 'read' ? 'book-1' : 'screen' });
export const guideWork = (p: GuideProject, s: GuideStop) => activation(p.project.scene.portfolio, guideTarget(s))?.project ?? activation(p.project.scene.portfolio, { itemId: s.itemId, partId: 'object' })?.project;
export const guideSignature = (p: GuideProject) => JSON.stringify({ ...p, playhead: 0, selected: 0 });
export function createGuideProject(source?: FilmProject): GuideProject {
  const project = structuredClone(source ?? createFilmProject());
  if (!source) project.scene.portfolio = demoPortfolio(project.scene.objects);
  project.scene.selectedId = null;
  const stops: GuideStop[] = [];
  for (const [kind, action] of [['desk', 'read'], ['monitor', 'point']] as const) {
    const candidates = project.scene.objects.filter(o => o.kind === kind);
    const item = candidates.find(o => project.scene.portfolio.bindings.some(b => b.target.itemId === o.id && [action === 'read' ? 'book-1' : 'screen', 'object'].includes(b.target.partId))) ?? candidates[0];
    if (item) stops.push({ action, itemId: item.id, duration: 8 });
  }
  return { app: 'ideal-study-guide', version: 1, name: '小禾的书房漫游', project, guide: { version: 1, name: '小禾', color: 'sage', stops }, playhead: 0, selected: 0 };
}
export function parseGuideProject(raw: unknown): GuideProject {
  if (!raw || typeof raw !== 'object') throw new Error('不是有效的导览工程。');
  if ((raw as GuideProject).app !== 'ideal-study-guide') return createGuideProject(parseFilmProject(raw).project);
  const p = raw as GuideProject;
  const fail = (): never => { throw new Error('导览数据无效或版本不支持，当前工程未更改。'); };
  if (p.version !== 1 || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 48 || p.guide?.version !== 1 || typeof p.guide.name !== 'string' || !p.guide.name.trim() || p.guide.name.length > 12 || !['sage', 'clay', 'blue'].includes(p.guide.color) || !Array.isArray(p.guide.stops) || p.guide.stops.length > 2) return fail();
  const project = parseFilmProject(p.project).project;
  const actions = new Set<string>();
  const stops = p.guide.stops.map(s => {
    if (!s || !['read', 'point'].includes(s.action) || actions.has(s.action) || !Number.isFinite(s.duration) || s.duration < 6 || s.duration > 12 || s.duration % .5 !== 0 || !project.scene.objects.some(o => o.id === s.itemId && o.kind === (s.action === 'read' ? 'desk' : 'monitor'))) return fail();
    actions.add(s.action); return { action: s.action, itemId: s.itemId, duration: s.duration };
  });
  if (!Number.isInteger(p.selected) || p.selected < 0 || p.selected >= Math.max(1, stops.length) || !Number.isFinite(p.playhead) || p.playhead < 0 || p.playhead > guideDuration(p)) return fail();
  project.scene.selectedId = null;
  return { app: 'ideal-study-guide', version: 1, name: p.name.trim(), project, guide: { version: 1, name: p.guide.name.trim(), color: p.guide.color, stops }, selected: p.selected, playhead: Math.round(p.playhead * FPS) / FPS };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const RADIUS = .26, STEP = .15;
/** Conservative floor navigation; rotated furniture is inflated by the actor radius. */
export function navigable(plan: Plan, p: Point) {
  if (Math.abs(p.x) > 2.6 - RADIUS || Math.abs(p.z) > 2.2 - RADIUS) return false;
  return !plan.objects.some(o => {
    if (o.parentId || o.kind === 'rug' || o.kind === 'wallPhoto') return false;
    const local = localPoint(p.x, p.z, o), size = dimensions(o);
    return Math.abs(local.x) < size.width / 2 + RADIUS && Math.abs(local.z) < size.depth / 2 + RADIUS;
  });
}
function clearLine(plan: Plan, a: Point, b: Point) {
  const count = Math.ceil(distance(a, b) / .04);
  for (let i = 0; i <= count; i++) { const t = count ? i / count : 0; if (!navigable(plan, { x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) })) return false; }
  return true;
}
export function compileGuide(p: GuideProject) {
  const plan = p.project.scene, nodes: Point[] = [];
  for (let z = -12; z <= 12; z++) for (let x = -15; x <= 15; x++) { const point = { x: x * STEP, z: z * STEP }; if (navigable(plan, point)) nodes.push(point); }
  const nearest = (point: Point) => nodes.reduce((best, n) => distance(n, point) < distance(best, point) ? n : best, nodes[0]);
  const home = nodes.length ? nearest({ x: -.65, z: 1.15 }) : { x: 0, z: 0 };
  let previous = home;
  const segments = p.guide.stops.map(stop => {
    const item = plan.objects.find(o => o.id === stop.itemId)!;
    const target = stop.action === 'read' ? worldPoint(-.68, .18, item) : { x: item.x, z: item.z };
    const desired = stop.action === 'read' ? worldPoint(-.78, .82, item) : worldPoint(.65, .82, item);
    const start = nodes.indexOf(previous), queue = [start], parents = new Map<number, number>([[start, -1]]);
    if (start >= 0) for (let q = 0; q < queue.length; q++) {
      const a = queue[q];
      for (let b = 0; b < nodes.length; b++) if (!parents.has(b) && distance(nodes[a], nodes[b]) <= STEP * 1.42 && clearLine(plan, nodes[a], nodes[b])) { parents.set(b, a); queue.push(b); }
    }
    const reachable = queue.filter(i => i >= 0 && distance(nodes[i], target) < 1.2);
    const end = reachable.sort((a, b) => distance(nodes[a], desired) - distance(nodes[b], desired))[0];
    const path: Point[] = [];
    if (end !== undefined) { let cursor = end; while (cursor !== -1) { path.unshift(nodes[cursor]); cursor = parents.get(cursor)!; } }
    // Remove redundant grid corners only when the complete segment is clear.
    const reduced = path.length ? [path[0]] : [previous];
    for (let i = 0; i < path.length - 1;) { let j = path.length - 1; while (j > i + 1 && !clearLine(plan, path[i], path[j])) j--; reduced.push(path[j]); i = j; }
    const lengths = reduced.slice(1).map((point, i) => distance(reduced[i], point));
    previous = reduced.at(-1)!;
    return { path: reduced, lengths, length: lengths.reduce((a, b) => a + b, 0), target: { ...target, y: stop.action === 'read' ? .81 : (item.parentId ? .78 : 0) + .3 }, error: end === undefined ? '没有可通行的路线，请在布置中为书桌周围留出至少 0.6 米通道，再导入房间。' : '' };
  });
  return { home, segments, error: !nodes.length ? '房间没有可站立的位置。' : !segments.length ? '房间中没有书桌或显示器，请先导入含这些物件的工程。' : segments.find(s => s.error)?.error ?? '' };
}
export type GuideRoute = ReturnType<typeof compileGuide>;
export function sampleGuide(p: GuideProject, route: GuideRoute, seconds: number) {
  const time = clamp(Math.round(seconds * FPS) / FPS, 0, guideDuration(p));
  let index = 0; while (index < p.guide.stops.length - 1 && time >= guideStart(p, index + 1)) index++;
  const stop = p.guide.stops[index], segment = route.segments[index];
  const elapsed = time - guideStart(p, index), duration = stop?.duration ?? 8, walkTime = duration * .4;
  const progress = clamp(elapsed / walkTime, 0, 1), traveled = (segment?.length ?? 0) * smooth(progress);
  let position = { ...route.home }, direction = .3, remaining = traveled;
  if (segment) {
    position = { ...segment.path[0] };
    for (let i = 0; i < segment.lengths.length; i++) {
      const a = segment.path[i], b = segment.path[i + 1], length = segment.lengths[i], t = clamp(remaining / length, 0, 1);
      position = { x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) }; direction = Math.atan2(b.x - a.x, b.z - a.z);
      if (remaining <= length) break; remaining -= length;
    }
  }
  const actionTime = Math.max(0, elapsed - walkTime), actionWeight = smooth(actionTime / .6);
  if (segment?.length) {
    const atDistance = (d: number) => { let left = clamp(d, 0, segment.length); for (let i = 0; i < segment.lengths.length; i++) { if (left <= segment.lengths[i] || i === segment.lengths.length - 1) { const a = segment.path[i], b = segment.path[i + 1], t = clamp(left / segment.lengths[i], 0, 1); return { x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) }; } left -= segment.lengths[i]; } return segment.path.at(-1)!; };
    const before = atDistance(traveled - .18), after = atDistance(traveled + .18);
    direction = Math.atan2(after.x - before.x, after.z - before.z);
  }
  const yaw = .28;
  const turn = smooth((progress - .78) / .22), angleDelta = Math.atan2(Math.sin(yaw - direction), Math.cos(yaw - direction));
  const ground = p.project.scene.objects.some(o => o.kind === 'rug' && Math.abs(localPoint(position.x, position.z, o).x) < dimensions(o).width / 2 && Math.abs(localPoint(position.x, position.z, o).z) < dimensions(o).depth / 2) ? .024 : 0;
  // One continuous camera track across both stops, with zero velocity at each end.
  const focus = smooth(time / 3), overview = { x: 0, y: .9, z: -.05 }, endpoint = segment?.path.at(-1) ?? route.home;
  const currentTarget = { x: (endpoint.x + (segment?.target.x ?? 0)) / 2, y: .92, z: (endpoint.z + (segment?.target.z ?? 0)) / 2 };
  const last = route.segments[index - 1];
  const previousTarget = last ? { x: (last.path.at(-1)!.x + last.target.x) / 2, y: .92, z: (last.path.at(-1)!.z + last.target.z) / 2 } : overview;
  const cameraT = index ? smooth(elapsed / walkTime) : focus;
  const target = [mix(previousTarget.x, currentTarget.x, cameraT), .92, mix(previousTarget.z, currentTarget.z, cameraT)];
  const camera = cameraForPose({ azimuth: 27, elevation: mix(29, 26, focus), zoom: mix(1.35, 1.95, focus) }, target);
  const previousAction = p.guide.stops[index - 1]?.action, departure = smooth(elapsed / .65), oldYaw = .28;
  const movingYaw = direction + angleDelta * turn;
  const finalYaw = oldYaw + Math.atan2(Math.sin(movingYaw - oldYaw), Math.cos(movingYaw - oldYaw)) * departure;
  const readWeight = (stop?.action === 'read' ? actionWeight : 0) + (previousAction === 'read' ? 1 - departure : 0);
  const pointWeight = (stop?.action === 'point' ? actionWeight : 0) + (previousAction === 'point' ? 1 - departure : 0);
  return { time, index, action: stop?.action ?? 'read', position: { ...position, y: ground }, yaw: finalYaw, stride: traveled / .43 * Math.PI * 2, walking: progress < 1, walkWeight: Math.sin(Math.PI * progress), actionWeight, readWeight, pointWeight, actionTime, target: segment?.target ?? { x: 0, y: 1, z: 0 }, camera, phase: progress < 1 ? '走向作品' : stop?.action === 'read' ? '翻阅随身手册' : '介绍屏幕作品' };
}
export type GuideSample = ReturnType<typeof sampleGuide>;
