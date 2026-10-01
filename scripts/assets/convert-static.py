import bpy, math, pathlib, os, json
from mathutils import Vector,Matrix
out=pathlib.Path(__file__).resolve().parents[2]/'apps/web/public/models'
def material(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
def export(name):
 bpy.ops.export_scene.gltf(filepath=str(out/name),export_format='GLB',export_animations=False,export_yup=True,use_selection=True)
# Preserve the source's mechanical detailing, one subdivision level and bounded decimation.
bpy.ops.wm.open_mainfile(filepath=str(pathlib.Path(os.environ['CROSSLINE_ASSET_SOURCES'])/'lamoot-ak47.blend'))
steel=material('blued steel',(.055,.066,.077),.85,.33);wood=material('oiled walnut',(.22,.068,.024),0,.4)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in list(bpy.context.scene.objects):
 if o not in meshes:bpy.data.objects.remove(o,do_unlink=True)
for o in meshes:
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 for mod in list(o.modifiers):
  if mod.type=='SUBSURF':mod.levels=1;mod.render_levels=1
  bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
 o.data.materials.clear();o.data.materials.append(wood if o.name in ['Plane.010','Plane.003','Circle.004','Circle.007','Circle.010'] else steel)
 for p in o.data.polygons:p.use_smooth=True
 o.select_set(False)
points=[v.co for o in meshes for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);print('RIFLE BOUNDS',list(lo),list(hi),flush=True)
# Blender +Y is barrel-forward; export as +X long axis to match the existing gun pivot.
length=hi.y-lo.y;center=(lo+hi)/2
for o in meshes:
 for v in o.data.vertices:
  p=v.co.copy();v.co=Vector(((p.y-center.y)/length*5.493686-1.08008,(p.x-center.x)/length*5.493686,(p.z-.72)/length*5.493686))
 o.select_set(True)
# A separate mesh keeps the authoritative reload magazine motion.
mag=bpy.data.objects.get('clip');mag.name='Magazine'
others=[o for o in meshes if o!=mag]
bpy.ops.object.select_all(action='DESELECT')
for o in others:o.select_set(True)
bpy.context.view_layer.objects.active=others[0];bpy.ops.object.join();body=bpy.context.object;body.name='AK47'
for o in [body,mag]:
 tris=sum(len(p.vertices)-2 for p in o.data.polygons)
 if tris>28000:
  mod=o.modifiers.new('web budget','DECIMATE');mod.ratio=28000/tris;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.select_set(True)
export('lamoot-ak47.glb')
# Textured coupe: remove the source display floor, retain the mapped vehicle.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.wm.obj_import(filepath=str(pathlib.Path(os.environ['CROSSLINE_ASSET_SOURCES'])/'car2/car2.obj'))
o=bpy.context.object
import bmesh
bm=bmesh.new();bm.from_mesh(o.data);seen=set();remove=[]
for vertex in bm.verts:
 if vertex in seen:continue
 stack=[vertex];component=[]
 while stack:
  v=stack.pop()
  if v in seen:continue
  seen.add(v);component.append(v)
  stack.extend(e.other_vert(v) for e in v.link_edges if e.other_vert(v) not in seen)
 if max(max(v.co[i] for v in component)-min(v.co[i] for v in component) for i in range(3))>500:remove.extend(component)
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(o.data);bm.free()
o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
points=[v.co for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);print('CAR BOUNDS',list(lo),list(hi),flush=True)
# OBJ contains Z-up data; importer rotated it. Restore native coordinates first.
if hi.y-lo.y < hi.z-lo.z:
 rot=Matrix.Rotation(-math.pi/2,4,'X');o.data.transform(rot)
points=[v.co for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);print('CAR RESTORED',list(lo),list(hi),flush=True)
# Long horizontal axis is Y in Blender; dimensions match the previous conservative proxy.
if hi.x-lo.x>hi.y-lo.y:o.data.transform(Matrix.Rotation(math.pi/2,4,'Z'))
points=[v.co for v in o.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)/2
for v in o.data.vertices:v.co=Vector(((v.co.x-center.x)/(hi.x-lo.x)*1.80736,(v.co.y-center.y)/(hi.y-lo.y)*4.22072,(v.co.z-lo.z)/(hi.z-lo.z)*1.18261))
m=material('paint and trim',(.8,.8,.8),.2,.48);nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
for file,socket in [('corradon.png','Base Color'),('normal_corradon.png','Normal')]:
 im=bpy.data.images.load(str(pathlib.Path(os.environ['CROSSLINE_ASSET_SOURCES'])/'car2'/file));im.pack();t=nodes.new('ShaderNodeTexImage');t.image=im
 if socket=='Normal':
  im.colorspace_settings.name='Non-Color';n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.5;links.new(t.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs[socket])
 else:links.new(t.outputs['Color'],p.inputs[socket])
o.data.materials.clear();o.data.materials.append(m)
for p in o.data.polygons:p.use_smooth=True
bpy.ops.object.select_all(action='SELECT');export('rohezal-coupe.glb')
