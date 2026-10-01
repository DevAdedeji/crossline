import bpy, math, pathlib, os
from mathutils import Matrix,Vector
root=pathlib.Path(str(pathlib.Path(os.environ['CROSSLINE_ASSET_SOURCES'])/'rocketbox'));out=str(pathlib.Path(__file__).resolve().parents[2]/'apps/web/public/models/rocketbox-soldier.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(root/'Assets/Avatars/Professions/Military_Male_01/Export/Military_Male_01.fbx'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH')
rig.animation_data_clear()
for o in list(bpy.context.scene.objects):
 if o not in [rig,mesh]:bpy.data.objects.remove(o,do_unlink=True)
for mat in mesh.data.materials:
 mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();p=nodes.new('ShaderNodeBsdfPrincipled');output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(p.outputs['BSDF'],output.inputs['Surface']);p.inputs['Roughness'].default_value=.82
 for kind in ['color','normal']:
  name=mat.name+'_' +kind+('_acu' if kind=='color' and mat.name in ['sm002_body','sm002_helmet','sm002_equipment'] else '')+'.tga'
  path=root/'Assets/Avatars/Professions/Military_Male_01/Textures'/name
  im=bpy.data.images.load(str(path));im.scale(min(1024,im.size[0]),min(1024,im.size[1]));im.file_format='PNG';im.pack();t=nodes.new('ShaderNodeTexImage');t.image=im
  if kind=='color':mat.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
  else:
   im.colorspace_settings.name='Non-Color';n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.65;mat.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
# Compatible source animation actions retain natural breathing and a measured walk.
rig.animation_data_create();actions=[]
for filename,label in [('all_animations_max_motextr_static/m_idle_neutral_01.max.fbx','Idle_Neutral'),('all_animations_max_motextr_xy/m_walk_slow_01.max.fbx','Walk')]:
 before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(root/'Assets/Animations'/filename));new=set(bpy.data.objects)-before;source=next(o for o in new if o.type=='ARMATURE');original=source.animation_data.action
 a=bpy.data.actions.new('Crossline|'+label);rig.animation_data.action=a
 bpy.context.scene.frame_set(int(original.frame_range[0]));bpy.context.view_layer.update()
 initial=(source.matrix_world@source.pose.bones['Bip01 Pelvis'].matrix).translation.copy()
 for frame in range(int(original.frame_range[0]),int(original.frame_range[1])+1,2):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
  current=(source.matrix_world@source.pose.bones['Bip01 Pelvis'].matrix).translation.copy()
  drift=Vector((current.x-initial.x,current.y-initial.y,0)) if label=='Walk' else Vector((0,0,0))
  for pb in rig.pose.bones:
   if pb.name not in source.pose.bones:continue
   desired=source.matrix_world@source.pose.bones[pb.name].matrix;desired.translation-=drift
   pb.matrix=rig.matrix_world.inverted()@desired
   pb.scale=(1,1,1)
   if pb.parent:pb.location=(0,0,0)
   pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
   bpy.context.view_layer.update()
 actions.append(a)
 for o in new:bpy.data.objects.remove(o,do_unlink=True)
# Retarget CC0 Quaternius combat clips using world-space rest-to-pose rotations.
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(pathlib.Path(__file__).resolve().parents[2]/'apps/web/public/models/quaternius-swat.glb'));new=set(bpy.data.objects)-before;source=next(o for o in new if o.type=='ARMATURE');[source.animation_data.nla_tracks.remove(t) for t in list(source.animation_data.nla_tracks)]
source.animation_data.action=bpy.data.actions.get('CharacterArmature|Idle_Neutral');source.animation_data.action_slot=source.animation_data.action.slots[0]
rig.animation_data.action=actions[0];rig.animation_data.action_slot=actions[0].slots[0]
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
map={'Bip01 Pelvis':'Hips','Bip01 Spine':'Abdomen','Bip01 Spine1':'Torso','Bip01 Spine2':'Chest','Bip01 Neck':'Neck','Bip01 Head':'Head'}
for side in ['L','R']:
 for target,old in [('Clavicle','Shoulder'),('UpperArm','UpperArm'),('Forearm','LowerArm'),('Hand','Wrist'),('Thigh','UpperLeg'),('Calf','LowerLeg'),('Foot','Foot')]:map['Bip01 '+side+' '+target]=old+'.'+side
 for f,old in [(0,'Thumb'),(1,'Index'),(2,'Middle'),(3,'Ring'),(4,'Pinky')]:
  for i,suffix in [(1,''),(2,'1'),(3,'2')]:map[f'Bip01 {side} Finger{f}{suffix}']=f'{old}{i}.{side}'
sRest={n:(source.matrix_world@source.pose.bones[n].matrix).copy() for n in set(map.values())}
tRest={n:(rig.matrix_world@rig.pose.bones[n].matrix).copy() for n in map}
rigInv=rig.matrix_world.inverted();bpy.context.scene.render.fps=30
sourceHeight=abs(sRest['Head'].translation.z-sRest['Hips'].translation.z);targetHeight=abs(tRest['Bip01 Head'].translation.z-tRest['Bip01 Pelvis'].translation.z);ratio=targetHeight/max(.01,sourceHeight)
print('RETARGET HEIGHTS',sourceHeight,targetHeight,ratio,flush=True)
for label in ['Death','HitRecieve','Idle_Gun_Pointing','Interact']:
 old=bpy.data.actions.get('CharacterArmature|'+label);source.animation_data.action=old;source.animation_data.action_slot=old.slots[0]
 action=bpy.data.actions.new('Crossline|'+label);rig.animation_data.action=action
 for frame in range(int(old.frame_range[0]),int(old.frame_range[1])+1):
  bpy.context.scene.frame_set(frame)
  for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
  bpy.context.view_layer.update()
  for pb in rig.pose.bones:
   if pb.name not in map:continue
   src=map[pb.name];posed=source.matrix_world@source.pose.bones[src].matrix
   rotation=posed.to_quaternion()@sRest[src].to_quaternion().inverted()@tRest[pb.name].to_quaternion()
   desired=rigInv@(Matrix.Translation(tRest[pb.name].translation)@rotation.to_matrix().to_4x4())
   local=rig.convert_space(pose_bone=pb,matrix=desired,from_space='POSE',to_space='LOCAL')
   pb.rotation_mode='QUATERNION';pb.rotation_quaternion=local.to_quaternion();pb.location=(0,0,0)
   if pb.name=='Bip01 Pelvis':
    delta=(posed.translation-sRest[src].translation)*ratio
    pb.location=rig.data.bones[pb.name].matrix_local.to_3x3().inverted()@(rigInv.to_3x3()@delta)
   pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
   bpy.context.view_layer.update()
 actions.append(action)
for o in new:bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data.action=None
for a in actions:
 track=rig.animation_data.nla_tracks.new();track.name=a.name;strip=track.strips.new(a.name,0,a);strip.action_slot=a.slots[0]
# Use the first native idle frame as a safe rest display; export tracks separately.
for track in rig.animation_data.nla_tracks:track.mute=False
for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_image_format='JPEG',export_jpeg_quality=90)
print('EXPORTED',out,flush=True)
