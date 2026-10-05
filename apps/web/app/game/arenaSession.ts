import type { PlayerGrenade } from '@crossline/shared/campaignGrenades'
import type { CampaignState, CampaignProgress } from '@crossline/shared/campaign'
import type { Combatant, Phase } from '@crossline/shared/combat'
import type { HealthPickup } from '@crossline/shared'
export interface ArenaState {
 grenades?: {forEach(callback:(grenade:PlayerGrenade)=>void):void}
 actors: {forEach(callback:(actor:Combatant,id:string)=>void):void}
 healthPacks?: {forEach(callback:(pack:HealthPickup)=>void):void}
 campaign?: CampaignState
 phase: Phase; elapsed:number; duration:number; round:number; capacity?:number
}
export interface ArenaSession {
 sessionId:string; roomId:string
 send(type:string,value?:unknown):void
 leave():unknown
 onStateChange(callback:(state:ArenaState)=>void):unknown
 onMessage<T>(type:string,callback:(value:T)=>void):unknown
 onDrop(callback:()=>void):unknown
 onReconnect(callback:()=>void):unknown
 onLeave(callback:()=>void):unknown
 onError(callback:()=>void):unknown
}
/** Device-only simulation: no socket, account, score upload or server credentials. */
export function localSession(mode:'training'|'solo'|'campaign',name:string,progress?:CampaignProgress):ArenaSession {
 const worker=new Worker(new URL('./localSimulation.worker.ts',import.meta.url),{type:'module'})
 const sessionId=crypto.randomUUID(),roomId='local-'+sessionId
 let stateHandler:((state:ArenaState)=>void)|undefined,errorHandler:(()=>void)|undefined
 const messages=new Map<string,(value:never)=>void>()
 worker.onmessage=({data})=>{if(data.type==='state')stateHandler?.(data.state);else messages.get(data.type)?.(data.event as never)}
 worker.onerror=()=>errorHandler?.()
 worker.postMessage({type:'init',mode,name,id:sessionId,progress})
 return {sessionId,roomId,send:(type,value)=>worker.postMessage({type,value}),leave:()=>worker.terminate(),
  onStateChange:cb=>{stateHandler=cb},onMessage:(type,cb)=>{messages.set(type,cb)},
  onDrop:()=>{},onReconnect:()=>{},onLeave:()=>{},onError:cb=>{errorHandler=cb}}
}
