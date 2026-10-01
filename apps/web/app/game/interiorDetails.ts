import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { BUILDINGS } from '@crossline/shared'

/** Small decorative fittings stay within existing counters/shelves or against solid walls. */
export function interiorDetails(scene: Scene, shadows: ShadowGenerator) {
  const groups = new Map<PBRMaterial, Mesh[]>()
  function surface(name: string, color: string, metallic = 0, roughness = .65) {
    const material = new PBRMaterial(name, scene)
    material.albedoColor = Color3.FromHexString(color)
    material.metallic = metallic; material.roughness = roughness
    groups.set(material, [])
    return material
  }
  const enamel = surface('interior enamel', '#a9aca5', .15, .42)
  const steel = surface('brushed fittings', '#454c51', .75, .3)
  const paper = surface('stock cartons', '#8b7659')
  const ceramic = surface('cafe ceramics', '#d6d0bb', 0, .25)
  const light = surface('warm ceiling diffuser', '#ece7d3')
  light.emissiveColor = Color3.FromHexString('#d5b679').scale(.8)
  function box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: PBRMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width:w, height:h, depth:d }, scene)
    mesh.position.set(x,y,z); mesh.material = material; groups.get(material)!.push(mesh)
  }
  for (const b of BUILDINGS) {
    for (const z of [b.z-2.5,b.z+2.5]) {
      box('ceiling fixture',b.x,3.72,z,2.3,.1,.5,steel)
      box('ceiling diffuser',b.x,3.65,z,2.1,.04,.38,light)
    }
    box('back wall skirting',b.x, .14,b.z-b.depth/2+.24,b.width-.5,.24,.07,steel)
    box('wall service panel',b.x-b.width/2+.24,1.5,b.z-.8,.07,.7,.5,enamel)
  }
  // Cafe: polished counter top, espresso unit, cups and drawer fronts.
  box('cafe worktop',-15,1.115,9,3.08,.035,.94,steel)
  box('espresso machine',-15.8,1.33,9,.65,.4,.5,steel)
  box('espresso front',-15.8,1.34,8.745,.54,.25,.025,enamel)
  for(const x of [-15.9,-15.68,-14.8]) {
    const cup=MeshBuilder.CreateCylinder('cup',{diameter:.11,height:.13,tessellation:16},scene)
    cup.position.set(x,1.2,8.7);cup.material=ceramic;groups.get(ceramic)!.push(cup)
  }
  for(const x of [-15.7,-14.9,-14.1]) {
    box('counter drawer',x,.72,8.535,.73,.42,.025,enamel)
    box('drawer pull',x,.82,8.505,.23,.025,.025,steel)
  }
  // Garage bench and supply stock remain inside their shared collision bounds.
  box('bench top',16,1.12,15,3.25,.04,1.03,steel)
  for(const x of [15,16,17])box('tool drawer',x,.7,14.48,.85,.4,.025,enamel)
  for(const y of [.35,.95,1.55])for(const x of [-18.2,-17.4,-16.6]) {
    box('stock carton',x,y,-15.5,.55,.48,.56,paper)
    box('stock label',x,y,-15.79,.2,.14,.008,ceramic)
  }
  for(const [material,meshes] of groups) {
    if(!meshes.length)continue
    const mesh=Mesh.MergeMeshes(meshes,true,true)!
    mesh.receiveShadows=true;mesh.freezeWorldMatrix();shadows.addShadowCaster(mesh)
    material.freeze()
  }
}
