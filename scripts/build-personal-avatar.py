"""Personal IP sample 01. Blender 4.5, no external generation API.

Input: the checked-in CC0-derived creator-18.glb (hands, trousers, shoes, rig,
locomotion). New parametric head, facial geometry, hair, glasses and wardrobe
details are authored here against docs/character-ip/concept-01.png.
Run: blender -b --python scripts/build-personal-avatar.py
"""
import bpy, bmesh, math, pathlib
from mathutils import Vector, Matrix

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/assets/guide/personal-creator-01.glb'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'src/assets/guide/creator-18.glb'))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks: track.mute = True
for b in rig.pose.bones: b.matrix_basis = Matrix.Identity(4)

def mat(name, color, rough=.7, metallic=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metallic
    return m

skin = mat('IP warm skin', (.67,.425,.28), .62)
skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value = .07
earmat = mat('IP warm ear folds', (.46,.235,.155), .72)
lip = mat('IP soft lip', (.37,.13,.085), .78)
hairmat = mat('IP Espresso', (.026,.016,.012), .78)
hairlight = mat('IP Espresso highlights', (.034,.021,.015), .80)
frame = mat('IP tea acetate', (.105,.048,.022), .32)
metal = mat('IP brushed brass', (.28,.16,.072), .39, .45)
white = mat('IP eye ivory', (.82,.80,.71), .36)
iris = mat('IP brown iris', (.085,.036,.012), .45)
pupil = mat('IP pupil', (.009,.006,.004), .36)
glint = mat('IP catchlight', (.96,.92,.83), .25)
sage = mat('GuideCotton', (.245,.31,.21), .90)
sageedge = mat('CottonRib', (.19,.25,.16), .90)
cream = mat('IP warm cotton', (.77,.71,.58), .93)
clay = mat('IP folded page label', (.45,.18,.075), .86)

def bind(o, weights={'Head':1}):
    o.parent = rig; o.matrix_parent_inverse = Matrix.Identity(4)
    mod = o.modifiers.new('Character skin', 'ARMATURE'); mod.object = rig
    for bone, weight in weights.items():
        o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))), weight, 'REPLACE')
    for p in o.data.polygons: p.use_smooth = True
    return o

def mesh(name, verts, faces, material, weights={'Head':1}):
    d = bpy.data.meshes.new(name); d.from_pydata(verts, [], faces); d.update()
    o = bpy.data.objects.new(name, d); bpy.context.collection.objects.link(o)
    o.data.materials.append(material); bind(o, weights)
    # Recalculate so all closed parametric surfaces face outward.
    bm = bmesh.new(); bm.from_mesh(d); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(d); bm.free()
    return o

def ball(name, center, size, material, weights={'Head':1}):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20)
    o = bpy.context.object; o.name = name
    for v in o.data.vertices:
        v.co = Vector((v.co.x*size[0]+center[0],v.co.y*size[1]+center[1],v.co.z*size[2]+center[2]))
    o.data.materials.append(material); return bind(o, weights)

def tube(name, points, radius, material, weights={'Head':1}, closed=False, sides=8):
    verts=[]; n=len(points); pts=[Vector(p) for p in points]
    for i,p in enumerate(pts):
        tangent=(pts[(i+1)%n]-pts[i-1 if i else n-1] if closed else pts[min(n-1,i+1)]-pts[max(0,i-1)]).normalized()
        up=Vector((0,-1,0))
        if abs(tangent.dot(up))>.95: up=Vector((1,0,0))
        u=tangent.cross(up).normalized(); v=tangent.cross(u).normalized()
        r=radius(i/(n-1)) if callable(radius) else radius
        for j in range(sides):
            a=j*math.tau/sides; verts.append(p+r*(u*math.cos(a)+v*math.sin(a)))
    faces=[]
    for i in range(n if closed else n-1):
        for j in range(sides): faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%n)*sides+(j+1)%sides,((i+1)%n)*sides+j))
    if not closed: faces += [tuple(range(sides-1,-1,-1)),tuple((n-1)*sides+j for j in range(sides))]
    return mesh(name,verts,faces,material,weights)

def rounded_patch(name, points, material, weights={'spine_03':1}, thickness=.003):
    # Bevel/subdivision on a closed thin patch gives tailored, non-razor edges.
    verts=[(x,y-thickness/2,z) for x,y,z in points]+[(x,y+thickness/2,z) for x,y,z in points]
    n=len(points); faces=[tuple(range(n-1,-1,-1)),tuple(n+i for i in range(n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,verts,faces,material,weights)
    bpy.context.view_layer.objects.active=o
    bevel=o.modifiers.new('Rounded stitched edge','BEVEL');bevel.width=.002;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return o

# Retain licensed hands and neck, replace the complete old head and facial assets.
body=bpy.data.objects['CreatorSkin'];body.shape_key_clear()
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if abs(f.calc_center_median().x)<.30],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(body.data);bm.free()
body.data.materials.clear();body.data.materials.append(skin)
for name in ['Eyes','Eyebrows','ShortSidePart','RibbedNeckline','Icosphere']:
    o=bpy.data.objects.get(name)
    if o:bpy.data.objects.remove(o,do_unlink=True)

# An oval, young-adult head with continuous cheek, socket, nose and chin surfaces.
levels=[(1.543,.020,.026,-.003),(1.553,.043,.050,-.006),(1.568,.061,.066,-.001),
 (1.592,.079,.077,.003),(1.618,.091,.084,.007),(1.645,.104,.087,.012),
 (1.674,.109,.090,.014),(1.703,.107,.097,.012),(1.739,.108,.101,.015),
 (1.774,.103,.098,.020),(1.806,.083,.080,.022),(1.826,.045,.047,.022),(1.836,.003,.003,.022)]
def profile(z):
    for j in range(len(levels)-1):
        a,b=levels[j:j+2]
        if z<=b[0]:
            t=max(0,min(1,(z-a[0])/(b[0]-a[0])));h=b[0]-a[0]
            prev=levels[max(0,j-1)];nxt=levels[min(len(levels)-1,j+2)]
            return tuple((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*h*(b[k]-prev[k])/(b[0]-prev[0])+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*h*(nxt[k]-a[k])/(nxt[0]-a[0]) for k in range(1,4))
    return levels[-1][1:]
def front_y(x,z):
    rx,ry,cy=profile(z); s=min(.999,abs(x)/rx)
    y=cy-ry*(1-s*s)**.34
    def g(cx,cz,sx,sz):return math.exp(-((x-cx)/sx)**2-((z-cz)/sz)**2)
    # Bridge, rounded tip, nostril wings, soft cheek pads, shallow eye sockets.
    y-=.024*g(0,1.682,.017,.039)+.038*g(0,1.650,.020,.015)
    y-=.009*(g(.019,1.643,.011,.008)+g(-.019,1.643,.011,.008))
    y-=.013*(g(.059,1.638,.027,.027)+g(-.059,1.638,.027,.027))
    y+=.009*(g(.045,1.690,.031,.017)+g(-.045,1.690,.031,.017))
    y-=.012*g(0,1.607,.043,.016)+.009*g(0,1.571,.036,.013)
    return y
verts=[];faces=[];rows=100;cols=112
for j in range(rows+1):
    z=levels[0][0]+(levels[-1][0]-levels[0][0])*j/rows;rx,ry,cy=profile(z)
    for i in range(cols):
        a=i*math.tau/cols;x=rx*math.sin(a);c=math.cos(a)
        y=front_y(x,z) if c>=0 else cy+ry*(-c)**.8
        verts.append((x,y,z))
for j in range(rows):
    for i in range(cols):faces.append((j*cols+i,j*cols+(i+1)%cols,(j+1)*cols+(i+1)%cols,(j+1)*cols+i))
faces += [tuple(range(cols-1,-1,-1)),tuple(rows*cols+i for i in range(cols))]
head=mesh('IP soft oval face',verts,faces,skin)
# A tiny smile raises the corners without exposing an unrigged mouth interior.
head.shape_key_add(name='Basis');smile=head.shape_key_add(name='SoftSmile')
for i,v in enumerate(head.data.vertices):
    x,y,z=v.co
    if y<0:
        w=math.exp(-((abs(x)-.028)/.012)**2-((z-1.609)/.012)**2)
        smile.data[i].co.z+=.002*w

for sign,side in [(1,'l'),(-1,'r')]:
    ball('IP ear', (sign*.108,.006,1.665),(.018,.025,.037),skin)
    ball('IP ear concha',(sign*.114,-.016,1.666),(.009,.003,.020),earmat)
    tube('IP ear helix',[(sign*(.110+.009*math.sin(i*math.pi/28)),-.020,1.644+.038*i/28) for i in range(29)],.003,skin)
    # A convex almond eye patch; no white eyeball protrudes beyond its eyelids.
    cx=sign*.043;cz=1.690;ev=[(cx,front_y(cx,cz)-.0065,cz)];ef=[];n=64;rings=10
    for j in range(1,rings+1):
        r=j/rings
        for i in range(n):
            a=i*math.tau/n;x=cx+.026*r*math.cos(a);z=cz+.0105*r*math.sin(a)
            y=front_y(x,z)-.0005-.006*(1-r*r)
            ev.append((x,y,z))
    for i in range(n):ef.append((0,1+i,1+(i+1)%n))
    for j in range(rings-1):
        for i in range(n):ef.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
    eye=mesh('IP almond eye '+side,ev,ef,white,{'eye_'+side:1})
    eye.shape_key_add(name='Basis');blink=eye.shape_key_add(name='Blink')
    for v in blink.data:v.co.z=cz+(v.co.z-cz)*.025;v.co.y=front_y(v.co.x,cz)-.0008
    # Eye joints use new centers, so the existing attention solver can be reused.
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    bone=rig.data.edit_bones['eye_'+side];bone.head=(cx,-.076,cz);bone.tail=(cx,-.110,cz)
    bpy.ops.object.mode_set(mode='OBJECT')
    for label,radius,m in [('iris',.0080,iris),('pupil',.0037,pupil),('catchlight',.0015,glint)]:
        ox=-.002 if label=='catchlight' else 0;oz=.003 if label=='catchlight' else 0
        def eyepoint(x,z):
            rr=((x-cx)/.026)**2+((z-cz)/.0105)**2
            return (x,front_y(x,z)-.0008-.006*(1-rr)-(0.00015 if label=='pupil' else .0003 if label=='catchlight' else 0),z)
        vs=[eyepoint(cx+ox,cz+oz)];fs=[];n=48
        for j in range(1,5):
            r=radius*j/4
            for i in range(n):
                a=i*math.tau/n;vs.append(eyepoint(cx+ox+r*math.cos(a),cz+oz+r*math.sin(a)))
        for i in range(n):fs.append((0,1+i,1+(i+1)%n))
        for j in range(3):
            for i in range(n):fs.append((1+j*n+i,1+j*n+(i+1)%n,1+(j+1)*n+(i+1)%n,1+(j+1)*n+i))
        o=mesh('IP '+label+' '+side,vs,fs,m,{'eye_'+side:1})
        o.shape_key_add(name='Basis');key=o.shape_key_add(name='Blink')
        for v in key.data:v.co.z=cz+(v.co.z-cz)*.02;v.co.y+=.027
    for upper in [True,False]:
        pts=[]
        for i in range(41):
            a=i*math.pi/40+(0 if upper else math.pi);x=cx+.026*math.cos(a);z=cz+.011*math.sin(a)
            pts.append((x,front_y(x,z)-.002,z))
        lid=tube('IP eyelid '+side,pts,.0019 if upper else .0013,earmat if upper else skin)
        lid.shape_key_add(name='Basis');key=lid.shape_key_add(name='Blink')
        for v in key.data:v.co.z=cz+(v.co.z-cz)*.045
    pts=[]
    for i in range(33):
        t=i/32;x=sign*(.017+.058*t);z=1.718+.005*math.sin(math.pi*t)-.004*t
        pts.append((x,front_y(x,z)-.003,z))
    tube('IP relaxed brow',pts,lambda t:.001+.0025*math.sin(math.pi*t)**.5,hairmat)
    # Rounded square tea-brown frames, nose bridge and bent temple arms.
    pts=[]
    for i in range(80):
        a=i*math.tau/80;co=math.cos(a);si=math.sin(a)
        x=cx+.0375*math.copysign(abs(co)**.58,co);z=1.690+.027*math.copysign(abs(si)**.66,si)
        pts.append((x,-.121+abs(x)*.06,z))
    tube('IP tea glasses rim',pts,.0023,frame,closed=True,sides=10)
    tube('IP glasses temple',[(sign*.080,-.116,1.705),(sign*.101,-.082,1.707),(sign*.113,-.018,1.700),(sign*.115,.018,1.677)],.0021,frame)
    ball('IP hinge',(sign*.080,-.117,1.704),(.0027,.002,.0018),metal)
    # Discrete nostrils on the underside of the integrated nose.
    x=sign*.013;z=1.640
    ball('IP nostril',(x,front_y(x,z)-.0002,z),(.0032,.0007,.0013),earmat)
tube('IP glasses bridge',[(x,-.126+.012*(x/.010)**2,1.697+.003*(1-(x/.010)**2)) for x in [(-.010+i*.020/24) for i in range(25)]],.002,frame)
mouth=[]
for i in range(49):
    x=-.030+.06*i/48;z=1.608+.005*(abs(x)/.030)**1.7;mouth.append((x,front_y(x,z)-.0015,z))
mouthobj=tube('IP quiet smile',mouth,lambda t:.0006+.0008*math.sin(math.pi*t),lip)
mouthobj.shape_key_add(name='Basis');key=mouthobj.shape_key_add(name='SoftSmile')
for v in key.data:v.co.z+=.002*(abs(v.co.x)/.030)**2

# Sculpted hair shell plus tapered flowing locks, with restrained strand grooves.
verts=[];faces=[];nr=35;nc=96
for j in range(nr+1):
    for i in range(nc):
        a=i*math.tau/nc
        # Higher open forehead, lower back/nape. Fringe supplies the asymmetry.
        lower=1.751+.014*math.sin(a*2+.6)+.007*math.sin(a*5+.7) if math.cos(a)>0 else 1.654
        phi=(j/nr)*(math.acos(max(-1,min(1,(lower-1.737)/.118))))
        verts.append((.117*math.sin(phi)*math.sin(a),.017-.108*math.sin(phi)*math.cos(a),1.737+.118*math.cos(phi)))
for j in range(nr):
    for i in range(nc):faces.append((j*nc+i,j*nc+(i+1)%nc,(j+1)*nc+(i+1)%nc,(j+1)*nc+i))
mesh('IP hair foundation',verts,faces,hairmat)
def bezier(points,t):
    p=[Vector(v) for v in points]
    return p[0]*(1-t)**3+p[1]*3*t*(1-t)**2+p[2]*3*t*t*(1-t)+p[3]*t**3
def lock(name,control,width,depth,material):
    pts=[]
    for i in range(37):
        p=bezier(control,i/36);q=Vector((p.x/.118,(p.y-.017)/.110,(p.z-1.737)/.120)).normalized()
        pts.append(Vector((q.x*.120,.017+q.y*.113,1.737+q.z*.122)))
    verts=[];faces=[];n=12
    for i,p in enumerate(pts):
        t=i/36;tangent=(pts[min(36,i+1)]-pts[max(0,i-1)]).normalized()
        outward=Vector((p.x,p.y-.017,(p.z-1.72)*.8)).normalized()
        u=tangent.cross(outward).normalized();v=u.cross(tangent).normalized()
        shape=(.32+.68*math.sin(math.pi*min(.98,t*.87+.10)))*max(.015,(1-t)**.38)
        for k in range(n):
            a=k*math.tau/n;verts.append(p+u*width*shape*math.cos(a)+v*depth*shape*math.sin(a))
    for i in range(36):
        for k in range(n):faces.append((i*n+k,i*n+(k+1)%n,(i+1)*n+(k+1)%n,(i+1)*n+k))
    faces += [tuple(range(n-1,-1,-1)),tuple(36*n+k for k in range(n))]
    mesh(name,verts,faces,material)
    for offset in [-.30,.30]:
        strand=[]
        for i,p in enumerate(pts[2:-2],2):
            t=i/36;tangent=(pts[i+1]-pts[i-1]).normalized();out=Vector((p.x,p.y-.017,(p.z-1.72)*.8)).normalized();u=tangent.cross(out).normalized();v=u.cross(tangent).normalized()
            shape=(.32+.68*math.sin(math.pi*min(.98,t*.87+.10)))*max(.015,(1-t)**.38)
            strand.append(p+u*width*shape*offset+v*depth*shape*.965)
        tube('IP hair strand',strand,.00055,hairlight,sides=5)
# Broad layers cover the whole cap, preserving a parted rather than helmet outline.
for i in range(28):
    a=-math.pi+i*math.tau/28
    lower=1.751+.014*math.sin(a*2+.6)+.007*math.sin(a*5+.7) if math.cos(a)>0 else 1.660
    endpoint=(.110*math.sin(a),.017-.103*math.cos(a),lower-.005)
    lock('IP crown layer',[(.029,.011,1.857),(.051+.042*math.sin(a),.011-.048*math.cos(a),1.863),(.112*math.sin(a+.18),.018-.105*math.cos(a+.18),1.790),endpoint],.023,.0065,hairmat)
# Locks fan out from an off-center part over the crown and across the forehead.
for i in range(7):
    a=i/6
    lock('IP swept fringe',[(.039-a*.009,-.045+a*.025,1.852),(.017-a*.017,-.107,1.870-a*.008),(-.048-a*.040,-.137+a*.010,1.806-a*.012),(-.025-a*.080,-.116+a*.037,1.720+a*.036)],.031,.011,hairmat)
for i in range(5):
    a=i/4
    lock('IP short part',[(.043,-.049+a*.068,1.847),(.101,-.094+a*.033,1.846),(.117,-.102+a*.072,1.776),(.089+a*.019,-.079+a*.078,1.719-a*.014)],.019,.012,hairmat)
for i in range(9):
    a=-1.5+i*3/8
    lock('IP back layers',[(.025,.038,1.851),(.113*math.sin(a),.092,1.864),(.117*math.sin(a),.126,1.733),(.096*math.sin(a),.090,1.653)],.022,.012,hairmat)

# Cut a precise opening through the existing continuous skinned garment.
# Polygon clipping interpolates weights at each intersection, avoiding torn
# triangle edges and retaining the welded shoulder/elbow topology.
shirt=bpy.data.objects['CottonCrewneck'];shirt.name='IP open overshirt'
def gap(z):return .031+max(0,z-1.27)*.22
sourceverts=[]
for v in shirt.data.vertices:
    co=v.co.copy()
    if abs(co.x)<.19:
        co.y=.025+(co.y-.025)*1.07
        if co.z<1.14:co.z-=.045*(1-min(1,max(0,(co.z-.98)/.16)))
    weights={shirt.vertex_groups[g.group].name:g.weight for g in v.groups}
    sourceverts.append((co,weights))
def clip(poly,side):
    output=[]
    for i,current in enumerate(poly):
        previous=poly[i-1];a=side*previous[0].x-gap(previous[0].z);b=side*current[0].x-gap(current[0].z)
        if (a>=0)!=(b>=0):
            t=a/(a-b);co=previous[0].lerp(current[0],t)
            w={name:previous[1].get(name,0)*(1-t)+current[1].get(name,0)*t for name in set(previous[1])|set(current[1])}
            output.append((co,w))
        if b>=0:output.append(current)
    return output
vs=[];fs=[];weights=[]
for face in shirt.data.polygons:
    poly=[sourceverts[i] for i in face.vertices];center=sum((v[0] for v in poly),Vector())/len(poly)
    parts=[clip(poly,1),clip(poly,-1)] if center.y<-.015 else [poly]
    for part in parts:
        if len(part)<3:continue
        fs.append(tuple(range(len(vs),len(vs)+len(part))));vs.extend(v[0] for v in part);weights.extend(v[1] for v in part)
o=mesh('IP tailored overshirt',vs,fs,sage,{})
for name in {name for w in weights for name in w}:o.vertex_groups.new(name=name)
for i,w in enumerate(weights):
    top=sorted(w.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(value for _,value in top)
    for name,value in top:
        if value>.00001:o.vertex_groups[name].add([i],value/total,'REPLACE')
bm=bmesh.new();bm.from_mesh(o.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
# Normalize the open neckline to a continuous collar instead of the old cut edge.
for v in bm.verts:
    if v.is_boundary and v.co.z>1.495 and abs(v.co.x)<.14:
        a=math.atan2(v.co.y-.01,v.co.x);v.co=Vector((.085*math.cos(a),.01+.074*math.sin(a),1.510))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.data.objects.remove(shirt,do_unlink=True)
# Small stitched plackets follow the continuous opening, mostly flush with cloth.
for sign in [-1,1]:
    pts=[]
    for i in range(50):
        z=.952+.495*i/49;x=gap(z)
        candidates=[v.co.y for v in o.data.vertices if abs(v.co.z-z)<.012 and abs(v.co.x-sign*x)<.008 and v.co.y<-.04]
        if candidates:pts.append((sign*x,min(candidates)-.001,z))
    tube('IP front placket',pts,.0015,sageedge,{'spine_03':1})
vs=[];fs=[];n=64
for j in range(9):
    t=j/8;rx=.138-.066*t;ry=.105-.038*t
    for i in range(n+1):
        a=.57+(math.tau-1.14)*i/n;vs.append((rx*math.sin(a),.01-ry*math.cos(a),1.512+.017*t))
for j in range(8):
    for i in range(n):fs.append((j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i))
mesh('IP standing collar',vs,fs,sage,{'spine_03':1})
# Smooth, closed neck replaces the cut base triangles. Top follows the head.
vs=[];fs=[];n=64
for j in range(16):
    t=j/15;z=1.475+.106*t;r=.061-.016*t
    for i in range(n):
        a=i*math.tau/n;vs.append((r*math.sin(a),.009-r*.85*math.cos(a),z))
for j in range(15):
    for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
o=mesh('IP neck',vs,fs,skin,{'spine_03':1});o.vertex_groups.clear()
for name in ['spine_03','Head']:o.vertex_groups.new(name=name)
for v in o.data.vertices:
    t=max(0,min(1,(v.co.z-1.485)/.078));t=t*t*(3-2*t)
    if t<1:o.vertex_groups['spine_03'].add([v.index],1-t,'REPLACE')
    if t>0:o.vertex_groups['Head'].add([v.index],t,'REPLACE')
# Cream inner shirt follows the torso and ends under the overshirt.
verts=[];faces=[];n=48
for j in range(15):
    t=j/14;z=1.005+.490*t;rx=.112+.020*math.sin(t*math.pi*.85);ry=.084+.012*math.sin(t*math.pi)
    if t>.83:rx*=1-(t-.83)*3.3;ry*=1-(t-.83)*2.1
    for i in range(n):
        a=i*math.tau/n;verts.append((rx*math.sin(a),-.009-ry*math.cos(a),z))
for j in range(14):
    for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
mesh('IP ivory tee',verts,faces,cream,{'spine_03':1})
tube('IP tee collar',[(.080*math.sin(i*math.tau/64),.016-.065*math.cos(i*math.tau/64),1.496) for i in range(64)],.004,cream,{'spine_03':1},closed=True)
for sign,side in [(1,'l'),(-1,'r')]:
    rounded_patch('IP folded collar',[(sign*.075,-.042,1.529),(sign*.139,-.074,1.480),(sign*.112,-.123,1.453),(sign*.057,-.102,1.486)],sage,thickness=.007)
    tube('IP collar seam',[(sign*.139,-.077,1.480),(sign*.112,-.126,1.455),(sign*.059,-.105,1.486)],.00085,sageedge,{'spine_03':1})
    # Rolled cuffs are lofts along the forearm rest axis, not detached bracelets.
    pts=[];vs=[];fs=[];n=40
    for k in range(5):
        x=sign*(.566+k*.010);r=.056+.003*math.sin(k*math.pi/4)
        for i in range(n):
            a=i*math.tau/n;vs.append((x,.067+r*math.cos(a),1.441+r*math.sin(a)))
    for k in range(4):
        for i in range(n):fs.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
    mesh('IP rolled cuff',vs,fs,sageedge,{'lowerarm_'+side:1})
rounded_patch('IP chest pocket',[(.073,-.124,1.351),(.139,-.114,1.351),(.137,-.113,1.273),(.106,-.124,1.263),(.074,-.130,1.277)],sage)
tube('IP pocket stitching',[(.076,-.133,1.344),(.077,-.134,1.280),(.106,-.128,1.267),(.134,-.117,1.277),(.136,-.117,1.344)],.0008,sageedge,{'spine_03':1})
rounded_patch('IP folded page badge',[(.121,-.126,1.345),(.133,-.126,1.345),(.133,-.128,1.315),(.124,-.129,1.318)],clay)
for z in [1.10,1.20,1.30,1.395]:
    x=-gap(z)-.010;y=-.124 if z<1.31 else -.114
    ball('IP horn button',(x,y,z),(.0035,.0015,.0035),metal,{'spine_03':1})
# Sneaker canvas and trousers retain the previous rigged topology.
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    for m in o.data.materials:
        if m.name.startswith('IndigoTwill'):
            m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.042,.045,.043,1)
        if m.name.startswith('SneakerRubber'):
            m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.62,.57,.47,1)
    for p in o.data.polygons:p.use_smooth=True

# Inner layers and sewn details follow the same torso weights as the outer
# garment; otherwise a rigid spine-only tee can break through its side in idle.
from mathutils.kdtree import KDTree
kd=KDTree(len(sourceverts))
for i,(co,_) in enumerate(sourceverts):kd.insert(co,i)
kd.balance()
for o in list(bpy.context.scene.objects):
    if o.type!='MESH' or not o.name.startswith(('IP ivory tee','IP tee collar','IP chest pocket','IP pocket stitching','IP folded page badge','IP horn button','IP front placket','IP folded collar','IP collar seam','IP standing collar')):continue
    o.vertex_groups.clear()
    for v in o.data.vertices:
        combined={}
        for _,i,d in kd.find_n(v.co,4):
            factor=1/max(.002,d)**2
            for name,w in sourceverts[i][1].items():combined[name]=combined.get(name,0)+w*factor
        top=sorted(combined.items(),key=lambda pair:pair[1],reverse=True)[:4];total=sum(w for _,w in top)
        for name,w in top:
            group=o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
            group.add([v.index],w/total,'REPLACE')

# Consolidate rigid same-material details into skinned meshes to control draw calls.
groups={}
for o in list(bpy.context.scene.objects):
    if o.type=='MESH' and not o.data.shape_keys and not o.name.startswith('Sole_'):
        key=tuple(m.name for m in o.data.materials);groups.setdefault(key,[]).append(o)
for objects in groups.values():
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.context.scene.render.fps=24
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_anim_slide_to_zero=True,export_morph=True,export_morph_normal=False,export_extras=False)
print('Wrote',OUT,OUT.stat().st_size,'bytes')
