import { grenadePosition, GRENADE_RADIUS } from '@crossline/shared/campaignGrenades'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { TrainingAssets } from './trainingAssets'
import { activeCampaignTask, type CampaignMission, type CampaignState } from '@crossline/shared/campaign'

export function campaignPresentation(scene: Scene, assets: TrainingAssets, shadows: ShadowGenerator, mission: CampaignMission) {
  const root = new TransformNode(mission.companion || 'charge marker', scene)
  root.setEnabled(Boolean(mission.companion))
  const instance = assets.soldier.instantiateModelsToScene(name => `finch-${name}`, true, { doNotInstantiate: true })
  for (const node of instance.rootNodes) { node.parent = root; (node as TransformNode).scaling.scaleInPlace(.962) }
  for (const mesh of root.getChildMeshes()) {
    mesh.receiveShadows = true; mesh.isPickable = false; shadows.addShadowCaster(mesh)
    if (mesh.material instanceof PBRMaterial && /body|equipment|helmet/.test(mesh.material.name)) {
      mesh.material.albedoColor = Color3.FromHexString(mesh.material.name.includes('body') ? '#c4a16c' : '#6b8d88')
    }
  }
  root.position.set(mission.captive.x, 0, mission.captive.z)
  let animation = '', last = root.position.clone(), state: CampaignState | undefined
  const signal = new StandardMaterial('objective amber', scene)
  signal.emissiveColor = Color3.FromHexString('#ffc171'); signal.disableLighting = true
  const ring = MeshBuilder.CreateTorus('mission objective', { diameter: mission.interactionRadius * 2, thickness: .045, tessellation: 40 }, scene)
  ring.material = signal; ring.isPickable = false
  const beacon = MeshBuilder.CreatePolyhedron('objective beacon', { type: 1, size: .2 }, scene)
  beacon.material = signal; beacon.isPickable = false
  const charge = MeshBuilder.CreateBox('demolition charge', {width:.5,height:.3,depth:.35}, scene)
  charge.position.set(mission.captive.x,.15,mission.captive.z); charge.material=signal
  charge.setEnabled(mission.kind === 'sabotage'); charge.isPickable=false
  const blasts=Array.from({length:3},(_,i)=>{
    const mesh=MeshBuilder.CreateSphere(`mission blast ${i}`,{diameter:1,segments:8},scene)
    const material=new StandardMaterial(`mission fire ${i}`,scene)
    material.emissiveColor=Color3.FromHexString('#ff983d');material.disableLighting=true
    mesh.material=material;mesh.setEnabled(false);mesh.isPickable=false
    return {mesh,material,time:2}
  })
  let nextBlast=0
  const danger=new StandardMaterial('grenade warning',scene);danger.emissiveColor=Color3.FromHexString('#ff765d');danger.disableLighting=true
  const grenadeMesh=MeshBuilder.CreateSphere('enemy grenade',{diameter:.22,segments:8},scene);grenadeMesh.material=danger;grenadeMesh.setEnabled(false)
  const dangerRing=MeshBuilder.CreateTorus('grenade blast radius',{diameter:GRENADE_RADIUS*2,thickness:.045,tessellation:40},scene);dangerRing.material=danger;dangerRing.setEnabled(false)
  grenadeMesh.isPickable=false;dangerRing.isPickable=false
  const friend = new StandardMaterial('friendly marker', scene)
  friend.emissiveColor = Color3.FromHexString('#92e6ce'); friend.disableLighting = true
  const marker = MeshBuilder.CreateTorus('Finch friendly marker', { diameter: .35, thickness: .045, tessellation: 20 }, scene)
  marker.material = friend; marker.parent = root; marker.position.y = 2.25; marker.isPickable = false
  scene.onBeforeRenderObservable.add(() => {
    if (!state) return
    const grenade=state.grenades[0]
    grenadeMesh.setEnabled(Boolean(grenade));dangerRing.setEnabled(Boolean(grenade && grenade.remainingMs > 0))
    if(grenade){grenadeMesh.scaling.setAll(grenade.remainingMs > 0 ? 1 : 1 + Math.abs(grenade.remainingMs) / 12); const position=grenadePosition(grenade);grenadeMesh.position.set(position.x,position.y,position.z);dangerRing.position.set(grenade.target.x,grenade.target.y+.05,grenade.target.z)}
    const dt = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000
    for(const blast of blasts)if(blast.time<1.2){
      blast.time+=dt;blast.mesh.setEnabled(blast.time<1.2)
      blast.mesh.scaling.setAll(1+blast.time*7);blast.material.alpha=Math.max(0,1-blast.time/1.2)
    }
    charge.setEnabled(!mission.tasks && mission.kind === 'sabotage' && state.outcome !== 'success')
    const target = new Vector3(state.captive.x, state.captive.y, state.captive.z)
    if (Vector3.Distance(root.position, target) > 3) root.position.copyFrom(target)
    else Vector3.LerpToRef(root.position, target, 1 - Math.exp(-14 * dt), root.position)
    root.rotation.y = state.captive.yaw
    const next = Vector3.Distance(last, root.position) > .002 ? 'Walk' : 'Idle_Neutral'
    if (next !== animation) { instance.animationGroups.forEach(group => group.stop()); instance.animationGroups.find(group => group.name.endsWith(`|${next}`))?.start(true, next === 'Walk' ? .8 : 1); animation = next }
    last.copyFrom(root.position)
    const task=activeCampaignTask(state),objective=task.position
    const scale=task.radius / mission.interactionRadius
    ring.scaling.set(scale, 1, scale)
    ring.position.set(objective.x, objective.y + .045, objective.z)
    beacon.position.set(objective.x, objective.y + 2.4, objective.z); beacon.rotation.y += dt
  })
  return { explosion(position: {x:number;y:number;z:number}) {
    const blast=blasts[nextBlast++%blasts.length]!
    blast.time=0;blast.material.alpha=1;blast.mesh.scaling.setAll(1)
    blast.mesh.position.set(position.x,position.y+1,position.z);blast.mesh.setEnabled(true)
  }, sync(value: CampaignState) { state = value; ring.setEnabled(value.outcome === 'active'); beacon.setEnabled(value.outcome === 'active') } }
}
