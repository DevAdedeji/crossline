import {test} from 'node:test'
import assert from 'node:assert/strict'
import {NullEngine} from '@babylonjs/core/Engines/nullEngine'
import {Scene} from '@babylonjs/core/scene'
import {Mesh} from '@babylonjs/core/Meshes/mesh'
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder'
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData'
import {StaticGeometry} from '../apps/web/app/game/staticGeometry.ts'

test('CPU batching preserves transformed geometry, UVs and winding without temporary GPU geometry',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),batch=new StaticGeometry(scene)
 try{
  const expected:Mesh[]=[],pending:Mesh[]=[]
  for(let i=0;i<3;i++){
   const original=MeshBuilder.CreateBox('original',{width:2+i,height:3,depth:4},scene)
   const deferred=batch.create('deferred',VertexData.CreateBox({width:2+i,height:3,depth:4}))
   for(const mesh of [original,deferred]){mesh.position.set(i*3,2,-5);mesh.rotation.set(.1*i,.4*i,.2);mesh.scaling.set(i===2?-1:1,2,.5)}
   assert.equal(deferred.geometry,null)
   expected.push(original);pending.push(deferred)
  }
  const original=Mesh.MergeMeshes(expected,true,true)!,merged=batch.merge(pending)!
  for(const kind of ['position','normal','uv']){
   const a=original.getVerticesData(kind)!,b=merged.getVerticesData(kind)!
   assert.equal(a.length,b.length)
   for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]!-b[i]!)<.00001,`${kind} ${i}`)
  }
  assert.deepEqual(Array.from(merged.getIndices()!),Array.from(original.getIndices()!))
  assert.ok(pending.every(mesh=>mesh.isDisposed()))
 }finally{engine.dispose()}
})
