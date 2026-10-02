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
    if(building.id==='ironworks') {
      for(const side of [-1,1]) {
        for(let offset=-15;offset<=15;offset+=3)for(const y of [.1,4.55]) {
          if(y<1 && Math.abs(offset)<(side<0?4.5:3.5))continue
          module('factory','panel',offset,y,48+side*13.25,side>0?Math.PI:0,2.8,y<1?3.8:3)
        }
        for(let offset=-10.5;offset<=10.5;offset+=3)for(const y of [.1,4.55]) {
          if(y<1&&Math.abs(offset)<3.5)continue
          module('factory','panel',side*17.25,y,48+offset,side>0?-Math.PI/2:Math.PI/2,2.8,y<1?3.8:3)
        }
      }
      continue
    }
    if(building.id==='foundry-tower') {
      for(let floor=0;floor<4;floor++)for(const side of [-1,1]) {
        for(const offset of [-5.25,-1.75,1.75,5.25]) {
          if(floor===0&&side<0&&Math.abs(offset)<3)continue
          module('apartment','panel',48+offset,floor*3.2+.1,48+side*8.25,side>0?Math.PI:0,3.2,2.75)
        }
        for(const offset of [-6,-3,0,3,6]) {
          if(side>0&&Math.abs(offset-(floor%2===0?-6.5:6))<2)continue
          module('apartment','panel',48+side*7.25,floor*3.2+.1,48+offset,side>0?-Math.PI/2:Math.PI/2,2.7,2.75)
        }
      }
      continue
    }
    if(building.id==='mercer-hospital') {
      for(let floor=0;floor<3;floor++)for(const side of [-1,1]) {
        for(const offset of [-12,-8,-4,0,4,8,12]) {
          if(floor===0 && Math.abs(offset)<4)continue
          module('apartment','panel',-48+offset,floor*3.2+.1,-48+side*13.25,side>0?Math.PI:0,3.6,2.7)
        }
        for(const offset of [-10,-6,-2,2,6,10]) {
          if(side>0 && Math.abs(offset-(floor%2===0?-11:11))<3)continue
          module('apartment','panel',-48+side*15.25,floor*3.2+.1,-48+offset,side>0?-Math.PI/2:Math.PI/2,3.5,2.7)
        }
      }
      continue
    }
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
