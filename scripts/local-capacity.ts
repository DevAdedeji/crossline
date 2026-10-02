/** Bounded single-arena experiment. Never targets an existing or remote server. */
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { Client, type Room } from '@colyseus/sdk'
import { createTestAccount } from './test-account.ts'
import type { Combatant } from '../packages/shared/src/combat.ts'
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const output=process.argv[2] ?? '/tmp/crossline-capacity.json'
const results:unknown[]=[]
let abort=false
for(const count of [8,16,32]){
 if(abort)break
 const port=2574,base=`http://127.0.0.1:${port}`,rooms:Room<{actors:{size:number;get(id:string):Combatant|undefined;values():IterableIterator<Combatant>}}>[]=[],metrics:Record<string,number>[]=[]
 let pending='',logs='',measuring=false,stopReason:unknown,pulse:ReturnType<typeof setInterval>|undefined
 const child=spawn(process.execPath,['apps/match/dist/index.js'],{env:{...process.env,NODE_ENV:'test',CROSSLINE_LOCAL_LOAD:'1',MATCH_HOST:'127.0.0.1',MATCH_PORT:String(port),FFA_MAX_CLIENTS:String(count),DATABASE_URL:'',AUTH_DEV_LOCAL:'1',AUTH_LOCAL_PATH:':memory:',WEB_ORIGIN:base},stdio:['ignore','pipe','pipe']})
 const watchdog=setTimeout(()=>{abort=true;stopReason='180-second stage deadline';child.kill('SIGTERM')},180000)
 child.stdout.on('data',chunk=>{pending+=chunk;const lines=pending.split('\n');pending=lines.pop()!;for(const line of lines){try{const m=JSON.parse(line);if(m.event==='load.metrics'){
  if(measuring)metrics.push(m)
  if(m.rssMiB>1200||m.tickP95>25||m.loopP95>100||m.cpuPercent>150){abort=true;stopReason=m;child.kill('SIGTERM')}
 }}catch{}}});child.stderr.on('data',chunk=>logs+=chunk)
 try{
  const end=Date.now()+30000
  while(true){try{if((await fetch(`${base}/health`)).ok)break}catch{}if(Date.now()>end)throw Error(`Server startup failed: ${logs}`);await delay(100)}
  const profiles=[]
  for(let i=0;i<count;i++){
   if(i===16){console.log(`${count} clients: waiting for normal auth rate-limit window`);await delay(61000)}
   profiles.push(await createTestAccount(base,`load_${count}_${i}`))
  }
  for(const account of profiles){const room=await new Client(`ws://127.0.0.1:${port}`).joinOrCreate<typeof rooms[number]['state']>('ffa',{joinToken:await account.token()});for(const name of ['event','leaderboard','authenticated'])room.onMessage(name,()=>{});rooms.push(room);room.send('action','start')}
  if(new Set(rooms.map(r=>r.roomId)).size!==1)throw Error('Clients did not join one arena')
  let moving=false,frame=0
  pulse=setInterval(()=>{frame++;for(const [i,room] of rooms.entries()){
   if(room.reconnection.isReconnecting)continue
   const self=room.state?.actors?.get(room.sessionId)
   if(!self)continue
   const target=[...room.state.actors.values()].find(a=>a.id!==self.id&&a.health>0)
   const yaw=target?Math.atan2(target.x-self.x,target.z-self.z):i,pitch=target?Math.atan2(self.y+.5-target.y,Math.hypot(target.x-self.x,target.z-self.z)):0
   room.send('input',{x:moving?Math.sin(i+frame/60):0,z:moving?Math.cos(i+frame/60):0,yaw,pitch:Math.max(-1.4,Math.min(1.4,pitch)),fire:moving,aim:moving})
   if(moving&&self.ammo===0)room.send('action','reload')
  }},40)
  for(const scenario of ['idle-connected','movement-and-fire']){
   moving=scenario==='movement-and-fire';await delay(5000);metrics.length=0;measuring=true
   console.log(`Measuring ${count} authenticated clients in ONE arena: ${scenario}`)
   for(let second=0;second<25;second++){if(abort||child.exitCode!==null)throw Error('Automatic host-health stop');if(rooms.some(room=>room.reconnection.isReconnecting||room.state.actors.size!==count))throw Error('A client disconnected or the shared arena lost actors');await delay(1000)}
   measuring=false;results.push({count,scenario,sampleSeconds:25,metrics:[...metrics]})
  }
 }catch(error){abort=true;results.push({count,error:String(error),stopReason,partialMetrics:metrics});console.error(String(error))}
 finally{clearTimeout(watchdog);if(pulse)clearInterval(pulse);for(const room of rooms)room.reconnection.enabled=false;await Promise.race([Promise.all(rooms.map(room=>room.leave().catch(()=>{}))),delay(2000)]);for(const room of rooms)room.connection.close();if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(5000)]);if(child.exitCode===null)child.kill('SIGKILL')}}
 await writeFile(output,JSON.stringify({timestamp:new Date().toISOString(),runtime:process.version,platform:process.platform,arch:process.arch,abort,results},null,2)+'\n')
}
if(abort)process.exitCode=1
