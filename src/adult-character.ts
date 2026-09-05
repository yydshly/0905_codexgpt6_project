import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import bundledAvatarURL from './assets/guide/creator-18.glb?url';
import personalAvatarURL from './assets/guide/personal-creator-01.glb?url';
import motionURL from './assets/guide/guide-motion-v1.glb?url';
import { DEFAULT_GUIDE_AVATAR, guideAvatars, type GuideAvatarId } from './guide-avatars';
import type { GuideProject, GuideSample } from './guide-model';

/** CC0 base + locomotion: Quaternius. Wardrobe, preparation and guide poses: this project. */
export async function createGuideCharacter(avatar: GuideAvatarId = DEFAULT_GUIDE_AVATAR) {
  // The standalone kit references its adjacent file; the editor uses Vite's hashed asset.
  const avatarURL = typeof __GUIDE_ASSET_BASE__ === 'undefined'
    ? (avatar === 'creator-18-v1' ? bundledAvatarURL : personalAvatarURL)
    : __GUIDE_ASSET_BASE__ + guideAvatars[avatar].file;
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(avatarURL);
  let motion: Awaited<ReturnType<GLTFLoader['loadAsync']>>;
  try { motion = await loader.loadAsync(typeof __GUIDE_ASSET_BASE__ === 'undefined' ? motionURL : __GUIDE_ASSET_BASE__ + 'guide-motion-v1.glb'); }
  catch (error) { gltf.scene.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { for (const value of Object.values(m)) if (value instanceof T.Texture) value.dispose(); m.dispose(); } } }); throw error; }
  const root = new T.Group(); root.name = avatar; root.add(gltf.scene);
  const resources = new Set<T.BufferGeometry | T.Material | T.Texture>();
  const bones = new Map<string, T.Bone>(), blinkMeshes: T.Mesh[] = [], smileMeshes: T.Mesh[] = [], shoes: T.SkinnedMesh[] = [];
  let cotton: T.MeshStandardMaterial | undefined, rib: T.MeshStandardMaterial | undefined;
  gltf.scene.traverse(o => {
    if (o instanceof T.Bone) bones.set(o.name, o);
    if (!(o instanceof T.Mesh)) return;
    o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
    resources.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      resources.add(m);
      for (const v of Object.values(m)) if (v instanceof T.Texture) resources.add(v);
      if (m.name === 'GuideCotton') cotton = m as T.MeshStandardMaterial;
      if (m.name === 'CottonRib') rib = m as T.MeshStandardMaterial;
      if (m.name.includes('Hair')) { (m as T.MeshStandardMaterial).color.set('#37271e'); (m as T.MeshStandardMaterial).roughness = .86; }
    }
    if (o.morphTargetDictionary?.Blink !== undefined) blinkMeshes.push(o);
    if (o.morphTargetDictionary?.SoftSmile !== undefined) smileMeshes.push(o);
    if (o instanceof T.SkinnedMesh && o.name.startsWith('Sole_')) shoes.push(o);
  });
  const rest = new Map([...bones].map(([name, bone]) => [name, { q: bone.quaternion.clone(), p: bone.position.clone(), scale: bone.scale.clone() }]));
  const idleClip = T.AnimationClip.findByName(gltf.animations, 'Idle_Loop'), walkClip = T.AnimationClip.findByName(gltf.animations, 'Walk_Loop');
  if (!idleClip || !walkClip) throw new Error('角色动作资源不完整，请重新加载页面。');
  const channels = (clip: T.AnimationClip) => clip.tracks.map(track => {
    const path = T.PropertyBinding.parseTrackName(track.name), bone = bones.get(path.nodeName!);
    if (!bone || !['position', 'quaternion', 'scale'].includes(path.propertyName)) throw new Error('角色骨骼通道不匹配。');
    return { bone, property: path.propertyName, interpolant: track.InterpolantFactoryMethodLinear() };
  });
  const idleChannels = channels(idleClip), walkChannels = channels(walkClip);
  const sittingClips = new Map(motion.animations.filter(c => c.name.startsWith('Sitting_')).map(clip => [clip.name, { clip, channels: channels(clip) }]));
  if (sittingClips.size !== 3) throw new Error('坐下 / 站起动作资源不完整。');
  function sittingPose(s: GuideSample) {
    if (!s.sitWeight) return;
    const animation = sittingClips.get(s.sitClip)!;
    const time = s.sitClip === 'Sitting_Idle_Loop' ? s.sitTime % animation.clip.duration : T.MathUtils.clamp(s.sitTime, 0, animation.clip.duration);
    for (const channel of animation.channels) {
      const value = channel.interpolant.evaluate(time);
      if (channel.property === 'quaternion') channel.bone.quaternion.slerp(new T.Quaternion().fromArray(value), s.sitWeight);
      else (channel.property === 'position' ? channel.bone.position : channel.bone.scale).lerp(new T.Vector3().fromArray(value), s.sitWeight);
    }
  }
  function samplePose(time: number, walkTime: number, weight: number) {
    // Explicit clip evaluation avoids AnimationMixer's unchanged-value cache after custom IK.
    for (const [name, bone] of bones) { const r = rest.get(name)!; bone.position.copy(r.p); bone.quaternion.copy(r.q); bone.scale.copy(r.scale); }
    for (const channel of idleChannels) {
      const value = channel.interpolant.evaluate(time % idleClip!.duration);
      if (channel.property === 'quaternion') channel.bone.quaternion.fromArray(value);
      else (channel.property === 'position' ? channel.bone.position : channel.bone.scale).fromArray(value);
    }
    for (const channel of walkChannels) {
      const value = channel.interpolant.evaluate(walkTime % walkClip!.duration);
      if (channel.property === 'quaternion') channel.bone.quaternion.slerp(new T.Quaternion().fromArray(value), weight);
      else (channel.property === 'position' ? channel.bone.position : channel.bone.scale).lerp(new T.Vector3().fromArray(value), weight);
    }
  }
  const mat = (name: string, color: string) => { const m = new T.MeshStandardMaterial({ name, color, roughness: .88 }); resources.add(m); return m; };
  const cover = mat('Notebook linen', '#ad7552'), paper = mat('Warm paper', '#f4ead7'), ink = mat('Printed graphite', '#8e8171');
  const book = new T.Group(); book.name = 'Carried-notebook'; root.add(book);
  function box(parent: T.Object3D, w: number, h: number, d: number, m: T.Material, x = 0, y = 0, z = 0) {
    const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(.003, h / 3)); resources.add(geometry);
    const mesh = new T.Mesh(geometry, m); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const leaves = [-1, 1].map(sign => {
    const leaf = new T.Group(); book.add(leaf);
    box(leaf, .118, .005, .168, cover, sign * .059);
    box(leaf, .11, .012, .156, paper, sign * .055, .008);
    for (let i = 0; i < 6; i++) box(leaf, i === 0 ? .053 : .078, .001, i === 0 ? .004 : .0014, ink, sign * .055, .015, -.051 + i * .018);
    return leaf;
  });
  const pageGeometry = new T.PlaneGeometry(.107, .15); pageGeometry.rotateX(-Math.PI / 2); pageGeometry.translate(.0535, 0, 0); resources.add(pageGeometry);
  const pageMaterial = paper.clone(); pageMaterial.side = T.DoubleSide; resources.add(pageMaterial);
  const page = new T.Mesh(pageGeometry, pageMaterial); page.position.y = .018; book.add(page);
  const vector = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const world = (v: T.Vector3) => root.localToWorld(v);
  const worldPosition = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
  const smooth = (x: number) => { const t = T.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
  function rotateWorld(bone: T.Bone, delta: T.Quaternion) {
    const rotation = delta.multiply(bone.getWorldQuaternion(new T.Quaternion()));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation)); bone.updateWorldMatrix(false, true);
  }
  function aim(bone: T.Bone, child: T.Bone, target: T.Vector3, weight: number) {
    const a = worldPosition(bone), current = worldPosition(child).sub(a).normalize(), desired = target.clone().sub(a).normalize();
    const rotation = new T.Quaternion().setFromUnitVectors(current, desired);
    rotateWorld(bone, new T.Quaternion().slerp(rotation, weight));
  }
  /** Analytic two-bone IK keeps wrists attached to the notebook / presentation gesture. */
  function arm(side: 'l' | 'r', point: T.Vector3, pole: T.Vector3, weight: number) {
    if (weight <= 0) return;
    const upper = bones.get('upperarm_' + side)!, lower = bones.get('lowerarm_' + side)!, hand = bones.get('hand_' + side)!;
    const a = worldPosition(upper), b = worldPosition(lower), c = worldPosition(hand), end = world(point), axis = end.clone().sub(a);
    const lengthA = a.distanceTo(b), lengthB = b.distanceTo(c), distance = T.MathUtils.clamp(axis.length(), .03, lengthA + lengthB - .005); axis.normalize();
    const bend = world(pole).sub(a); bend.addScaledVector(axis, -bend.dot(axis)).normalize();
    const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
    const elbow = a.clone().addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, lengthA * lengthA - along * along)));
    aim(upper, lower, elbow, weight); aim(lower, hand, end, weight);
  }
  function leg(side: 'l' | 'r', end: T.Vector3) {
    const upper = bones.get('thigh_' + side)!, lower = bones.get('calf_' + side)!, foot = bones.get('foot_' + side)!;
    const rotation = foot.getWorldQuaternion(new T.Quaternion());
    const a = worldPosition(upper), b = worldPosition(lower), c = worldPosition(foot), axis = end.clone().sub(a);
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), d = T.MathUtils.clamp(axis.length(), .02, l1 + l2 - .001); axis.normalize();
    const pole = world(vector(side === 'l' ? .16 : -.16, .40, .8)).sub(a); pole.addScaledVector(axis, -pole.dot(axis)).normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const knee = a.clone().addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
    aim(upper, lower, knee, 1); aim(lower, foot, end, 1);
    foot.quaternion.copy(foot.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation)); foot.updateWorldMatrix(false, true);
  }
  function handPose(side: 'l' | 'r', weight: number, carry = 0) {
    const sign = side === 'l' ? 1 : -1, hand = bones.get('hand_' + side)!;
    const y = vector(-sign * .80, .12, .6).lerp(vector(0, -.96, .28), carry).normalize(), z = vector(0, 1, 0).lerp(vector(sign, 0, 0), carry), x = new T.Vector3().crossVectors(y, z).normalize(); z.crossVectors(x, y);
    const rotation = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
    rotation.premultiply(root.getWorldQuaternion(new T.Quaternion()));
    rotation.premultiply(hand.parent!.getWorldQuaternion(new T.Quaternion()).invert()); hand.quaternion.slerp(rotation, weight);
    for (const finger of ['index', 'middle', 'ring', 'pinky']) for (let i = 1; i <= 3; i++) {
      const bone = bones.get(`${finger}_0${i}_${side}`); if (bone) bone.rotateX(weight * (i === 1 ? .16 + .25 * carry : .32 + .45 * carry));
    }
  }
  let lastFootCorrection = 0;
  return { root,
    apply(s: GuideSample, color: GuideProject['guide']['color']) {
      cotton?.color.set({ sage: avatar === 'creator-18-v1' ? '#829c87' : '#8b9876', clay: '#b67956', blue: '#7895ae' }[color]);
      rib?.color.set({ sage: avatar === 'creator-18-v1' ? '#657d68' : '#748160', clay: '#966247', blue: '#586f88' }[color]);
      root.position.set(s.position.x, s.position.y, s.position.z); root.rotation.y = s.yaw;
      // Every evaluation starts at the same authored pose. Seeking never accumulates IK or morph state.
      const weight = s.walkWeight;
      samplePose(s.time, s.stride / (Math.PI * 2) * walkClip.duration, weight);
      for (const [name, bone] of bones) if (/^(pelvis|thigh|calf|foot|ball|spine)/.test(name)) {
        const blend = (1 - weight) * (name.startsWith('spine') ? .72 : 1);
        bone.quaternion.slerp(rest.get(name)!.q, blend); bone.position.lerp(rest.get(name)!.p, blend);
      }
      if (avatar === 'personal-creator-01-v1') for (const [name, bone] of bones) if (/^(thumb|index|middle|ring|pinky)_/.test(name)) bone.quaternion.slerp(rest.get(name)!.q, (1 - weight) * .85);
      sittingPose(s);
      root.updateMatrixWorld(true);
      if (s.turning) {
        const turn = s.turning, delta = Math.atan2(Math.sin(turn.to - turn.from), Math.cos(turn.to - turn.from));
        for (const [i, side] of (['l', 'r'] as const).entries()) {
          const step = T.MathUtils.clamp((turn.progress - i * .38) / .62, 0, 1);
          const heading = turn.from + delta * smooth(step), foot = bones.get('foot_' + side)!;
          const local = root.worldToLocal(worldPosition(foot));
          local.applyAxisAngle(vector(0, 1, 0), heading - s.yaw);
          local.y += Math.sin(Math.PI * step) * .055 * Math.min(1, Math.abs(delta));
          const end = world(local); leg(side, end);
          rotateWorld(foot, new T.Quaternion().setFromAxisAngle(vector(0, 1, 0), heading - s.yaw));
        }
      }
      if (s.seatBlend && s.seat) {
        const feet = (['l', 'r'] as const).map(side => worldPosition(bones.get('foot_' + side)!));
        const pelvis = bones.get('pelvis')!, position = worldPosition(pelvis);
        // The source animation is made for a lower chair. Raise the hips to this cushion,
        // then solve both legs back to their planted ankles instead of raising the feet.
        position.y += (.51 + .09 - .528) * s.seatBlend;
        pelvis.position.copy(pelvis.parent!.worldToLocal(position)); root.updateMatrixWorld(true);
        leg('l', feet[0]); leg('r', feet[1]);
      }
      const read = Math.max(s.readWeight, s.seatReadWeight), breath = Math.sin(s.time * 1.7) * .0025;
      // Follow the moving chest during the sit/stand weight shift, keeping the book clear of the lap.
      const chest = root.worldToLocal(worldPosition(bones.get('spine_03')!));
      const seatedHand = vector(.13, chest.y - .15, chest.z + .24);
      const handLeft = vector(.25, .93, .14).lerp(vector(.14, 1.10 + breath, .31), read).lerp(seatedHand, s.sitWeight);
      handLeft.y += Math.sin(s.stride * 2) * .009 * weight; handLeft.z += Math.sin(s.stride) * .014 * weight;
      const handRight = vector(-.14, 1.10 + breath, .31).lerp(vector(-.13, seatedHand.y, seatedHand.z), s.sitWeight);
      book.position.copy(vector(.24, avatar === 'personal-creator-01-v1' ? .83 : .91, .13).lerp(vector(0, 1.11 + breath, .32), read));
      book.position.lerp(vector(0, seatedHand.y + .01, seatedHand.z + .01), s.sitWeight);
      book.rotation.set(-.12 * read, 0, (1 - read) * -.20);
      leaves.forEach((leaf, i) => { leaf.rotation.z = (i ? 1 : -1) * T.MathUtils.lerp(1.46, .16, read); });
      const flip = smooth((s.actionTime % 3.6 - 1.5) / .85); page.visible = read > .95 && flip > 0 && flip < 1; page.rotation.z = Math.PI * flip;
      arm('l', handLeft, vector(.39, handLeft.y, handLeft.z - .20), 1);
      arm('r', handRight, vector(-.39, handRight.y, handRight.z - .20), read);
      handPose('l', .8 + .2 * read, avatar === 'personal-creator-01-v1' ? 1 - read : 0); handPose('r', read);
      if (avatar === 'personal-creator-01-v1' && read < 1) {
        root.updateMatrixWorld(true);
        // The folded book's center follows the actual palm after IK, not a wrist-level guess.
        const grip = root.worldToLocal(worldPosition(bones.get('middle_01_l')!));
        book.position.lerp(grip.add(vector(-.014, -.043, .013)), 1 - read);
      }
      if (s.pointWeight > 0) {
        const localTarget = root.worldToLocal(vector(s.target.x, s.target.y, s.target.z));
        const presentation = vector(-.27, 1.24, .03).add(localTarget.clone().sub(vector(-.27, 1.24, .03)).normalize().multiplyScalar(.15));
        arm('r', presentation, vector(-.47, 1.04, -.03), s.pointWeight);
        const hand = bones.get('hand_r')!, y = localTarget.sub(presentation).normalize(), z = vector(0, 1, 0), x = new T.Vector3().crossVectors(y, z).normalize(); z.crossVectors(x, y);
        const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z)).premultiply(root.getWorldQuaternion(new T.Quaternion())).premultiply(hand.parent!.getWorldQuaternion(new T.Quaternion()).invert());
        hand.quaternion.slerp(q, s.pointWeight);
        for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) for (let i = 1; i <= 3; i++) { const name = `${finger}_0${i}_r`, bone = bones.get(name); if (bone) bone.quaternion.slerp(rest.get(name)!.q, s.pointWeight * .88); }
      }
      const head = bones.get('Head')!;
      head.rotateX(read * .48 + Math.sin(s.time * .8) * .018 * (1 - weight));
      const relative = root.worldToLocal(vector(s.target.x, s.target.y, s.target.z));
      head.rotateY(T.MathUtils.clamp(Math.atan2(relative.x, Math.max(.4, relative.z)), -.38, .38) * s.pointWeight * .5);
      head.rotateZ(Math.sin(s.time * .7) * .015 * (1 - weight));
      root.updateMatrixWorld(true);
      const attention = read > .1 ? world(book.position.clone()) : s.pointWeight > .1 ? vector(s.target.x, s.target.y, s.target.z) : world(vector(.12, 1.60, 3));
      for (const side of ['l', 'r']) {
        const eye = bones.get('eye_' + side); if (!eye) continue;
        const forward = vector(0, 1, 0).applyQuaternion(eye.getWorldQuaternion(new T.Quaternion())).normalize();
        const desired = attention.clone().sub(worldPosition(eye)).normalize(), angle = forward.angleTo(desired);
        rotateWorld(eye, new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(forward, desired), Math.min(1, .22 / Math.max(.001, angle))));
      }
      const blinkTime = (s.time + 1.27) % 4.3;
      const blink = smooth(blinkTime / .07) * (1 - smooth((blinkTime - .09) / .11));
      for (const m of blinkMeshes) m.morphTargetInfluences![m.morphTargetDictionary!.Blink] = blink;
      for (const m of smileMeshes) m.morphTargetInfluences![m.morphTargetDictionary!.SoftSmile] = .6;
      root.updateMatrixWorld(true);
      // Plant the lowest sole on the floor/rug while retaining the authored heel/toe roll.
      let lowest = Infinity;
      for (const shoe of shoes) {
        shoe.skeleton.update(); const positions = shoe.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) { const v = new T.Vector3().fromBufferAttribute(positions, i); shoe.applyBoneTransform(i, v); shoe.localToWorld(v); lowest = Math.min(lowest, v.y); }
      }
      lastFootCorrection = Number.isFinite(lowest) ? s.position.y + .002 - lowest : 0;
      root.position.y += lastFootCorrection; root.updateMatrixWorld(true);
    },
    metrics: () => ({ asset: avatar, bones: bones.size, skinnedMeshes: (() => { let n = 0; root.traverse(o => { if (o instanceof T.SkinnedMesh) n++; }); return n; })(), blinkMeshes: blinkMeshes.length, blink: blinkMeshes[0]?.morphTargetInfluences?.[blinkMeshes[0].morphTargetDictionary!.Blink], clips: [...gltf.animations.map(a => a.name), ...sittingClips.keys()], footCorrection: lastFootCorrection, world: Object.fromEntries(['pelvis', 'Head', 'foot_l', 'foot_r', 'hand_l', 'hand_r'].map(name => [name, worldPosition(bones.get(name)!).toArray()])), pose: [...bones].map(([name, b]) => ({ name, position: b.position.toArray(), rotation: b.quaternion.toArray() })) }),
    dispose() { root.removeFromParent(); resources.forEach(resource => resource.dispose()); },
  };
}

declare const __GUIDE_ASSET_BASE__: string;
