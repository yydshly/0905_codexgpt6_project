import { DEFAULT_GUIDE_AVATAR, isGuideAvatarId, type GuideAvatarId } from './guide-avatars';
import { cameraForPose, clamp, createFilmProject, FPS, parseFilmProject, type FilmProject } from './film-model';
import { dimensions, localPoint, worldPoint, type Plan } from './model';
import { activation, demoPortfolio, type ContentTarget } from './portfolio-model';

export type GuideAction = 'read' | 'point' | 'sit';
export interface GuideStop { action: GuideAction; itemId: string; duration: number }
export interface GuideProject {
  app: 'ideal-study-guide'; version: 1; name: string; project: FilmProject;
  guide: { version: 5; avatar: GuideAvatarId; movement: 'walk' | 'ninja'; name: string; color: 'sage' | 'clay' | 'blue'; stops: GuideStop[] };
  playhead: number; selected: number;
}
export interface Point { x: number; z: number }
export const guideDuration = (p: GuideProject) => p.guide.stops.reduce((n, s) => n + s.duration, 0);
export const guideStart = (p: GuideProject, index: number) => p.guide.stops.slice(0, index).reduce((n, s) => n + s.duration, 0);
export const guideTarget = (s: GuideStop): ContentTarget => ({ itemId: s.itemId, partId: s.action === 'read' ? 'book-1' : s.action === 'point' ? 'screen' : 'object' });
export const guideActionName = (action: GuideAction) => ({ read: '阅读手册', point: '屏幕介绍', sit: '坐下与站起' })[action];
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
  const chair = project.scene.objects.find(o => o.kind === 'chair');
  if (chair) stops.push({ action: 'sit', itemId: chair.id, duration: 12 });
  return { app: 'ideal-study-guide', version: 1, name: '鸣人的书房漫游', project, guide: { version: 5, avatar: DEFAULT_GUIDE_AVATAR, movement: 'walk', name: '鸣人', color: 'sage', stops }, playhead: 0, selected: 0 };
}
export function parseGuideProject(raw: unknown): GuideProject {
  if (!raw || typeof raw !== 'object') throw new Error('不是有效的导览工程。');
  if ((raw as GuideProject).app !== 'ideal-study-guide') return createGuideProject(parseFilmProject(raw).project);
  const p = raw as GuideProject;
  const fail = (): never => { throw new Error('导览数据无效或版本不支持，当前工程未更改。'); };
  // Wrapper/storage key stay at v1. Legacy v1/v2 keep the old appearance; upgrading is explicit.
  if (p.version !== 1 || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 48 || ![1, 2, 3, 4, 5].includes(p.guide?.version) || (Number(p.guide?.version) >= 5 && !['walk', 'ninja'].includes(p.guide.movement)) || (Number(p.guide.version) === 2 && p.guide.avatar !== 'creator-18-v1') || (Number(p.guide.version) >= 3 && !isGuideAvatarId(p.guide.avatar)) || typeof p.guide.name !== 'string' || !p.guide.name.trim() || p.guide.name.length > 12 || !['sage', 'clay', 'blue'].includes(p.guide.color) || !Array.isArray(p.guide.stops) || p.guide.stops.length > (Number(p.guide.version) >= 4 ? 3 : 2)) return fail();
  const project = parseFilmProject(p.project).project;
  const actions = new Set<string>();
  const stops = p.guide.stops.map(s => {
    if (!s || !(Number(p.guide.version) >= 4 ? ['read', 'point', 'sit'] : ['read', 'point']).includes(s.action) || actions.has(s.action) || !Number.isFinite(s.duration) || s.duration < (s.action === 'sit' ? 10 : 6) || s.duration > (s.action === 'sit' ? 16 : 12) || s.duration % .5 !== 0 || !project.scene.objects.some(o => o.id === s.itemId && o.kind === (s.action === 'read' ? 'desk' : s.action === 'point' ? 'monitor' : 'chair'))) return fail();
    actions.add(s.action); return { action: s.action, itemId: s.itemId, duration: s.duration };
  });
  if (!Number.isInteger(p.selected) || p.selected < 0 || p.selected >= Math.max(1, stops.length) || !Number.isFinite(p.playhead) || p.playhead < 0 || p.playhead > guideDuration(p)) return fail();
  project.scene.selectedId = null;
  return { app: 'ideal-study-guide', version: 1, name: p.name.trim(), project, guide: { version: 5, avatar: Number(p.guide.version) < 3 ? 'creator-18-v1' : p.guide.avatar, movement: Number(p.guide.version) < 5 ? 'walk' : p.guide.movement, name: p.guide.name.trim(), color: p.guide.color, stops }, selected: p.selected, playhead: Math.round(p.playhead * FPS) / FPS };
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
export function compileGuide(p: GuideProject) {
  const plan = p.project.scene;
  const grid: Point[] = [];
  for (let z = -12; z <= 12; z++) for (let x = -15; x <= 15; x++) grid.push({ x: x * STEP, z: z * STEP });
  const standing = grid.filter(n => navigable(plan, n));
  const home = standing.reduce((best, n) => distance(n, { x: -.65, z: 1.15 }) < distance(best, { x: -.65, z: 1.15 }) ? n : best, standing[0] ?? { x: 0, z: 0 });
  let previous = home;
  const segments = p.guide.stops.map((stop, index) => {
    const item = plan.objects.find(o => o.id === stop.itemId)!;
    const chair = stop.action === 'sit' ? item : undefined;
    const previousStop = p.guide.stops[index - 1];
    const previousChair = previousStop?.action === 'sit' ? plan.objects.find(o => o.id === previousStop.itemId) : undefined;
    // A seated actor enters from the open FRONT of the chair. The back and armrests stay blocked.
    const allowed = (point: Point) => navigable({ ...plan, objects: plan.objects.filter(o => !([chair?.id, previousChair?.id].includes(o.id) && localPoint(point.x, point.z, o).z <= -.295)) }, point);
    const clear = (a: Point, b: Point) => { const count = Math.max(1, Math.ceil(distance(a, b) / .025)); return Array.from({ length: count + 1 }, (_, i) => allowed({ x: mix(a.x, b.x, i / count), z: mix(a.z, b.z, i / count) })).every(Boolean); };
    const target = stop.action === 'read' ? worldPoint(-.68, .18, item) : { x: item.x, z: item.z };
    const desired = stop.action === 'read' ? worldPoint(-.78, .82, item) : stop.action === 'sit' ? worldPoint(0, -.31, item) : worldPoint(.65, .82, item);
    const nodes = grid.filter(allowed);
    if (!nodes.includes(previous) && allowed(previous)) nodes.push(previous);
    if (chair && allowed(desired)) nodes.push(desired);
    const start = nodes.indexOf(previous), queue = start >= 0 ? [start] : [], parents = new Map<number, number>([[start, -1]]);
    for (let q = 0; q < queue.length; q++) {
      const a = queue[q];
      for (let b = 0; b < nodes.length; b++) if (!parents.has(b) && distance(nodes[a], nodes[b]) <= STEP * 1.42 && clear(nodes[a], nodes[b])) { parents.set(b, a); queue.push(b); }
    }
    const reachable = queue.filter(i => chair ? nodes[i] === desired : distance(nodes[i], target) < 1.2);
    const end = reachable.sort((a, b) => distance(nodes[a], desired) - distance(nodes[b], desired))[0];
    const path: Point[] = [];
    if (end !== undefined) { let cursor = end; while (cursor !== -1) { path.unshift(nodes[cursor]); cursor = parents.get(cursor)!; } }
    const reduced = path.length ? [path[0]] : [previous];
    for (let i = 0; i < path.length - 1;) { let j = path.length - 1; while (j > i + 1 && !clear(path[i], path[j])) j--; reduced.push(path[j]); i = j; }
    // Round only corners whose entire replacement curve stays in the free corridor.
    const rounded: Point[] = [reduced[0]];
    for (let i = 1; i < reduced.length - 1; i++) {
      const a = reduced[i - 1], b = reduced[i], c = reduced[i + 1], radius = Math.min(.18, distance(a, b) / 3, distance(b, c) / 3);
      const enter = { x: mix(b.x, a.x, radius / distance(a, b)), z: mix(b.z, a.z, radius / distance(a, b)) };
      const leave = { x: mix(b.x, c.x, radius / distance(b, c)), z: mix(b.z, c.z, radius / distance(b, c)) };
      const curve = Array.from({ length: 9 }, (_, j) => { const t = j / 8; return { x: (1-t)**2*enter.x + 2*(1-t)*t*b.x + t*t*leave.x, z: (1-t)**2*enter.z + 2*(1-t)*t*b.z + t*t*leave.z }; });
      if (curve.every((n, j) => allowed(n) && (!j || clear(curve[j - 1], n)))) rounded.push(...curve); else rounded.push(b);
    }
    if (reduced.length > 1) rounded.push(reduced.at(-1)!);
    reduced.splice(0, reduced.length, ...rounded);
    const lengths = reduced.slice(1).map((point, i) => distance(reduced[i], point));
    previous = reduced.at(-1)!;
    const length = lengths.reduce((a, b) => a + b, 0);
    const walkTime = Math.max(.8, length / (p.guide.avatar === 'naruto-author-01-v1' && p.guide.movement === 'ninja' ? 1.65 : .78) + .55) + .5;
    const available = stop.duration - (chair ? 6.2 : 1.4);
    const seatGround = chair && plan.objects.some(o => o.kind === 'rug' && Math.abs(localPoint(chair.x, chair.z, o).x) < dimensions(o).width / 2 && Math.abs(localPoint(chair.x, chair.z, o).z) < dimensions(o).depth / 2) ? .027 : 0;
    return { path: reduced, lengths, length, walkTime, yaw: chair ? item.rotation * Math.PI / 180 + Math.PI : .28,
      seat: chair ? { x: chair.x, z: chair.z, y: .51 + seatGround, ground: seatGround } : null,
      target: { ...target, y: stop.action === 'read' ? .81 : chair ? .8 : (item.parentId ? .78 : 0) + .3 },
      error: end === undefined ? chair ? '椅子正前方没有可到达的位置。请在布置中将椅子拉离书桌或墙面，留出进出空间后重新导入。' : '没有可通行的路线，请在布置中为书桌周围留出至少 0.6 米通道，再导入房间。' : walkTime > available ? '当前路程较长，请增加段落时长或把目标物件移近。' : '' };
  });
  return { home, segments, error: !standing.length ? '房间没有可站立的位置。' : !segments.length ? '房间中没有书桌、显示器或坐下段落，请先导入房间。' : segments.find(s => s.error)?.error ?? '' };
}
export type GuideRoute = ReturnType<typeof compileGuide>;
export function sampleGuide(p: GuideProject, route: GuideRoute, seconds: number) {
  const time = clamp(Math.round(seconds * FPS) / FPS, 0, guideDuration(p));
  let index = 0; while (index < p.guide.stops.length - 1 && time >= guideStart(p, index + 1)) index++;
  const stop = p.guide.stops[index], segment = route.segments[index];
  const elapsed = time - guideStart(p, index), duration = stop?.duration ?? 8, walkTime = segment?.walkTime ?? .8;
  const walkElapsed = Math.max(0, elapsed - .5), travelTime = Math.max(.3, walkTime - .5);
  const progress = clamp(walkElapsed / travelTime, 0, 1);
  // Distance drives the gait. Accelerate / brake once, with a steady walking speed in between.
  const ramp = Math.min(.4, travelTime / 3), movingTime = clamp(walkElapsed, 0, travelTime);
  const integral = movingTime < ramp ? movingTime * movingTime / (2 * ramp) : movingTime > travelTime - ramp ? travelTime - ramp - (travelTime - movingTime) ** 2 / (2 * ramp) : movingTime - ramp / 2;
  const traveled = (segment?.length ?? 0) * integral / (travelTime - ramp);
  let position = { ...route.home }, direction = .3, remaining = traveled;
  if (segment) {
    position = { ...segment.path[0] };
    for (let i = 0; i < segment.lengths.length; i++) {
      const a = segment.path[i], b = segment.path[i + 1], length = segment.lengths[i], t = clamp(remaining / length, 0, 1);
      position = { x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) }; direction = Math.atan2(b.x - a.x, b.z - a.z);
      if (remaining <= length) break; remaining -= length;
    }
  }
  const actionTime = Math.max(0, elapsed - walkTime - .7), actionWeight = smooth(actionTime / .65);
  if (segment?.length) {
    const atDistance = (d: number) => { let left = clamp(d, 0, segment.length); for (let i = 0; i < segment.lengths.length; i++) { if (left <= segment.lengths[i] || i === segment.lengths.length - 1) { const a = segment.path[i], b = segment.path[i + 1], t = clamp(left / segment.lengths[i], 0, 1); return { x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) }; } left -= segment.lengths[i]; } return segment.path.at(-1)!; };
    const before = atDistance(traveled - .18), after = atDistance(traveled + .18);
    direction = Math.atan2(after.x - before.x, after.z - before.z);
  }
  const yaw = segment?.yaw ?? .28;
  const turn = smooth((elapsed - walkTime) / .7), angleDelta = Math.atan2(Math.sin(yaw - direction), Math.cos(yaw - direction));
  const ground = p.project.scene.objects.some(o => o.kind === 'rug' && Math.abs(localPoint(position.x, position.z, o).x) < dimensions(o).width / 2 && Math.abs(localPoint(position.x, position.z, o).z) < dimensions(o).depth / 2) ? .024 : 0;
  // One continuous camera track across both stops, with zero velocity at each end.
  const focus = smooth(time / 3), overview = { x: 0, y: .9, z: -.05 }, endpoint = segment?.path.at(-1) ?? route.home;
  const currentTarget = { x: (endpoint.x + (segment?.target.x ?? 0)) / 2, y: .92, z: (endpoint.z + (segment?.target.z ?? 0)) / 2 };
  const last = route.segments[index - 1];
  const previousTarget = last ? { x: (last.path.at(-1)!.x + last.target.x) / 2, y: .92, z: (last.path.at(-1)!.z + last.target.z) / 2 } : overview;
  const cameraT = index ? smooth(elapsed / walkTime) : focus;
  const target = [mix(previousTarget.x, currentTarget.x, cameraT), .92, mix(previousTarget.z, currentTarget.z, cameraT)];
  target[1] = mix(.96, 1.02, focus);
  const angleFor = (action?: GuideAction) => action === 'point' ? 18 : action === 'sit' ? 72 : 27;
  const azimuth = mix(index ? angleFor(p.guide.stops[index - 1]?.action) : 27, angleFor(stop?.action), cameraT);
  const close = mix(p.guide.stops[index - 1]?.action === 'sit' ? 2.15 : 1.85, stop?.action === 'sit' ? 2.15 : 1.85, cameraT);
  const camera = cameraForPose({ azimuth, elevation: mix(29, 21, focus), zoom: mix(1.35, close, focus) }, target);
  const previousAction = p.guide.stops[index - 1]?.action, departure = smooth(elapsed / .55), oldYaw = route.segments[index - 1]?.yaw ?? .28;
  const movingYaw = direction + angleDelta * turn;
  const finalYaw = oldYaw + Math.atan2(Math.sin(movingYaw - oldYaw), Math.cos(movingYaw - oldYaw)) * departure;
  const turning = elapsed < .5 ? { from: oldYaw, to: direction, progress: elapsed / .5 } : elapsed >= walkTime && elapsed < walkTime + .7 ? { from: direction, to: yaw, progress: (elapsed - walkTime) / .7 } : null;
  const readWeight = (stop?.action === 'read' ? actionWeight : 0) + (previousAction === 'read' ? 1 - departure : 0);
  const pointWeight = (stop?.action === 'point' ? actionWeight : 0) + (previousAction === 'point' ? 1 - departure : 0);
  const sitting = stop?.action === 'sit';
  const sitStart = walkTime + .85, standStart = duration - 2.1;
  const seatTime = Math.max(0, elapsed - sitStart);
  const sitClip = elapsed < sitStart + 1.7 ? 'Sitting_Enter' : elapsed < standStart ? 'Sitting_Idle_Loop' : 'Sitting_Exit';
  const sitTime = sitClip === 'Sitting_Enter' ? seatTime / 1.7 * 1.3 : sitClip === 'Sitting_Exit' ? (elapsed - standStart) / 1.55 * (31 / 30) : seatTime - 1.7;
  const sitWeight = sitting ? smooth((elapsed - sitStart + .28) / .28) * (1 - smooth((elapsed - (duration - .5)) / .5)) : 0;
  const seatBlend = sitting ? smooth(seatTime / 1.7) * (1 - smooth((elapsed - standStart) / 1.55)) : 0;
  const seatReadWeight = sitting ? smooth((seatTime - 1.7) / .5) * (1 - smooth((elapsed - standStart + .55) / .5)) : 0;
  const ninja = p.guide.avatar === 'naruto-author-01-v1' && p.guide.movement === 'ninja';
  const phase = elapsed < .5 ? '转向行进方向' : elapsed < walkTime ? ninja ? '忍者跑向目标' : '走向座椅 / 作品' : elapsed < walkTime + .7 ? '转身站稳' : sitting ? elapsed < sitStart + 1.7 ? '屈膝坐下' : elapsed < standStart - .55 ? '坐姿休息' : elapsed < standStart ? '收起手册' : elapsed < duration - .5 ? '前倾站起' : '站立完成' : stop?.action === 'read' ? '翻阅随身手册' : '介绍屏幕作品';
  return { time, index, action: stop?.action ?? 'read', position: { ...position, y: segment?.seat?.ground ?? ground }, yaw: finalYaw,
    locomotion: ninja ? 'ninja' as const : 'walk' as const,
    stride: traveled / (ninja ? 1.5 : 1.06) * Math.PI * 2, walking: progress < 1 && !!segment?.length,
    walkWeight: segment?.length ? smooth(walkElapsed / .28) * (1 - smooth((elapsed - walkTime + .38) / .38)) : 0,
    sitClip, sitTime, sitWeight, seatBlend, seatReadWeight, turning, seat: segment?.seat ?? null,
    actionWeight, readWeight, pointWeight, actionTime, target: previousAction === 'point' && last ? { x: mix(last.target.x, segment!.target.x, departure), y: mix(last.target.y, segment!.target.y, departure), z: mix(last.target.z, segment!.target.z, departure) } : segment?.target ?? { x: 0, y: 1, z: 0 }, camera, phase };
}
export type GuideSample = ReturnType<typeof sampleGuide>;
