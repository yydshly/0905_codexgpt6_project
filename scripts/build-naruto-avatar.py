"""Adapt ronildo.facanha's CC BY 4.0 Naruto mesh to the project's CC0 motion rig.

See docs/NARUTO-CHARACTER.md for the author's public source, credits and scope.
Blender 4.5: blender --disable-autoexec -b --python scripts/build-naruto-avatar.py
The downloaded author ZIP is extracted at .scratch/assets/naruto-author.
"""
import bpy, bmesh, pathlib, math, json
from mathutils import Vector, Matrix

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.scratch/assets/naruto-author'
OUT = ROOT / 'src/assets/guide/naruto-author-01.glb'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'source/Naruto & Sasuke.fbx'))
source_rig = bpy.data.objects['rig']; body = bpy.data.objects['Naruto']
source_rig.animation_data.action = None
for bone in source_rig.pose.bones: bone.matrix_basis.identity()
for o in list(bpy.context.scene.objects):
    if o not in [source_rig, body]: bpy.data.objects.remove(o, do_unlink=True)
for action in list(bpy.data.actions): bpy.data.actions.remove(action)

# Restore the artist's original UV images; the FBX contains obsolete absolute paths.
for m in body.data.materials:
    m.use_nodes = True; bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = 1
    path = SOURCE/'textures'/('smiling.png' if m.name == 'face.png' else m.name)
    if path.is_file():
        im = bpy.data.images.load(str(path)); im.pack()
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = im
        m.node_tree.links.new(n.outputs['Color'], bs.inputs['Base Color'])
        # Painted shadows remain legible at room distance without flattening room lighting.
        m.node_tree.links.new(n.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = .14
    else:
        bs.inputs['Base Color'].default_value = (.002, .003, .006, 1)
    m.use_backface_culling = True

bpy.ops.import_scene.gltf(filepath=str(ROOT/'src/assets/guide/creator-18.glb'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o != source_rig)
for o in list(bpy.context.scene.objects):
    if o not in [source_rig, body, rig]: bpy.data.objects.remove(o, do_unlink=True)
rig.name = 'NarutoGuideRig'; rig.animation_data.action = None
for track in rig.animation_data.nla_tracks: track.mute = True
for bone in rig.pose.bones: bone.matrix_basis.identity()

mapping = {'DEF-spine': 'pelvis', 'DEF-spine.001': 'spine_01', 'DEF-spine.002': 'spine_02',
           'DEF-spine.003': 'spine_03', 'DEF-spine.004': 'neck_01', 'DEF-spine.005': 'neck_01',
           'DEF-spine.006': 'Head'}
for side in ['L', 'R']:
    suffix = side.lower()
    for src, dst in [('shoulder','clavicle'),('upper_arm','upperarm'),('forearm','lowerarm'),('hand','hand'),
                     ('thigh','thigh'),('shin','calf'),('foot','foot'),('toe','ball'),('pelvis','pelvis')]:
        mapping[f'DEF-{src}.{side}'] = dst if dst == 'pelvis' else f'{dst}_{suffix}'
        if src in ['upper_arm', 'forearm', 'thigh', 'shin']:
            mapping[f'DEF-{src}.{side}.001'] = f'{dst}_{suffix}'
    for src, dst in [('f_index','index'),('f_middle','middle'),('f_ring','ring'),('f_pinky','pinky'),('thumb','thumb')]:
        for i in range(1,4): mapping[f'DEF-{src}.0{i}.{side}'] = f'{dst}_0{i}_{suffix}'
    for i in range(1,5): mapping[f'DEF-palm.0{i}.{side}'] = f'hand_{suffix}'

# Each anatomical segment uses one continuous affine transform. Split Rigify twist
# weights are combined, retaining the artist's topology, UVs and inside-out outline.
scale = .319
centering = Vector((1.471383, .74, .021298))
canonical = {dst: src for src, dst in reversed(list(mapping.items()))}
canonical['pelvis'] = 'DEF-spine'; canonical['neck_01'] = 'DEF-spine.004'
for side in ['L','R']:
    for src,dst in [('hand','hand'),('upper_arm','upperarm'),('forearm','lowerarm'),('thigh','thigh'),('shin','calf')]:
        canonical[f'{dst}_{side.lower()}'] = f'DEF-{src}.{side}'
weights = []
for v in body.data.vertices:
    groups = {}
    for g in v.groups:
        dst = mapping.get(body.vertex_groups[g.group].name)
        if dst and dst in rig.data.bones: groups[dst] = groups.get(dst,0) + g.weight
    total = sum(groups.values())
    if not total: groups = {'Head' if v.co.z > 4.8 else 'pelvis': 1}; total = 1
    groups = {name:w/total for name,w in groups.items()}; weights.append(groups)
    co = (v.co - centering) * scale
    delta = Vector()
    for name,w in groups.items():
        origin = (source_rig.data.bones[canonical[name]].head_local - centering) * scale
        delta += (rig.data.bones[name].head_local - origin) * w
    v.co = co + delta
body.vertex_groups.clear()
for name in rig.data.bones.keys(): body.vertex_groups.new(name=name)
for v, groups in zip(body.data.vertices, weights):
    for name,w in groups.items(): body.vertex_groups[name].add([v.index], w, 'REPLACE')
body.parent = rig; body.matrix_parent_inverse = Matrix.Identity(4); body.matrix_basis = Matrix.Identity(4)
for mod in body.modifiers:
    if mod.type == 'ARMATURE': mod.object = rig
bpy.data.objects.remove(source_rig, do_unlink=True)

# Separate artist material islands so shadow and floor-contact treatment are explicit.
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    name = o.data.materials[0].name
    o.name = 'Naruto_' + name.replace('.png','')
    for p in o.data.polygons: p.use_smooth = True
    if name == 'tex02.png': o.name = 'Sole_NarutoLegs'

# The author FBX has a combat idle, not a full locomotion library. Use a documented
# CC0 in-place jog, on the same rig as our walking and sitting clips.
existing = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(next((ROOT/'.scratch/assets').rglob('UAL1_Standard.glb'))))
motion_rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o not in existing)
run_action = next(t.strips[0].action for t in motion_rig.animation_data.nla_tracks if t.name == 'Jog_Fwd_Loop')
run_action.name = 'Run_Loop'
track = rig.animation_data.nla_tracks.new(); track.name = 'Run_Loop'
strip = track.strips.new('Run_Loop', int(run_action.frame_range[0]), run_action)
strip.action_slot = run_action.slots[0]
for o in list(bpy.data.objects):
    if o not in existing: bpy.data.objects.remove(o, do_unlink=True)
for track in rig.animation_data.nla_tracks: track.mute = False
bpy.context.scene.render.fps = 24
rig['source_creator'] = 'ronildo.facanha'
rig['source_url'] = 'https://sketchfab.com/3d-models/b650b60a7bbd4f11b05a435e65116168'
rig['model_license'] = 'CC BY 4.0; Naruto character rights separate'
rig['adaptation'] = 'Ideal Study: repaired images, bone mapping, room motion adaptation'
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_animations=True,
    export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False,
    export_anim_slide_to_zero=True, export_extras=True)
source_out = ROOT/'docs/anime-character/source/naruto-adapted.blend'; source_out.parent.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(source_out))
print('WROTE', OUT, OUT.stat().st_size)
