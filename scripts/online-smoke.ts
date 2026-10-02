import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { Client, type Room } from '@colyseus/sdk'
import { getNavigation } from '../apps/match/src/training/navigation.js'
import { COMBAT_WORLD } from '../packages/shared/src/index.ts'
import { direction, worldHit, type Combatant, type CombatInput, type GameEvent } from '../packages/shared/src/combat.ts'
interface State { actors: {size:number;get(id:string):Combatant|undefined}; elapsed:number;phase:string;capacity:number }
const port=2570
const child=spawn(process.execPath,['apps/match/dist/index.js'],{env:{...process.env,NODE_ENV:'test',MATCH_PORT:String(port),FFA_MAX_CLIENTS:'8'},stdio:['ignore','pipe','pipe']})
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d)
const rooms:Room<State>[]=[],inputs=new Map<Room<State>,CombatInput>()
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function until(check:()=>boolean|Promise<boolean>,label:string,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(30)}throw Error(`${label}: ${logs}`)}
const idle=():CombatInput=>({x:0,z:0,yaw:0,pitch:0,fire:false,aim:false})
const pulse=setInterval(()=>{for(const [room,input] of inputs)if(!room.reconnection.isReconnecting)room.send('input',input)},40)
try {
 await until(async()=>{try{return(await fetch(`http://127.0.0.1:${port}/health`)).ok}catch{return false}},'server ready')
 const client=new Client(`ws://127.0.0.1:${port}`)
 async function join(name:string){const room=await client.joinOrCreate<State>('ffa',{name});rooms.push(room);room.onMessage('event',()=>{});return room}
 const a=await join('ALPHA'),b=await join('BRAVO');assert.equal(a.roomId,b.roomId)
 await until(()=>a.state?.actors?.size===2&&b.state?.actors?.size===2,'two genuine clients')
 assert.equal(a.state.capacity,8);assert.equal(a.state.actors.get(a.sessionId)!.participating,false)
 a.send('action','start');await until(()=>a.state.actors.get(a.sessionId)!.participating===true,'alpha enters')
 b.send('action','start');await until(()=>b.state.actors.get(b.sessionId)!.participating===true,'bravo enters')
 inputs.set(a,{...idle(),crouch:true});inputs.set(b,idle())
 await until(()=>b.state.actors.get(a.sessionId)?.crouch===1,'remote crouch replicated')
 a.send('input',{...idle(),crouch:99});await delay(80);assert.equal(b.state.actors.get(a.sessionId)!.crouch,1)
 inputs.set(a,idle());await until(()=>b.state.actors.get(a.sessionId)?.crouch===0,'standing replicated')
 await until(()=>[a.sessionId,b.sessionId].every(id=>a.state.actors.get(id)!.protectedUntil<=a.state.elapsed),'spawn protection elapsed')
 const events:GameEvent[]=[];a.onMessage('event',e=>events.push(e))
 function aim(shooter:Room<State>,targetId:string,fire:boolean){const me=shooter.state.actors.get(shooter.sessionId)!,target=shooter.state.actors.get(targetId)!;const distance=Math.hypot(target.x-me.x,target.z-me.z);const yaw=Math.atan2(target.x-me.x,target.z-me.z),pitch=Math.atan2(me.y+1.6-target.y-1.1,distance);return{...idle(),yaw,pitch,aim:true,fire}}
 async function approach(shooter:Room<State>, targetId:string) {
   const me=shooter.state.actors.get(shooter.sessionId)!,target=shooter.state.actors.get(targetId)!
   const clear=(p:{x:number;y:number;z:number})=>{
     const d=Math.hypot(target.x-p.x,target.z-p.z),ray=direction(Math.atan2(target.x-p.x,target.z-p.z),Math.atan2(p.y+1.6-target.y-1.1,d))
     return d<70&&worldHit({x:p.x,y:p.y+1.6,z:p.z},ray,80,COMBAT_WORLD)>Math.hypot(target.x-p.x,target.z-p.z,target.y+1.1-p.y-1.6)-.4
   }
   if(clear(me))return
   const nav=getNavigation(COMBAT_WORLD)
   const goal=nav.points.filter(p=>Math.hypot(p.x-target.x,p.z-target.z)>8&&Math.hypot(p.x-target.x,p.z-target.z)<24&&clear(p)).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0]
   assert.ok(goal,'reachable firing position exists')
   for(const point of nav.findPath(me,goal)) {
     try {
       await until(()=>{const current=shooter.state.actors.get(shooter.sessionId)!;const dx=point.x-current.x,dz=point.z-current.z,d=Math.hypot(dx,dz);if(d<.12)return true;const speed=Math.min(1,d/1.2);inputs.set(shooter,{...idle(),x:dx/d*speed,z:dz/d*speed});return false},'walk to firing position',10000)
     } catch(error) {
       const current=shooter.state.actors.get(shooter.sessionId)!
       throw new Error(`Path follower at ${JSON.stringify({x:current.x,y:current.y,z:current.z})}, waypoint ${JSON.stringify(point)}`,{cause:error})
     }
   }
   inputs.set(shooter,idle());await delay(100)
   assert.ok(clear(shooter.state.actors.get(shooter.sessionId)!),'walk established line of sight')
 }
 await approach(a,b.sessionId)
 const aimA=aim(a,b.sessionId,true)
 inputs.set(a,aimA)
 await until(()=>a.state.actors.get(a.sessionId)!.kills>=1,'authoritative remote elimination')
 inputs.set(a,idle());const score=a.state.actors.get(a.sessionId)!.score
 assert.equal(b.state.actors.get(b.sessionId)!.health,0)
 assert.ok(events.some(e=>e.type==='shot'&&e.hitId===b.sessionId&&e.damage>0))
 const deadPosition={x:b.state.actors.get(b.sessionId)!.x,z:b.state.actors.get(b.sessionId)!.z}
 await until(()=>b.state.actors.get(b.sessionId)!.health===100,'unlimited respawn')
 const respawned=b.state.actors.get(b.sessionId)!
 assert.ok(Math.hypot(respawned.x-deadPosition.x,respawned.z-deadPosition.z)>4)
 assert.ok(respawned.protectedUntil>b.state.elapsed)
 await approach(b,a.sessionId)
 await until(()=>b.state.actors.get(b.sessionId)!.protectedUntil<=b.state.elapsed,'bravo protection ends')
 inputs.set(b,aim(b,a.sessionId,true))
 await until(()=>a.state.actors.get(a.sessionId)!.health<100,'reciprocal remote damage')
 inputs.set(b,idle())
 // No client-controlled damage, teleport, score, phase, or cross-player input authority.
 const x=a.state.actors.get(a.sessionId)!.x
 a.send('input',{...idle(),x:999,playerId:b.sessionId,health:0,score:99999})
 a.send('damage',{targetId:b.sessionId,damage:99999});a.send('action','finish');a.send('action','restart');a.send('action','start')
 await delay(160);assert.equal(a.state.actors.get(a.sessionId)!.x,x);assert.equal(a.state.actors.get(a.sessionId)!.score,score);assert.equal(a.state.phase,'playing')
 const elapsed=a.state.elapsed;a.send('action','pause');await delay(180);assert.ok(a.state.elapsed>elapsed)
 const late=await join('LATE');await until(()=>late.state?.actors?.size===3,'late state');assert.equal(late.state.actors.get(a.sessionId)!.score,score)
 // Explicit transport drop/manual reconnect exercises the real reconnection reservation.
 const token=a.reconnectionToken,id=a.sessionId,roomId=a.roomId,health=a.state.actors.get(a.sessionId)!.health
 inputs.delete(a);a.reconnection.enabled=false;a.connection.close()
 await until(()=>b.state.actors.get(id)?.connected===false,'drop visible to peer')
 const recovered=await client.reconnect<State>(token);rooms.push(recovered);recovered.onMessage('event',()=>{});inputs.set(recovered,idle())
 await until(()=>recovered.state?.actors?.get(id)?.connected===true,'reconnection accepted')
 assert.equal(recovered.sessionId,id);assert.equal(recovered.roomId,roomId);assert.equal(recovered.state.actors.get(id)!.score,score)
 assert.equal(recovered.state.actors.get(id)!.health,health)
 // Capacity is real: fill eight seats, then matchmaking creates another room.
 let expiring:Room<State>|undefined
 for(let i=3;i<8;i++)expiring=await join(`EXTRA${i}`)
 await until(()=>b.state.actors.size===8,'eight occupied seats')
 const overflow=await join('OVERFLOW');assert.notEqual(overflow.roomId,roomId)
 const practice=await client.create<State>('training');rooms.push(practice);practice.onMessage('event',()=>{})
 await until(()=>practice.state?.actors?.size===6,'training isolation');assert.equal(practice.state.phase,'ready');assert.notEqual(practice.roomId,roomId)
 await late.leave();await until(()=>!b.state.actors.get(late.sessionId),'consented departure removed')
 inputs.delete(b);b.send('input',{...idle(),x:1});await delay(550);const stopped=b.state.actors.get(b.sessionId)!.x;await delay(180);assert.equal(b.state.actors.get(b.sessionId)!.x,stopped)
 expiring!.reconnection.enabled=false;expiring!.connection.close()
 await until(()=>b.state.actors.get(expiring!.sessionId)?.connected===false,'reserved dropped seat')
 await until(()=>!b.state.actors.get(expiring!.sessionId),'expired reconnect seat removed',24000)
 console.info('PASS: genuine shared FFA clients, lobby entry, protected spawn, remote shots/kill/respawn, forged-input rejection, local-only pause, late join, transport reconnect preserving identity/score, eight-seat cap/overflow, reconnect expiry, leave cleanup, stale-input stop and Training isolation')
} finally {
 clearInterval(pulse)
 for(const room of rooms) {try{room.reconnection.enabled=false;void room.leave()}catch{}}
 const exit=once(child,'exit');child.kill('SIGTERM');const force=setTimeout(()=>child.kill('SIGKILL'),5000);await exit;clearTimeout(force)
}
