/** Distance-based footfalls. No previous-frame state: seeking and export are identical. */
export interface GaitPoint { x: number; z: number }
export interface GaitPath { path: GaitPoint[]; lengths: number[]; length: number }
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const easeGait = (n: number) => { const x = clamp(n); return x * x * x * (10 + x * (-15 + 6 * x)); };

export function gaitPoint(route: GaitPath, distance: number): GaitPoint {
  let remaining = Math.max(0, Math.min(route.length, distance));
  for (let i = 0; i < route.lengths.length; i++) {
    const length = route.lengths[i];
    if (remaining <= length || i === route.lengths.length - 1) {
      const a = route.path[i], b = route.path[i + 1], t = length ? clamp(remaining / length) : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    remaining -= length;
  }
  return route.path[0];
}

export function gaitHeading(route: GaitPath, distance: number) {
  const a = gaitPoint(route, distance - .12), b = gaitPoint(route, distance + .12);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function walkFootfall(route: GaitPath, distance: number, side: 'l' | 'r') {
  const count = Math.max(2, Math.ceil(route.length / .42)), stepLength = route.length / count;
  let anchor = 0;
  const d = Math.max(0, Math.min(route.length, distance));
  for (let i = 0; i <= count; i++) {
    if ((i % 2 === 0 ? 'r' : 'l') !== side) continue;
    const start = i === 0 ? 0 : (i - .5) * stepLength;
    const end = Math.min(route.length, (i + .5) * stepLength);
    const target = Math.min(route.length, (i + 1) * stepLength);
    if (d >= end) { anchor = target; continue; }
    if (d <= start) break;
    // A short double-support period surrounds each swing. The final step closes
    // alongside the planted foot, instead of snapping a half-finished loop to idle.
    const progress = clamp(((d - start) / Math.max(.001, end - start) - .05) / .90);
    const travel = anchor + (target - anchor) * easeGait(progress);
    const a = gaitHeading(route, anchor), b = gaitHeading(route, target);
    const yaw = a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * easeGait(progress);
    return { ...gaitPoint(route, travel), yaw, lift: .06 * Math.sin(Math.PI * progress) ** 2,
      pitch: .14 * Math.sin(Math.PI * 2 * progress) * Math.sin(Math.PI * progress),
      planted: progress === 0 || progress === 1, anchor, target, progress };
  }
  return { ...gaitPoint(route, anchor), yaw: gaitHeading(route, anchor), lift: 0, pitch: 0, planted: true, anchor, target: anchor, progress: 1 };
}
