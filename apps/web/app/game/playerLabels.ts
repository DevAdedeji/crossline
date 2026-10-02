import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'
import { nameVisible,stanceHeight,type WorldGeometry } from '@crossline/shared'
import type { Combatant } from '@crossline/shared/combat'
export function playerLabels(scene:Scene,camera:UniversalCamera,world:WorldGeometry) {
 const labels=new Map<string,{mesh:Mesh;surface:StandardMaterial;texture:DynamicTexture;actor:Combatant}>()
 function sync(actors:Combatant[]) {
  const ids=new Set(actors.map(a=>a.id))
  for(const [id,label] of labels)if(!ids.has(id)){label.mesh.dispose();label.surface.dispose();label.texture.dispose();labels.delete(id)}
  for(const actor of actors){
   let label=labels.get(actor.id)
   if(!label){
    const texture=new DynamicTexture(`name-${actor.id}`,{width:512,height:64},scene,false)
    texture.hasAlpha=true
    texture.drawText(actor.name.slice(0,24),null,44,'bold 30px Arial','#e9eeeb','#101a20b0',true,true)
    const surface=new StandardMaterial(`name-${actor.id}`,scene);surface.diffuseTexture=texture;surface.emissiveColor=Color3.White();surface.disableLighting=true;surface.backFaceCulling=false
    const mesh=MeshBuilder.CreatePlane(`player-name-${actor.id}`,{width:1.8,height:.225},scene);mesh.material=surface;mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false
    label={mesh,surface,texture,actor};labels.set(actor.id,label)
   }
   label.actor={...actor}
  }
 }
 function frame(){for(const {mesh,actor} of labels.values()){
  mesh.setEnabled(nameVisible(camera.position,actor,world))
  mesh.position.set(actor.x,actor.y+stanceHeight(actor)+.25,actor.z)
 }}
 return {sync,frame}
}
