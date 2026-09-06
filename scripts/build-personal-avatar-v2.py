"""Personal IP edition 02: swept volume hair, refined face and continuous tailoring. Blender 4.5.

Input: the checked-in CC0-derived creator-18.glb (hands, trousers, shoes, rig,
locomotion). New parametric head, facial geometry, hair, glasses and wardrobe
details are authored here against docs/character-ip/concept-01.png.
Run: blender -b --python scripts/build-personal-avatar-v2.py
"""
import bpy, bmesh, math, pathlib
from mathutils import Vector, Matrix

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/assets/guide/personal-creator-02.glb'
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

skin = mat('IP warm skin', (.59,.357,.245), .64)
skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value = .07
earmat = mat('IP warm ear folds', (.44,.232,.168), .76)
lip = mat('IP soft lip', (.36,.176,.128), .82)
hairmat = mat('IP Espresso', (.030,.017,.011), .67)
hairlight = mat('IP Espresso highlights', (.041,.024,.015), .70)
frame = mat('IP tea acetate', (.067,.033,.019), .34)
metal = mat('IP brushed brass', (.28,.16,.072), .39, .45)
white = mat('IP eye ivory', (.78,.76,.68), .30)
iris = mat('IP brown iris', (.080,.037,.016), .40)
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
    bevel=o.modifiers.new('Rounded stitched edge','BEVEL');bevel.width=.003;bevel.segments=4
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
 (1.592,.077,.078,.003),(1.618,.089,.084,.007),(1.645,.100,.087,.012),
 (1.674,.106,.090,.014),(1.703,.105,.095,.012),(1.739,.108,.101,.015),
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
    y-=.018*g(0,1.680,.016,.041)+.016*g(0,1.654,.018,.017)
    y-=.003*(g(.015,1.646,.010,.010)+g(-.015,1.646,.010,.010))
    y-=.006*(g(.056,1.638,.029,.030)+g(-.056,1.638,.029,.030))
    y+=.0025*(g(.043,1.686,.028,.019)+g(-.043,1.686,.028,.019))
    y-=.005*g(0,1.607,.035,.020)+.005*g(0,1.570,.038,.023)
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
    ball('IP ear', (sign*.106,.009,1.665),(.015,.024,.032),skin)
    ball('IP ear concha',(sign*.113,-.012,1.666),(.006,.002,.016),earmat)
    tube('IP ear helix',[(sign*(.110+.006*math.sin(i*math.pi/28)),-.015,1.645+.034*i/28) for i in range(29)],.002,skin)
    # A convex almond eye patch; no white eyeball protrudes beyond its eyelids.
    cx=sign*.043;cz=1.686;ev=[(cx,front_y(cx,cz)-.0065,cz)];ef=[];n=64;rings=10
    for j in range(1,rings+1):
        r=j/rings
        for i in range(n):
            a=i*math.tau/n;x=cx+.024*r*math.cos(a);z=cz+.0087*r*math.sin(a)+sign*.0012*r*math.cos(a)
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
    for label,radius,m in [('iris',.0085,iris),('pupil',.0040,pupil),('catchlight',.0010,glint)]:
        ox=-.002 if label=='catchlight' else 0;oz=.003 if label=='catchlight' else 0
        def eyepoint(x,z):
            rr=((x-cx)/.024)**2+((z-cz-sign*(x-cx)*.05)/.0087)**2
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
            a=i*math.pi/40+(0 if upper else math.pi);x=cx+.024*math.cos(a);z=cz+.0089*math.sin(a)+sign*.0012*math.cos(a)
            pts.append((x,front_y(x,z)-.002,z))
        lid=tube('IP eyelid '+side,pts,.0015 if upper else .0011,skin)
        lid.shape_key_add(name='Basis');key=lid.shape_key_add(name='Blink')
        for v in key.data:v.co.z=cz+(v.co.z-cz)*.045
    pts=[]
    for i in range(33):
        t=i/32;x=sign*(.018+.051*t);z=1.710+.006*math.sin(math.pi*t)-.003*t
        pts.append((x,front_y(x,z)-.003,z))
    tube('IP relaxed brow',pts,lambda t:.0005+.0017*math.sin(math.pi*t)**.5,hairmat)
    # Rounded square tea-brown frames, nose bridge and bent temple arms.
    pts=[]
    for i in range(80):
        a=i*math.tau/80;co=math.cos(a);si=math.sin(a)
        x=cx+.0345*math.copysign(abs(co)**.58,co);z=1.686+.022*math.copysign(abs(si)**.66,si)
        pts.append((x,-.108+abs(x)*.07,z))
    tube('IP tea glasses rim',pts,.00165,frame,closed=True,sides=10)
    tube('IP glasses temple',[(sign*.077,-.104,1.697),(sign*.099,-.075,1.701),(sign*.109,-.015,1.697),(sign*.111,.018,1.677)],.00165,frame)
    ball('IP hinge',(sign*.077,-.105,1.698),(.002,.0015,.0013),metal)
    # Discrete nostrils on the underside of the integrated nose.
    x=sign*.012;z=1.641
    ball('IP nostril',(x,front_y(x,z)-.0002,z),(.002,.0007,.0008),lip)
tube('IP glasses bridge',[(x,-.116+.009*(x/.010)**2,1.691+.003*(1-(x/.010)**2)) for x in [(-.010+i*.020/24) for i in range(25)]],.002,frame)
# Soft lip volumes around a fine closed mouth; no floating cartoon smile tube.
def mouth_z(x): return 1.607+.0028*(abs(x)/.027)**1.7
for upper in [True,False]:
    vs=[];fs=[];nx=56;ny=7
    for i in range(nx+1):
        x=-.027+.054*i/nx;fade=max(0,1-(x/.027)**2)**.8
        height=(.0032 if upper else .0042)*fade
        if upper:height*=.82+.24*math.exp(-((abs(x)-.007)/.004)**2)
        for j in range(ny+1):
            t=j/ny;z=mouth_z(x)+(1 if upper else -1)*height*t
            y=front_y(x,z)-.0009-.0018*math.sin(math.pi*t)*fade
            vs.append((x,y,z))
    for i in range(nx):
        for j in range(ny):
            k=i*(ny+1)+j;fs.append((k,k+1,k+ny+2,k+ny+1))
    o=mesh('IP shaped upper lip' if upper else 'IP shaped lower lip',vs,fs,mat('IP lip rose '+str(upper),(.51,.275,.205) if upper else (.55,.301,.225),.64))
    o.shape_key_add(name='Basis');key=o.shape_key_add(name='SoftSmile')
    for v in key.data:v.co.z+=.0012*(abs(v.co.x)/.027)**2
mouth=[(x,front_y(x,mouth_z(x))-.0011,mouth_z(x)) for x in [-.027+.054*i/48 for i in range(49)]]
mouthobj=tube('IP lip seam',mouth,lambda t:.00008+.00015*math.sin(math.pi*t),lip)
mouthobj.shape_key_add(name='Basis');key=mouthobj.shape_key_add(name='SoftSmile')
for v in key.data:v.co.z+=.0012*(abs(v.co.x)/.027)**2

# Freeform sculpted locks. Do NOT project control curves onto a sphere: that
# flattened edition 01 into a helmet and erased the swept crest and lifted tips.
verts=[];faces=[];nr=32;nc=96
for j in range(nr+1):
    for i in range(nc):
        a=i*math.tau/nc;f=(1+math.cos(a))/2
        lower=1.650+.018*math.sin(a)**2+.144*f**4+.002*math.sin(a*23)
        phi=j/nr*math.acos(max(-1,min(1,(lower-1.745)/.105)))
        z=1.745+.105*math.cos(phi)
        x=.114*math.sin(phi)*math.sin(a);y=.022-.116*math.sin(phi)*math.cos(a)
        if z<1.81:
            rx,ry,cy=profile(z);t=max(0,min(1,(1.81-z)/.04));t=t*t*(3-2*t)
            groove=1+.005*math.cos(36*a+z*15)
            tx=(rx+.007)*math.sin(a)*groove
            # Match the actual flattened cheek/temple profile, not an ellipse.
            # Otherwise the forehead pokes through as narrow vertical skin bars.
            ty=front_y(tx,z)-.008 if math.cos(a)>=0 else cy+ry*(-math.cos(a))**.8+.013
            x=x*(1-t)+tx*t;y=y*(1-t)+ty*t
        verts.append((x,y,z))
for j in range(nr):
    for i in range(nc):faces.append((j*nc+i,j*nc+(i+1)%nc,(j+1)*nc+(i+1)%nc,(j+1)*nc+i))
mesh('IP sculpted hair undercut',verts,faces,hairmat)
def bezier(points,t):
    p=[Vector(v) for v in points]
    return p[0]*(1-t)**3+p[1]*3*t*(1-t)**2+p[2]*3*t*t*(1-t)+p[3]*t**3
hairmid=mat('IP walnut midtone',(.035,.020,.013),.68)
def lock(name,control,width,depth,material,detail=False):
    control=[(x,y,1.75+(z-1.75)*.65 if z>1.75 else z) for x,y,z in control]
    pts=[bezier(control,i/44) for i in range(45)];verts=[];faces=[];n=24
    frames=[]
    for i,p in enumerate(pts):
        t=i/44;tangent=(pts[min(44,i+1)]-pts[max(0,i-1)]).normalized()
        outward=Vector((p.x/.12,(p.y-.012)/.115,(p.z-1.745)/.142)).normalized()
        u=tangent.cross(outward).normalized();v=u.cross(tangent).normalized()
        taper=max(.007,min(1,((1-t)/.30)**.72))
        shape=(.70+.30*math.sin(math.pi*t))*taper
        frames.append((u,v,shape))
        for k in range(n):
            a=k*math.tau/n;co=math.cos(a);si=math.sin(a)
            ridge=(1+.013*math.cos(8*a+1.7*t)) if si>0 else .60
            verts.append(p+u*width*shape*co+v*depth*.62*shape*si*ridge)
    for i in range(44):
        for k in range(n):faces.append((i*n+k,i*n+(k+1)%n,(i+1)*n+(k+1)%n,(i+1)*n+k))
    faces += [tuple(range(n-1,-1,-1)),tuple(44*n+k for k in range(n))]
    mesh(name,verts,faces,material)
    if False and detail:
        # A subtle raised groove follows the lock; no random floating strands.
        for offset in [-.32,.26]:
            line=[]
            for i in range(5,39):
                u,v,shape=frames[i];line.append(pts[i]+u*width*shape*offset+v*depth*shape*math.sqrt(1-offset*offset))
            tube('IP subtle hair flow',line,lambda t:.00010+.00014*math.sin(math.pi*t),hairlight,sides=5)
# Back and temples are built first so the airy frontal silhouette stays readable.
for i in range(13):
    a=-1.48+2.96*i/12
    lock('IP tapered nape',[(.018,.019,1.865),(.115*math.sin(a),.107,1.903),(.112*math.sin(a),.133,1.766),(.082*math.sin(a),.110,1.651+.009*math.cos(a*3))],.025,.012,hairmat if i%3 else hairmid)
for sign in [-1,1]:
    for i in range(6):
        t=i/5
        lock('IP layered temple',[(sign*.055,-.006+.041*t,1.869),(sign*.126,-.034+.116*t,1.853),(sign*.121,-.033+.112*t,1.754),(sign*(.107+.005*math.sin(t*math.pi)),-.014+.085*t,1.701+.006*t)],.022,.012,hairmat if i%2 else hairmid)
for i in range(7):
    t=i/6
    lock('IP swept crown',[(.032,.015+.025*t,1.877),(-.018-.060*t,.005+.035*t,1.924),(-.106-.018*t,-.038+.095*t,1.871),(-.122+.014*t,-.014+.080*t,1.770+.028*t)],.027,.015,hairmat if i%3 else hairmid,detail=i in [0,3])
# Sweeping S-shaped fringe: lifted root, full crest, taper away from the eye.
for i in range(6):
    lock('IP airy side fringe',[(.029,-.058+i*.007,1.878+i*.002),(-.002-i*.010,-.104+i*.003,1.928-i*.003),(-.089-i*.007,-.145+i*.006,1.808+i*.011),(-.045-i*.014,-.110+i*.010,1.717+i*.011)],.021+i*.0007,.0125,hairmat if i%2 else hairmid,detail=i in [0,2,4])
# One distinct curled forelock establishes the character's asymmetric silhouette.
lock('IP signature forelock',[(.038,-.055,1.876),(.006,-.123,1.918),(-.020,-.137,1.804),(-.029,-.103,1.724)],.018,.011,hairmid,detail=True)
for i in range(5):
    t=i/4
    lock('IP lifted short part',[(.035,-.052+.067*t,1.884),(.095,-.072+.074*t,1.872),(.118,-.078+.094*t,1.782),(.105+.003*t,-.041+.067*t,1.722+.010*t)],.021,.014,hairmat if i%2 else hairmid,detail=i==0)

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
# Blend the tall original neckline into the continuous shirt collar.
for v in bm.verts:
    if v.co.z>1.475 and abs(v.co.x)<.18:
        a=math.atan2(v.co.y-.01,v.co.x);t=max(0,min(1,(v.co.z-1.475)/.060))
        t=t*t*(3-2*t)
        target=Vector((.081*math.cos(a),.01+.067*math.sin(a),1.508+(v.co.z-1.525)*.12))
        v.co=v.co.lerp(target,t)
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
    t=j/8;rx=.090-.020*t;ry=.075-.018*t
    for i in range(n+1):
        a=.57+(math.tau-1.14)*i/n;vs.append((rx*math.sin(a),.01-ry*math.cos(a),1.493+.039*t))
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
    rounded_patch('IP folded collar',[(sign*.061,-.032,1.532),(sign*.123,-.081,1.490),(sign*.091,-.125,1.446),(sign*.050,-.098,1.488)],sage,thickness=.007)
    tube('IP collar seam',[(sign*.123,-.084,1.490),(sign*.091,-.128,1.448),(sign*.052,-.101,1.488)],.00085,sageedge,{'spine_03':1})
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

# Gentle warm/cool skin variation is stored in vertex colors, not a face photograph.
for o in bpy.context.scene.objects:
    if o.type!='MESH' or skin not in list(o.data.materials):continue
    attr=o.data.color_attributes.new(name='SkinTint',type='FLOAT_COLOR',domain='POINT')
    for v in o.data.vertices:
        x,y,z=v.co
        cheek=math.exp(-((abs(x)-.061)/.029)**2-((z-1.648)/.020)**2)*max(0,min(1,(-y-.01)/.05))
        nose=math.exp(-(x/.021)**2-((z-1.650)/.020)**2)*max(0,min(1,(-y-.04)/.04))
        ear=math.exp(-((abs(x)-.110)/.018)**2-((z-1.665)/.032)**2)
        warm=min(.85,cheek*.45+nose*.22+ear*.35)
        attr.data[v.index].color=(.59,.357*(.99-warm*.12),.245*(.98-warm*.14),1)
    o.data.color_attributes.active_color=attr
vcol=skin.node_tree.nodes.new('ShaderNodeVertexColor');vcol.layer_name='SkinTint'
skin.node_tree.links.new(vcol.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# The same vertex color material is visible in Blender and exported as COLOR_0.

SOURCE = ROOT / 'docs/character-ip/source/personal-creator-02.blend'
SOURCE.parent.mkdir(parents=True,exist_ok=True)
notes=bpy.data.texts.new('START HERE - Personal IP 02')
notes.write('Personal IP 02 / 18-year-old adult stylized creator.\nHair, head, face and tailoring: scripts/build-personal-avatar-v2.py\nCC0 Quaternius base body, rig, Idle_Loop and Walk_Loop.\nSelect CreatorRig, NLA editor: unmute ONE clip to preview it.\nSit/stand use the separate checked-in guide-motion-v1.glb plus the application seat IK.\nCarried notebook and final poses are runtime features, not baked into this model.\nSee docs/character-ip/EDITION-02.md for source credits and reuse boundaries.\n')
bpy.context.scene.render.fps=24
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=72
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Idle_Loop'
bpy.context.scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_location=(0,0,1)
            area.spaces.active.region_3d.view_distance=3
            area.spaces.active.region_3d.view_rotation=Vector((0,1,-.08)).to_track_quat('-Z','Y')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE),compress=True)

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
