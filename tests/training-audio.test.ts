import {test} from 'node:test'
import assert from 'node:assert/strict'
import {trainingAudio} from '../apps/web/app/game/trainingAudio.ts'

test('zero-rate WebKit output uses decoded audio rate, and cleanup is idempotent',async t=>{
 const allocations:Array<{length:number;rate:number}>=[]
 let closed=0
 const node=()=>({connect(){},gain:{value:0},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}})
 const context={sampleRate:0,createGain:node,createDynamicsCompressor:node,destination:{},
  async decodeAudioData(){return {sampleRate:44100}},
  createBuffer(_channels:number,length:number,rate:number){assert.ok(length>0);assert.ok(rate>=8000);allocations.push({length,rate});return {getChannelData:()=>new Float32Array(length)}},
  async close(){closed++},
 } as unknown as AudioContext
 t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(1)))
 const audio=trainingAudio(context)
 await audio.prepare()
 assert.deepEqual(allocations,[{length:9702,rate:44100},{length:35280,rate:44100}])
 audio.dispose();audio.dispose()
 assert.equal(closed,1)
})

test('leaving during audio loading does not allocate effects after disposal',async t=>{
 let finish!:()=>void,allocations=0
 const pending=new Promise<void>(resolve=>finish=resolve)
 const node=()=>({connect(){},gain:{value:0},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}})
 const context={sampleRate:48000,createGain:node,createDynamicsCompressor:node,destination:{},
  async decodeAudioData(){await pending;return {sampleRate:48000}},
  createBuffer(){allocations++},async close(){},
 } as unknown as AudioContext
 t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array(1)))
 const audio=trainingAudio(context),preparing=audio.prepare()
 audio.dispose();finish();await preparing
 assert.equal(allocations,0)
})
