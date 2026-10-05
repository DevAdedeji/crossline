import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'
import type { Camera } from '@babylonjs/core/Cameras/camera'
import { grenadePosition, GRENADE_RADIUS, type CampaignGrenade, type PlayerGrenade } from '@crossline/shared/campaignGrenades'
import type { Position } from '@crossline/shared'

export function grenadePresentation(scene:Scene,camera:Camera){
  const body=new PBRMaterial('grenade olive steel',scene);body.albedoColor=Color3.FromHexString('#42513a');body.metallic=.55;body.roughness=.6
  const metal=new PBRMaterial('grenade lever and pin',scene);metal.albedoColor=Color3.FromHexString('#91958b');metal.metallic=.8;metal.roughness=.4
  const seam=new PBRMaterial('grenade shell grooves',scene);seam.albedoColor=Color3.FromHexString('#20271c');seam.roughness=.9
  const warning=new StandardMaterial('grenade danger ring',scene);warning.emissiveColor=Color3.FromHexString('#ff765d');warning.disableLighting=true
  function model(name:string){
    const root=new TransformNode(name,scene)
    const shell=MeshBuilder.CreateSphere('fragmentation shell',{diameter:.2,segments:12},scene);shell.scaling.y=1.25;shell.material=body;shell.parent=root
    for(const y of [-.065,0,.065]){const groove=MeshBuilder.CreateTorus('shell groove',{diameter:y===0?.199:.17,thickness:.009,tessellation:12},scene);groove.position.y=y;groove.material=seam;groove.parent=root}
    const cap=MeshBuilder.CreateCylinder('grenade fuse cap',{diameter:.08,height:.045,tessellation:10},scene);cap.position.y=.13;cap.material=metal;cap.parent=root
    const lever=MeshBuilder.CreateBox('safety lever',{width:.035,height:.2,depth:.025},scene);lever.position.set(.09,.06,0);lever.rotation.z=.3;lever.material=metal;lever.parent=root
    const pin=MeshBuilder.CreateTorus('pull ring',{diameter:.06,thickness:.009,tessellation:12},scene);pin.rotation.x=Math.PI/2;pin.position.set(-.055,.15,0);pin.material=metal;pin.parent=root
    for(const mesh of root.getChildMeshes())mesh.isPickable=false
    return root
  }
  const pool=new Map<string,{root:TransformNode;ring:ReturnType<typeof MeshBuilder.CreateTorus>}>()
  const held=model('player throwing grenade');held.parent=camera;held.scaling.setAll(.65);held.setEnabled(false)
  const heldMeshes=held.getChildMeshes() as Mesh[]
  const ready=Promise.all([body,metal,seam].map(material=>material.forceCompilationAsync(heldMeshes.find(mesh=>mesh.material===material)!)))
  let throwTime=1
  const blasts=Array.from({length:5},(_,i)=>{const mesh=MeshBuilder.CreateSphere(`grenade blast ${i}`,{diameter:1,segments:8},scene),mat=new StandardMaterial(`blast light ${i}`,scene);mat.emissiveColor=Color3.FromHexString('#ffad64');mat.disableLighting=true;mesh.material=mat;mesh.isPickable=false;mesh.setEnabled(false);return{mesh,mat,time:1}})
  let blastIndex=0
  scene.onBeforeRenderObservable.add(()=>{
    const dt=Math.min(scene.getEngine().getDeltaTime(),50)/1000
    if(throwTime<.35){throwTime+=dt;held.position.set(.28,-.24+throwTime*.25,.8+throwTime*.5);held.rotation.z=-throwTime*2;held.setEnabled(throwTime<.35)}
    for(const b of blasts)if(b.time<.6){b.time+=dt;b.mesh.scaling.setAll(.5+b.time*10);b.mat.alpha=Math.max(0,1-b.time/.6);b.mesh.setEnabled(b.time<.6)}
  })
  return {
    ready,
    thrown(){throwTime=0;held.setEnabled(true)},
    explosion(position:Position){const b=blasts[blastIndex++%blasts.length]!;b.time=0;b.mesh.position.set(position.x,position.y+.2,position.z);b.mesh.setEnabled(true)},
    sync(players:PlayerGrenade[],enemies:CampaignGrenade[],viewer?:Position&{id?:string}){
      const items=[...players.map(g=>({id:g.id,position:g,remaining:g.remainingMs,own:g.sourceId===viewer?.id})),...enemies.filter(g=>g.remainingMs>0).map(g=>({id:`enemy-${g.sourceId}`,position:grenadePosition(g),remaining:g.remainingMs,own:false}))]
      const active=new Set(items.map(g=>g.id))
      for(const [id,item] of pool)if(!active.has(id)){item.root.dispose();item.ring.dispose();pool.delete(id)}
      for(const item of items){
        let view=pool.get(item.id)
        if(!view){const ring=MeshBuilder.CreateTorus('grenade danger radius',{diameter:GRENADE_RADIUS*2,thickness:.035,tessellation:32},scene);ring.material=warning;ring.isPickable=false;view={root:model(item.id),ring};pool.set(item.id,view)}
        const p=item.position;view.root.position.set(p.x,p.y,p.z);view.root.rotation.set(item.remaining*.007,0,item.remaining*.003)
        view.root.setEnabled(!item.own||!viewer||Math.hypot(p.x-viewer.x,p.y-viewer.y-1.5,p.z-viewer.z)>.85)
        view.ring.position.set(p.x,Math.max(.04,p.y-.12),p.z)
        view.ring.setEnabled(Boolean(viewer&&Math.hypot(viewer.x-p.x,viewer.z-p.z)<12&&p.y<viewer.y+1))
      }
    },
  }
}
