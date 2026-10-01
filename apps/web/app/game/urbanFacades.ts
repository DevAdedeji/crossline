import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { TrainingAssets } from './trainingAssets'
import { TRAINING_WORLD, type WorldGeometry } from '@crossline/shared'

/** Selected CC0 Poly Haven modules; visual skins never close authoritative door openings. */
export function addFacades(scene: Scene, assets: TrainingAssets, shadows: ShadowGenerator, world: WorldGeometry = TRAINING_WORLD) {
  let serial = 0
  function module(
    kit: 'apartment' | 'factory',
    part: 'panel' | 'blank' | 'trim',
    x: number,
    y: number,
    z: number,
    yaw: number,
    width = 3,
    height = 3,
  ) {
    const root = new TransformNode(`facade-${serial++}`, scene)
    root.position.set(x, y, z)
    root.rotation.y = yaw
    root.scaling.set(width / 3, height / 3, 1)
    const instance = assets[kit].instantiateModelsToScene((n) => `${root.name}:${n}`, false)
    for (const node of instance.rootNodes) node.parent = root
    for (const node of root.getDescendants()) {
      if (['panel', 'blank', 'trim'].some((name) => node.name.endsWith(`:${name}`)))
        node.setEnabled(node.name.endsWith(`:${part}`))
    }
    for (const mesh of root.getChildMeshes()) {
      mesh.isPickable = false
      mesh.receiveShadows = true
      if (mesh.material instanceof PBRMaterial) {
        mesh.material.environmentIntensity = 0.5
        mesh.material.backFaceCulling = false
      }
      if (mesh.isEnabled() && Math.abs(z) < 30) shadows.addShadowCaster(mesh)
      mesh.freezeWorldMatrix()
    }
  }
  for (const building of world.buildings) {
    const kit = building.material === 'brick' || building.material === 'metal' ? 'factory' : 'apartment'
    // Window bays flank the central openings. Source front faces -Z after glTF conversion.
    for (const side of [-1, 1]) {
      for (const offset of [-4.5, -1.5, 1.5, 4.5]) {
        const doorway =
          building.doors.includes(side > 0 ? 'north' : 'south') && Math.abs(offset) < 2
        if (!doorway)
          module(
            kit,
            'panel',
            building.x + offset,
            0.12,
            building.z + side * (building.depth / 2 + 0.25),
            side > 0 ? Math.PI : 0,
            3,
            3.45,
          )
      }
      for (const offset of [-3.6, 3.6])
        module(
          kit,
          'panel',
          building.x + side * (building.width / 2 + 0.25),
          0.12,
          building.z + offset,
          side > 0 ? -Math.PI / 2 : Math.PI / 2,
          2.7,
          3.45,
        )
      for (const offset of [-4.5, -1.5, 1.5, 4.5])
        module(
          kit,
          'trim',
          building.x + offset,
          3.67,
          building.z + side * (building.depth / 2 + 0.27),
          side > 0 ? Math.PI : 0,
        )
    }
  }
  // Two coherent street elevations outside the arena provide depth without changing walkable area.
  for (const side of [-1, 1]) {
    for (let bay = -12; bay <= 12; bay += 3) {
      for (let floor = 0; floor < 4; floor++)
        module(
          side > 0 ? 'factory' : 'apartment',
          'panel',
          bay,
          floor * 3,
          side * (world.limit + 8.8),
          side > 0 ? Math.PI : 0,
        )
      module(
        side > 0 ? 'factory' : 'apartment',
        'trim',
        bay,
        12,
        side * (world.limit + 8.8),
        side > 0 ? Math.PI : 0,
      )
    }
  }
}
