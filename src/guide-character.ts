import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { GuideProject, GuideSample } from './guide-model';

/** Original procedural mesh and joint poses. No downloaded character or motion assets. */
export function createGuideCharacter() {
  const root = new T.Group(); root.name = 'Xiaohe-guide';
  const resources = new Set<T.BufferGeometry | T.Material>();
  const mat = (color: string, roughness = .85) => { const m = new T.MeshStandardMaterial({ color, roughness }); resources.add(m); return m; };
  const skin = mat('#e9b386'), hair = mat('#47312a'), shirt = mat('#faf0d9'), cloth = mat('#738976'), dark = mat('#302c29'), blush = mat('#d98f77'), sole = mat('#e5cfb0'), shoe = mat('#87593d');
  function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) { resources.add(geometry); const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function box(parent: T.Object3D, w: number, h: number, d: number, material: T.Material, x = 0, y = 0, z = 0, r = .03) { return mesh(parent, new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)), material, x, y, z); }
  function ball(parent: T.Object3D, r: number, material: T.Material, x = 0, y = 0, z = 0, scale = [1, 1, 1]) { const m = mesh(parent, new T.SphereGeometry(r, 24, 16), material, x, y, z); m.scale.fromArray(scale); return m; }
  const body = new T.Group(); root.add(body);
  box(body, .32, .36, .22, shirt, 0, .72, 0, .09);
  box(body, .32, .2, .23, cloth, 0, .54, .005, .07);
  box(body, .24, .23, .027, cloth, 0, .69, .115);
  for (const x of [-.104, .104]) { box(body, .037, .29, .036, cloth, x, .77, .097, .01); ball(body, .013, sole, x, .75, .124, [1, 1, .4]); }
  box(body, .102, .066, .017, cloth, 0, .649, .138, .012);
  box(body, .03, .021, .019, sole, .064, .67, .142, .003);
  const head = new T.Group(); head.position.y = 1.065; body.add(head);
  ball(head, .213, skin, 0, 0, 0, [1, 1.05, .91]);
  for (const x of [-.205, .205]) { ball(head, .043, skin, x, -.027, -.005, [.55, 1, .8]); ball(head, .024, blush, x, -.027, .021, [.5, .7, .35]); }
  const cap = mesh(head, new T.SphereGeometry(.222, 32, 20, 0, Math.PI * 2, 0, Math.PI * .46), hair, 0, .008, -.007); cap.scale.set(1, 1.08, .93);
  ball(head, .18, hair, 0, .016, -.08, [1.1, 1.05, .77]);
  for (let i = 0; i < 5; i++) { const x = -.153 + i * .071; const lock = ball(head, .062, hair, x, .115 + .035 * Math.sin(i), .137, [.9, 1.12, .63]); lock.rotation.z = -.28; }
  for (const x of [-.075, .075]) {
    ball(head, .024, dark, x, -.012, .176, [.76, 1.15, .45]);
    ball(head, .006, shirt, x - .006, -.004, .187, [1, 1, .45]);
    const brow = box(head, .04, .007, .008, hair, x, .039, .171, .003); brow.rotation.z = x > 0 ? -.1 : .1;
    ball(head, .037, blush, x * 1.6, -.057, .151, [1, .42, .15]);
  }
  ball(head, .027, skin, 0, -.04, .181, [.65, .7, 1]);
  const smile = mesh(head, new T.TorusGeometry(.021, .0035, 6, 16, Math.PI), dark, 0, -.077, .17); smile.rotation.z = Math.PI;
  function limb(parent: T.Group, x: number, y: number, material: T.Material, length: number, radius: number) {
    const joint = new T.Group(); joint.position.set(x, y, 0); parent.add(joint);
    mesh(joint, new T.CapsuleGeometry(radius, length - 2 * radius, 6, 12), material, 0, -length / 2, 0);
    const tip = new T.Group(); tip.position.y = -length; joint.add(tip); return { joint, tip };
  }
  const arms = [-1, 1].map(sign => {
    const upper = limb(body, sign * .205, .84, shirt, .18, .062);
    const lower = limb(upper.tip, 0, 0, skin, .18, .042); ball(lower.tip, .047, skin, 0, .003, 0, [1, 1.1, .82]); return { upper, lower };
  });
  const legs = [-1, 1].map(sign => {
    const upper = limb(root, sign * .095, .465, cloth, .19, .068);
    const lower = limb(upper.tip, 0, 0, cloth, .19, .057);
    box(lower.tip, .14, .082, .21, shoe, 0, -.025, .03, .035); box(lower.tip, .145, .024, .217, sole, 0, -.071, .031, .008);
    for (const z of [.045, .075]) box(lower.tip, .07, .009, .009, shirt, 0, .017, z, .003);
    return { upper, lower };
  });
  const book = new T.Group(); body.add(book); book.position.set(0, .70, .27); book.rotation.x = -.28;
  const leaves = [-1, 1].map(sign => { const page = new T.Group(); book.add(page); page.rotation.z = sign * .18; box(page, .137, .018, .19, mat('#b97853'), sign * .068, 0, 0, .007); box(page, .125, .016, .178, shirt, sign * .066, .015, 0, .004); for (let i = 0; i < 5; i++) box(page, .084, .001, .003, sole, sign * .068, .025, -.053 + i * .022, .0003); return page; });
  const page = mesh(book, new T.PlaneGeometry(.12, .17), new T.MeshStandardMaterial({ color: '#f6ead0', side: T.DoubleSide, roughness: .9 }), 0, .031, 0); resources.add(page.material); page.geometry.translate(.06, 0, 0); page.rotation.x = -Math.PI / 2;
  return { root,
    apply(s: GuideSample, color: GuideProject['guide']['color']) {
      cloth.color.set({ sage: '#738976', clay: '#b77e60', blue: '#667f91' }[color]);
      root.position.set(s.position.x, s.position.y, s.position.z); root.rotation.y = s.yaw;
      const w = s.walkWeight, stride = Math.sin(s.stride), read = s.readWeight, point = s.pointWeight;
      body.position.y = Math.abs(Math.sin(s.stride)) * .013 * w; body.rotation.z = Math.sin(s.stride) * .025 * w;
      head.rotation.set(read * .27 + point * .06, Math.sin(s.actionTime * 1.2) * .055 * s.actionWeight, .025 * Math.sin(s.time * 1.5));
      legs.forEach((leg, i) => { const swing = Math.sin(s.stride + i * Math.PI) * w; leg.upper.joint.rotation.x = swing * .48; leg.lower.joint.rotation.x = -.35 * Math.max(0, -swing); });
      arms.forEach((arm, i) => { arm.upper.joint.rotation.set((i ? -1 : 1) * stride * .35 * w - read * .63, 0, (i ? 1 : -1) * (.08 - read * .5)); arm.lower.joint.rotation.set(-read * .9, 0, 0); });
      if (point) {
        // A clear presentation gesture stays outside the face silhouette, rather than reaching through the torso.
        const target = new T.Vector3(-.72, .86, -.15).normalize();
        const pose = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, -1, 0), target);
        arms[0].upper.joint.quaternion.slerp(pose, point); arms[0].lower.joint.rotation.x = Math.sin(s.actionTime * 2.1) * .06 * point;
      }
      book.visible = read > .01; book.scale.setScalar(read); page.rotation.z = -Math.PI * (.5 + .5 * Math.sin(s.actionTime * 1.6)); leaves[0].rotation.z = -.18;
      root.updateMatrixWorld(true);
    },
    dispose() { root.removeFromParent(); resources.forEach(resource => resource.dispose()); },
  };
}
