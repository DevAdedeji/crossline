import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

type Model = {bufferViews:Array<{byteOffset?:number;byteLength:number}>;images:Array<{bufferView:number;mimeType:string}>;[key:string]:unknown}
function model(name:string){
 const bytes=readFileSync(`apps/web/public/models/${name}.glb`),length=bytes.readUInt32LE(12)
 assert.equal(bytes.readUInt32LE(8),bytes.length)
 const json=JSON.parse(bytes.subarray(20,20+length).toString()) as Model,binary=bytes.subarray(28+length)
 return {json,view:(index:number)=>{const view=json.bufferViews[index]!;assert.equal((view.byteOffset??0)%4,0);return binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength)}}
}
function imageSize(bytes:Buffer){
 if(bytes.toString('ascii',1,4)==='PNG')return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)]
 for(let offset=2;offset<bytes.length-8;){
  assert.equal(bytes[offset],255)
  const marker=bytes[offset+1];offset+=2
  if([0xc0,0xc1,0xc2].includes(marker!))return [bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3)]
  offset+=bytes.readUInt16BE(offset)
 }
 throw new Error('Image dimensions not found')
}
for(const name of ['rocketbox-soldier','polyhaven-apartment','polyhaven-factory','polyhaven-street-tree','polyhaven-street-bench']){
 test(`${name} mobile maps use quarter-size texture storage with identical geometry and animations`,()=>{
  const original=model(name),mobile=model(name+'-mobile')
  for(const key of Object.keys(original.json).filter(key=>!['buffers','bufferViews'].includes(key)))assert.deepEqual(mobile.json[key],original.json[key],key)
  const images=new Set(original.json.images.map(image=>image.bufferView))
  assert.equal(mobile.json.bufferViews.length,original.json.bufferViews.length)
  for(let index=0;index<original.json.bufferViews.length;index++){
   if(!images.has(index)){assert.deepEqual(mobile.view(index),original.view(index));continue}
   const [w,h]=imageSize(mobile.view(index)),[ow,oh]=imageSize(original.view(index))
   assert.ok(w!<=512&&h!<=512)
   assert.ok(w!*h!<=ow!*oh!/4)
  }
 })
}
