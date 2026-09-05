"""Prepare the CC0 Quaternius base for the adult guide. See docs/ADULT-AVATAR.md.
Run with Blender 4.5: blender -b --python scripts/build-guide-avatar.py -- <asset-directory>
The two downloaded Standard packs must be extracted under <asset-directory>.
"""
import bpy, bmesh, math, pathlib, sys
from mathutils import Vector, Matrix

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = pathlib.Path(sys.argv[sys.argv.index('--') + 1]) if '--' in sys.argv else ROOT / '.scratch/assets'
OUT = ROOT / 'src/assets/guide'; OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(next(ASSETS.rglob('UAL1_Standard.glb'))))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE'); rig.name = 'CreatorRig'
keep = {'Idle_Loop', 'Walk_Loop'}
for track in list(rig.animation_data.nla_tracks):
    if track.name not in keep: rig.animation_data.nla_tracks.remove(track)
    else: track.mute = True
rig.animation_data.action = None
for o in list(bpy.context.scene.objects):
    if o != rig: bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    if a.name not in keep: bpy.data.actions.remove(a)

source = next(ASSETS.rglob('Superhero_Male_FullBody.gltf'))
# The Standard archive has two normal-map names with an extra _png in its glTF.
import json, shutil
gltf = json.loads(source.read_text())
for image in gltf.get('images', []):
    p = source.parent / image.get('uri', '')
    fallback = p.with_name(p.name.replace('_png.png', '.png'))
    if not p.exists() and fallback.exists(): shutil.copyfile(fallback, p)
bpy.ops.import_scene.gltf(filepath=str(source))
oldrig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o != rig)
body = bpy.data.objects['SuperHero_Male']; body.name = 'CreatorSkin'
eyes = bpy.data.objects['Eyes']; brows = bpy.data.objects['Eyebrows']
for o in [body, eyes, brows]:
    for v in o.data.vertices:
        co = v.co.copy(); result = Vector(); total = 0
        for group in v.groups:
            name = o.vertex_groups[group.group].name
            if name in rig.data.bones and name in oldrig.data.bones:
                result += (rig.data.bones[name].matrix_local @ oldrig.data.bones[name].matrix_local.inverted() @ co) * group.weight
                total += group.weight
        if total: v.co = result / total
    o.parent = rig; o.matrix_parent_inverse = Matrix.Identity(4)
    for mod in o.modifiers:
        if mod.type == 'ARMATURE': mod.object = rig
bpy.data.objects.remove(oldrig, do_unlink=True)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o, do_unlink=True)

def material(name, color, roughness=.75):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value = (*color,1); bs.inputs['Roughness'].default_value = roughness
    return m
skin = material('Skin · warm porcelain', (.60,.365,.225), .63)
# Use the creator's painted face/albedo when available, with a reduced texture size.
light = list(ASSETS.rglob('T_Superhero_Male_Ligh.png'))
if light:
    image = bpy.data.images.load(str(light[0])); image.scale(1024,1024)
    node = skin.node_tree.nodes.new('ShaderNodeTexImage'); node.image = image
    skin.node_tree.links.new(node.outputs['Color'], skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
body.data.materials.clear(); body.data.materials.append(skin)
shirtmat = material('GuideCotton', (.245,.34,.275), .88)
trim = material('CottonRib', (.17,.235,.19), .92)
pantsmat = material('IndigoTwill', (.045,.063,.073), .94)
ivory = material('SneakerCanvas', (.79,.76,.66), .85)
rubber = material('SneakerRubber', (.50,.47,.40), .93)

def bind(o, weights=None):
    o.parent = rig; o.matrix_parent_inverse = Matrix.Identity(4)
    mod = o.modifiers.new('Continuous skin', 'ARMATURE'); mod.object = rig
    if weights:
        for bone, weight in weights.items(): o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))), weight, 'REPLACE')
    for p in o.data.polygons: p.use_smooth = True

def surface(name, include, deform, mat):
    o = body.copy(); o.data = body.data.copy(); bpy.context.collection.objects.link(o); o.name = name
    bm = bmesh.new(); bm.from_mesh(o.data)
    # glTF duplicates vertices at UV seams. Weld before identifying garment hems.
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00002)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not include(f.calc_center_median())], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for v in bm.verts:
        if v.is_boundary:
            if name=='CottonCrewneck':
                if abs(v.co.x)>.55:v.co.x=math.copysign(.63,v.co.x)
                elif v.co.z<1.06:v.co.z=.968
                else:
                    a=math.atan2(v.co.y-.01,v.co.x);v.co=Vector((.078*math.cos(a),.01+.062*math.sin(a),1.512))
            elif name=='StraightTrousers' and v.co.z<.22:v.co.z=.14
        v.co = deform(v.co.copy(), v.normal.copy())
    bm.to_mesh(o.data); bm.free(); o.data.materials.clear(); o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    # Smooth anatomy into a fabric silhouette, preserving the skinned topology.
    smooth = o.modifiers.new('Relax cloth', 'SMOOTH'); smooth.factor=.85; smooth.iterations=8
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    solid = o.modifiers.new('Tailored edge', 'SOLIDIFY'); solid.thickness=.004; solid.offset=0
    bpy.ops.object.modifier_apply(modifier=solid.name)
    sub = o.modifiers.new('Soft fabric', 'SUBSURF'); sub.levels=1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    for p in o.data.polygons: p.use_smooth=True
    return o

def shirt_shape(v,n):
    v += n * .024
    if abs(v.x)<.20:
        # Relax the waist and chest: the shirt hangs instead of tracing muscles.
        v.y = .025 + (v.y-.025) * (1.10 if v.z<1.27 else 1.02)
        v.x *= 1.035
    return v
shirt = surface('CottonCrewneck', lambda v: .955 < v.z < 1.62 and (v.z<1.508 or abs(v.x)>.085) and abs(v.x)<.635, shirt_shape, shirtmat)
def trouser_shape(v,n):
    v += n*.014
    center = .09 if v.x>0 else -.09
    if v.z<.80:
        v.x = center+(v.x-center)*1.07
        v.y = .035+(v.y-.035)*1.14
    return v
pants = surface('StraightTrousers',lambda v: .13<v.z<1.035,trouser_shape,pantsmat)

def mesh_obj(name, vertices, faces, mat, weights):
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat);bind(o,weights);return o
def rings(name, levels, mat, weights):
    vertices=[];n=24
    for z,x,y,rx,ry in levels:
        for i in range(n):
            a=i*math.tau/n;vertices.append((x+rx*math.cos(a),y+ry*math.sin(a),z))
    faces=[tuple(range(n-1,-1,-1)),tuple((len(levels)-1)*n+i for i in range(n))]
    for k in range(len(levels)-1):
        for i in range(n): faces.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    return mesh_obj(name,vertices,faces,mat,weights)
# A continuous ribbed neckline covers the cut edge and follows the chest bone.
vertices=[];faces=[]
for i in range(40):
    a=i*math.tau/40
    for j in range(8):
        b=j*math.tau/8
        vertices.append(((.086+.006*math.cos(b))*math.cos(a),.01+(.070+.006*math.cos(b))*math.sin(a),1.519+.008*math.sin(b)))
for i in range(40):
    for j in range(8):faces.append((i*8+j,((i+1)%40)*8+j,((i+1)%40)*8+(j+1)%8,i*8+(j+1)%8))
mesh_obj('RibbedNeckline',vertices,faces,trim,{'spine_03':1})
for sign,side in [(1,'l'),(-1,'r')]:
    x=sign*.091
    rings('CanvasSneaker_'+side,[(.015,x,-.025,.061,.142),(.027,x,-.028,.064,.145),(.052,x,-.030,.061,.141),(.073,x,-.017,.055,.116),(.14,x,.025,.043,.052),(.147,x,.025,.042,.049)],ivory,{'foot_'+side:1})
    rings('Sole_'+side,[(.009,x,-.027,.061,.141),(.018,x,-.027,.064,.146),(.033,x,-.027,.064,.146)],rubber,{'foot_'+side:1})
    # Laces lie across the instep; geometry is bound to the same foot bone.
    for j in range(3):
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-.055+j*.027,.091+j*.012));o=bpy.context.object;o.name='Lace'
        o.scale=(.062,.005,.004);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        # Bake world position before skin binding.
        for v in o.data.vertices:v.co+=o.location
        o.location=(0,0,0);o.data.materials.append(ivory);bind(o,{'foot_'+side:1})

# Remove hidden skin under the clothes, so elbows and knees cannot reveal a second surface.
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if (f.calc_center_median().z<1.00 or (.98<f.calc_center_median().z<1.51 and abs(f.calc_center_median().x)<.61) or (1.51<f.calc_center_median().z<1.60 and abs(f.calc_center_median().x)>.085))],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free()
for p in body.data.polygons:p.use_smooth=True
for v in body.data.vertices:
    x,y,z=v.co
    if z>1.55:
        # Reduce the superhero's square lower jaw and strong nose for a young adult.
        jaw=max(0,1-abs(z-1.615)/.07)
        v.co.x*=1-.10*jaw
        if y<-.10 and 1.63<z<1.70:v.co.y=-.10+(y+.10)*.82

# A matching short side-part from the same CC0 pack, positioned on the head.
hairpath=next(p for p in ASSETS.rglob('Hair_SimpleParted.gltf') if 'Origin at 0' in str(p))
before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(hairpath))
hair=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH' and not o.name.startswith('Icosphere')][0]
print('HAIR bounds',[(min(v.co[i] for v in hair.data.vertices),max(v.co[i] for v in hair.data.vertices)) for i in range(3)])
for v in hair.data.vertices:v.co+=Vector((0,-.022,-.031))
hair.name='ShortSidePart';bind(hair,{'Head':1})
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Icosphere'):bpy.data.objects.remove(o,do_unlink=True)

# Eye joints make gaze independent of the head, while keeping the original eye texture.
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for sign,side in [(1,'l'),(-1,'r')]:
    coords=[v.co for v in eyes.data.vertices if v.co.x*sign>0]
    center=Vector(((min(v.x for v in coords)+max(v.x for v in coords))*.55,(min(v.y for v in coords)+max(v.y for v in coords))*.5+.006,(min(v.z for v in coords)+max(v.z for v in coords))*.5))
    bone=rig.data.edit_bones.new('eye_'+side);bone.head=center;bone.tail=center+Vector((0,-.03,0));bone.parent=rig.data.edit_bones['Head']
bpy.ops.object.mode_set(mode='OBJECT')
eyes.vertex_groups.clear()
for sign,side in [(1,'l'),(-1,'r')]:eyes.vertex_groups.new(name='eye_'+side).add([v.index for v in eyes.data.vertices if v.co.x*sign>0],1,'REPLACE')

# Brows, eyelids and eyes are actual geometry. A blink is stored as a morph target.
for o in [body,eyes]:
    o.shape_key_add(name='Basis');key=o.shape_key_add(name='Blink')
    for i,v in enumerate(o.data.vertices):
        x,y,z=v.co;eye_x=.032 if x>0 else -.032;eye_z=1.665
        if o==eyes:
            key.data[i].co.z=eye_z+(z-eye_z)*.06
        elif abs(x-eye_x)<.032 and abs(z-eye_z)<.024 and y<-.04:
            w=max(0,1-abs(x-eye_x)/.034)*max(0,1-abs(z-eye_z)/.027)
            key.data[i].co.z+=(eye_z-z)*min(1,w*2.8)
smile=body.shape_key_add(name='SoftSmile')
for i,v in enumerate(body.data.vertices):
    x,y,z=v.co
    if .008<abs(x)<.036 and abs(z-1.610)<.012 and y<-.075:
        smile.data[i].co.z+=.0025*max(0,1-abs(z-1.610)/.012)

# Limit imported texture resolution and remove dangling source-only helpers.
for image in bpy.data.images:
    if image.size[0]>1024: image.scale(1024,1024)
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        for attr in list(o.data.color_attributes):o.data.color_attributes.remove(attr)
        while len(o.data.uv_layers)>1:o.data.uv_layers.remove(o.data.uv_layers[-1])
        for p in o.data.polygons:p.use_smooth=True
for o in [body,eyes,brows,hair]:
    if o.data.shape_keys:
        for key in o.data.shape_keys.key_blocks:
            for v in key.data:
                if v.co.z>1.57:v.co.x*=1.1
        for v,basis in zip(o.data.vertices,o.data.shape_keys.key_blocks[0].data):v.co=basis.co
    else:
        for v in o.data.vertices:
            if v.co.z>1.57:v.co.x*=1.1
for v in brows.data.vertices:v.co.z=1.678+(v.co.z-1.678)*.65
rig.scale=(.895,.935,.975)
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.context.scene.render.fps=24
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'creator-18.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_anim_slide_to_zero=True,export_materials='EXPORT',export_morph=True,export_morph_normal=False,export_extras=False)
print('Wrote',OUT/'creator-18.glb')
