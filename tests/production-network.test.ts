import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { once } from 'node:events'
import { signProxy } from '../packages/shared/src/proxy.ts'
import { requestGuard,guestBudget } from '../apps/match/src/admission.ts'
import { TrainingRoom } from '../apps/match/src/TrainingRoom.ts'
const require=createRequire(new URL('../apps/match/package.json',import.meta.url))
const {defineServer,defineRoom,createRouter,createEndpoint,matchMaker}=await import(pathToFileURL(require.resolve('@colyseus/core')).href)
const {WebSocketTransport}=await import(pathToFileURL(require.resolve('@colyseus/ws-transport')).href)
const NodeWebSocket=createRequire(require.resolve('@colyseus/ws-transport'))('ws')
const secret='synthetic-production-network-test-secret-only',origin='https://crossline.example'
async function until(check:()=>boolean,timeout=3000){const end=Date.now()+timeout;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,20))}throw new Error('Condition timed out')}
test('signed matchmaking reaches real Colyseus, enforces guest budgets and origin checks, and releases rooms',async()=>{
 // Node's built-in browser WebSocket cannot set Origin; use the SDK's supported Node transport.
 globalThis.WebSocket=NodeWebSocket
 const {Client}=await import('@colyseus/sdk')
 matchMaker.controller.getCorsHeaders=()=>({'Access-Control-Allow-Origin':origin,'Vary':'Origin'})
 const transport=new WebSocketTransport({maxPayload:1024,verifyClient:(info:{origin:string})=>info.origin===origin})
 const server=defineServer({rooms:{training:defineRoom(TrainingRoom)},routes:createRouter({health:createEndpoint('/health',{method:'GET'},()=>({ok:true}))},{onRequest:requestGuard({production:true,origin},secret)}),transport,gracefullyShutdown:false,greet:false})
 await server.listen(0,'127.0.0.1')
 const port=transport.server.address().port,base=`http://127.0.0.1:${port}`
 const rooms:Awaited<ReturnType<InstanceType<typeof Client>['create']>>[]=[]
 const client=(ip:string)=>new Client(base,{headers:{origin},fetchFn:async(input,options)=>{
  const url=new URL(String(input)),body=String(options?.body??'')
  return fetch(input,{...options,headers:{...Object.fromEntries(new Headers(options?.headers)),origin,...signProxy(secret,options?.method??'GET',url.pathname+url.search,body,ip)}})
 }})
 try{
  const unsigned=await fetch(base+'/matchmake/create/training',{method:'POST',headers:{'content-type':'application/json','x-crossline-client-ip':'203.0.113.1'},body:'{}'})
  assert.equal(unsigned.status,403);assert.equal(guestBudget.size,0)
  const a=client('203.0.113.1'),b=client('203.0.113.2')
  rooms.push(await a.create('training'),await a.create('training'))
  await assert.rejects(()=>a.create('training'),/Close another/)
  await until(()=>guestBudget.size===2)
  rooms.push(await b.create('training'),await b.create('training'))
  assert.equal(guestBudget.size,4)
  await assert.rejects(()=>client('203.0.113.3').create('training'),/busy/)
  await rooms.shift()!.leave();await until(()=>guestBudget.size===3)
  rooms.push(await a.create('training'));assert.equal(guestBudget.size,4)
  const preflight=await fetch(base+'/matchmake/create/training',{method:'OPTIONS',headers:{origin:'https://attacker.example'}})
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin)
  const rejected=new NodeWebSocket(`ws://127.0.0.1:${port}/invalid/invalid`,{origin:'https://attacker.example'})
  rejected.on('error',()=>{})
  const [request,response]=await once(rejected,'unexpected-response');assert.equal(response.statusCode,401);response.resume();request.destroy()
 }finally{
  await Promise.all(rooms.map(room=>room.leave().catch(()=>{})))
  await server.gracefullyShutdown(false)
 }
 assert.equal(guestBudget.size,0)
})
