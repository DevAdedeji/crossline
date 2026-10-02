import { monitorEventLoopDelay } from 'node:perf_hooks'
import type { Client } from '@colyseus/core'
/** Deliberately unavailable to normal development or any public listener. */
export function loadCapacity():number|undefined {
 if(process.env.CROSSLINE_LOCAL_LOAD!=='1')return
 if(process.env.NODE_ENV!=='test'||process.env.MATCH_HOST!=='127.0.0.1'||process.env.AUTH_DEV_LOCAL!=='1'||process.env.AUTH_LOCAL_PATH!==':memory:'||process.env.DATABASE_URL)throw new Error('Load testing requires isolated loopback test mode and an in-memory fixture database')
 const n=Number(process.env.FFA_MAX_CLIENTS)
 if(!Number.isInteger(n)||n<2||n>32)throw new Error('Bounded local load tests allow at most 32 clients')
 return n
}
export function createLoadMetrics(){
 if(loadCapacity()===undefined)return
 const delay=monitorEventLoopDelay({resolution:10});delay.enable()
 let samples:number[]=[],outbound=0,inbound=0,last=performance.now(),cpu=process.cpuUsage()
 const timer=setInterval(()=>{
  const now=performance.now(),seconds=(now-last)/1000,usage=process.cpuUsage(cpu);cpu=process.cpuUsage();last=now
  samples.sort((a,b)=>a-b)
  const percentile=(p:number)=>samples[Math.min(samples.length-1,Math.floor(samples.length*p))] ?? 0
  console.info(JSON.stringify({event:'load.metrics',ticks:samples.length,tickP50:percentile(.5),tickP95:percentile(.95),tickMax:percentile(1),loopP95:delay.percentile(95)/1e6,rssMiB:process.memoryUsage().rss/1048576,cpuPercent:(usage.user+usage.system)/10000/seconds,outboundBytesPerSecond:outbound/seconds,inboundBytesPerSecond:inbound/seconds}))
  samples=[];outbound=0;inbound=0;delay.reset()
 },1000);timer.unref()
 return {
  tick(ms:number){samples.push(ms)},
  client(client:Client){
   const raw=client.raw.bind(client)
   client.raw=(...args:Parameters<Client['raw']>)=>{outbound+=args[0].byteLength;return raw(...args)}
   client.ref.on('message',(data:{byteLength:number})=>{inbound+=data.byteLength})
  },
  close(){clearInterval(timer);delay.disable()},
 }
}
