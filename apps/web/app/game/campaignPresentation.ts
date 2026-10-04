import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { TrainingAssets } from './trainingAssets'
import { CAMPAIGN_OBJECTIVES, EXTRACTION_MISSION, type CampaignState } from '@crossline/shared/campaign'

export function campaignPresentation(scene: Scene, assets: TrainingAssets, shadows: ShadowGenerator) {
  const root = new TransformNode('Finch', scene)
  const instance = assets.soldier.instantiateModelsToScene(name => `finch-${name}`, true, { doNotInstantiate: true })
  for (const node of instance.rootNodes) { node.parent = root; (node as TransformNode).scaling.scaleInPlace(.962) }
  for (const mesh of root.getChildMeshes()) {
    mesh.receiveShadows = true; mesh.isPickable = false; shadows.addShadowCaster(mesh)
    if (mesh.material instanceof PBRMaterial && /body|equipment|helmet/.test(mesh.material.name)) {
      mesh.material.albedoColor = Color3.FromHexString(mesh.material.name.includes('body') ? '#c4a16c' : '#6b8d88')
    }
  }
  root.position.set(EXTRACTION_MISSION.captive.x, 0, EXTRACTION_MISSION.captive.z)
  let animation = '', last = root.position.clone(), state: CampaignState | undefined
  const signal = new StandardMaterial('objective amber', scene)
  signal.emissiveColor = Color3.FromHexString('#ffc171'); signal.disableLighting = true
  const ring = MeshBuilder.CreateTorus('mission objective', { diameter: EXTRACTION_MISSION.interactionRadius * 2, thickness: .045, tessellation: 40 }, scene)
  ring.material = signal; ring.isPickable = false
  const beacon = MeshBuilder.CreatePolyhedron('objective beacon', { type: 1, size: .2 }, scene)
  beacon.material = signal; beacon.isPickable = false
  const friend = new StandardMaterial('friendly marker', scene)
  friend.emissiveColor = Color3.FromHexString('#92e6ce'); friend.disableLighting = true
  const marker = MeshBuilder.CreateTorus('Finch friendly marker', { diameter: .35, thickness: .045, tessellation: 20 }, scene)
  marker.material = friend; marker.parent = root; marker.position.y = 2.25; marker.isPickable = false
  scene.onBeforeRenderObservable.add(() => {
    if (!state) return
    const dt = Math.min(scene.getEngine().getDeltaTime(), 50) / 1000
    const target = new Vector3(state.captive.x, state.captive.y, state.captive.z)
    if (Vector3.Distance(root.position, target) > 3) root.position.copyFrom(target)
    else Vector3.LerpToRef(root.position, target, 1 - Math.exp(-14 * dt), root.position)
    root.rotation.y = state.captive.yaw
    const next = Vector3.Distance(last, root.position) > .002 ? 'Walk' : 'Idle_Neutral'
    if (next !== animation) { instance.animationGroups.forEach(group => group.stop()); instance.animationGroups.find(group => group.name.endsWith(`|${next}`))?.start(true, next === 'Walk' ? .8 : 1); animation = next }
    last.copyFrom(root.position)
    const objective = CAMPAIGN_OBJECTIVES[state.stage].position
    const scale = state.stage === 'extract' ? EXTRACTION_MISSION.extractionRadius / EXTRACTION_MISSION.interactionRadius : 1
    ring.scaling.set(scale, 1, scale)
    ring.position.set(objective.x, objective.y + .045, objective.z)
    beacon.position.set(objective.x, objective.y + 2.4, objective.z); beacon.rotation.y += dt
  })
  return { sync(value: CampaignState) { state = value; ring.setEnabled(value.outcome === 'active'); beacon.setEnabled(value.outcome === 'active') } }
}
