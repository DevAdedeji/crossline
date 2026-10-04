import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Scene } from '@babylonjs/core/scene'
import type { WorldGeometry } from '@crossline/shared'

/** Distant scenery lives outside the playable boundary; cover stays in shared geometry. */
export function campaignEnvironment(scene: Scene, world: WorldGeometry) {
  if (!['freight-port','hill-village'].includes(world.id)) return
  const mat = (name:string,color:string) => { const m=new PBRMaterial(name,scene);m.albedoColor=Color3.FromHexString(color);m.roughness=.95;m.metallic=0;return m }
  if (world.id === 'freight-port') {
    const water=MeshBuilder.CreateGround('open harbour water',{width:600,height:260,subdivisions:1},scene)
    water.position.set(0,-.35,230);water.material=mat('harbour blue','#356d7a');water.isPickable=false;water.freezeWorldMatrix()
    const ship=mat('distant freighter','#374b54'), containers=mat('distant cargo','#98754f')
    for(const x of [-100,80]) {
      const hull=MeshBuilder.CreateBox('freighter hull',{width:65,height:7,depth:16},scene);hull.position.set(x,2,170);hull.material=ship;hull.freezeWorldMatrix()
      for(let i=-2;i<=2;i++){const cargo=MeshBuilder.CreateBox('freighter cargo',{width:9,height:6,depth:11},scene);cargo.position.set(x+i*11,8,170);cargo.material=containers;cargo.freezeWorldMatrix()}
    }
  } else {
    const mountain=mat('ridge stone','#697361'), roof=mat('village clay roofs','#9e684d')
    mountain.albedoTexture=new Texture('/textures/concrete-color.jpg',scene)
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI/6, height=35+(i%4)*12
      const hill=MeshBuilder.CreateGround('distant ridge',{width:140,height:140,subdivisions:18,updatable:true},scene)
      const positions=hill.getVerticesData(VertexBuffer.PositionKind)!,normals=hill.getVerticesData(VertexBuffer.NormalKind)!
      for(let n=0;n<positions.length;n+=3){const x=positions[n]!,z=positions[n+2]!,radius=Math.min(1,Math.hypot(x/70,z/70));positions[n+1]=Math.pow(1-radius,1.25)*height*(.9+.13*Math.sin(x*.17+i)+.08*Math.cos(z*.23))}
      VertexData.ComputeNormals(positions,hill.getIndices()!,normals);hill.updateVerticesData(VertexBuffer.PositionKind,positions);hill.updateVerticesData(VertexBuffer.NormalKind,normals)
      hill.refreshBoundingInfo();hill.position.set(Math.sin(angle)*155,-1,Math.cos(angle)*155);hill.rotation.y=angle;hill.material=mountain;hill.freezeWorldMatrix()
    }
    for(const b of world.buildings) {
      const tile=MeshBuilder.CreateCylinder('pitched village roof',{diameterTop:b.width+1,diameterBottom:b.width+1,height:b.depth+1,tessellation:3},scene)
      tile.rotation.x=Math.PI/2;tile.rotation.y=Math.PI;tile.scaling.z=.24
      tile.position.set(b.x,4.2,b.z);tile.material=roof;tile.isPickable=false;tile.freezeWorldMatrix()
    }
  }
  for(const mesh of scene.meshes) if(mesh.name.startsWith('distant')||mesh.name.startsWith('freighter')) {mesh.isPickable=false;mesh.doNotSyncBoundingInfo=true}
  // Merge the distant cargo boxes to keep the phone draw budget modest.
  const cargo=scene.meshes.filter(m=>m.name==='freighter cargo') as Mesh[]
  if(cargo.length) Mesh.MergeMeshes(cargo,true,true)
}
