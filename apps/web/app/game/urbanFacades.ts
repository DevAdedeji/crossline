import { BUILDING_FINISHES, buildingFinishIndex } from './buildingFinishes'
import { surfaceTexture } from './surfaceTexture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import type { Scene } from '@babylonjs/core/scene'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { TrainingAssets } from './trainingAssets'
import { TRAINING_WORLD, type WorldGeometry } from '@crossline/shared'

/** Selected CC0 Poly Haven modules; visual skins never close authoritative door openings. */
export function addFacades(scene: Scene, assets: TrainingAssets, _shadows: ShadowGenerator, world: WorldGeometry = TRAINING_WORLD) {
  // One shared geometry buffer per source mesh, spatial tile and material. Avoid
  // instantiating the entire module kit (including disabled parts) for every window.
  const batches = new Map<string, {source: Mesh; matrices: number[]; tone: number}>()
  let tone = 0
  function module(kit: 'apartment' | 'factory', part: 'panel' | 'blank' | 'trim',
    x: number, y: number, z: number, yaw: number, width = 3, height = 3) {
    const placement = Matrix.Compose(new Vector3(width / 3, height / 3, 1), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z))
    for (const source of assets[kit].meshes) {
      if (!(source instanceof Mesh) || !source.getTotalVertices()) continue
      let node = source.parent
      while (node && node.name !== part) node = node.parent
      if (!node) continue
      const key = `${kit}/${part}/${source.uniqueId}/${tone}/${Math.floor(x / 32)}/${Math.floor(z / 32)}`
      const batch = batches.get(key) ?? {source, matrices: [], tone}
      batch.matrices.push(...source.computeWorldMatrix(true).multiply(placement).asArray())
      batches.set(key, batch)
    }
  }
  for (const building of world.buildings) {
    tone = buildingFinishIndex(building.id)
    if(world.environment==='airfield') continue
    if (world.legacyRamp === false && (building.id.startsWith('port-') || world.environment)) {
      const height=building.height??3.8,kit=building.material==='metal'||building.material==='brick'?'factory':'apartment'
      for(const face of ['north','south','east','west'] as const){
        const horizontal=face==='north'||face==='south',side=face==='north'||face==='east'?1:-1,length=horizontal?building.width:building.depth
        for(let offset=-length/2+1.6;offset<length/2-1;offset+=3){
          if(building.doors.includes(face)&&Math.abs(offset)<(building.doorWidth??3)/2+1.5)continue
          for(let y=world.environment==='industrial'?4.8:.12;y+2.7<height;y+=3.4)module(kit,'panel',building.x+(horizontal?offset:side*(building.width/2+.25)),y,building.z+(horizontal?side*(building.depth/2+.25):offset),horizontal?(side>0?Math.PI:0):(side>0?-Math.PI/2:Math.PI/2),2.85,Math.min(3.15,height-y-.25))
          module(kit,'trim',building.x+(horizontal?offset:side*(building.width/2+.27)),height-.15,building.z+(horizontal?side*(building.depth/2+.27):offset),horizontal?(side>0?Math.PI:0):(side>0?-Math.PI/2:Math.PI/2))
        }
      }
      continue
    }
    if(building.id.startsWith('city-')) {
      const kit = building.material === 'brick' ? 'factory' : 'apartment'
      const floors = Math.round((building.height ?? 3.2) / 3.2)
      for (let floor = 0; floor < floors; floor++) for (const side of [-1, 1]) {
        for (const offset of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5]) {
          // Both ground-level through doors stay completely open.
          if (floor === 0 && Math.abs(offset) < 3) continue
          module(kit, 'panel', building.x + offset, floor * 3.2 + .12,
            building.z + side * (building.depth / 2 + .25), side > 0 ? Math.PI : 0, 2.95, 2.95)
        }
        for (const offset of [-6, -3, 0, 3, 6])
          module(kit, 'panel', building.x + side * (building.width / 2 + .25), floor * 3.2 + .12,
            building.z + offset, side > 0 ? -Math.PI / 2 : Math.PI / 2, 2.95, 2.95)
      }
      for (const side of [-1, 1]) for (const offset of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5])
        module(kit, 'trim', building.x + offset, floors * 3.2 + .05,
          building.z + side * (building.depth / 2 + .27), side > 0 ? Math.PI : 0)
      continue
    }
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
  tone = 0
  if (world.legacyRamp !== false) for (const side of [-1, 1]) {
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
  const surfaces = new Map<string, PBRMaterial>()
  const paintedPlaster = surfaceTexture('plaster', scene)
  for (const [key, {source, matrices, tone}] of batches) {
    const mesh = source.clone(`facade-batch:${key}`, null, true)!
    mesh.parent = null; mesh.position.setAll(0); mesh.scaling.setAll(1)
    mesh.rotationQuaternion = Quaternion.Identity(); mesh.rotation.setAll(0)
    mesh.setEnabled(true); mesh.isVisible = true; mesh.isPickable = false
    mesh.receiveShadows = true
    if (mesh.material instanceof PBRMaterial) {
      const sourceMaterial = mesh.material
      const surfaceKey = `${sourceMaterial.uniqueId}/${tone}`
      let surface = surfaces.get(surfaceKey)
      if (!surface) {
        surface = sourceMaterial.clone(`facade finish:${surfaceKey}`)!
        surface.environmentIntensity = .7
        surface.backFaceCulling = false
        if (sourceMaterial.name.includes('glass')) {
          surface.roughness = .18
          surface.metallic = .18
        } else {
          const finish = BUILDING_FINISHES[tone]!
          const masonry = /plaster|brick/.test(sourceMaterial.name)
          if (masonry && !(sourceMaterial.name.includes('brick') && finish.brick)) {
            // Tinting the original brown albedo only makes darker brown. Painted
            // masonry needs a neutral albedo; retain the asset's relief and wear.
            surface.albedoTexture = paintedPlaster
            surface.albedoColor = Color3.FromHexString(finish.wall)
            surface.roughness = .9
          } else if (sourceMaterial.name.includes('trim')) {
            surface.albedoColor = Color3.FromHexString(finish.trim)
          }
        }
        surfaces.set(surfaceKey, surface)
      }
      mesh.material = surface
    }
    // Babylon stores instance vertex buffers on Geometry; tiles need independent
    // buffer bindings even though all copies within a tile share one mesh.
    mesh.makeGeometryUnique()
    mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, true)
    mesh.freezeWorldMatrix()
    // The shared solid walls already cast their silhouettes. Detailed window
    // trims receive shadows, without another city-wide shadow geometry pass.
  }

}
