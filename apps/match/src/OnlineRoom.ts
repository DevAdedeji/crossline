import { onlineCapacity } from './capacity.js'
import { CommitGate } from './commitGate.js'
import { createLoadMetrics } from './loadMetrics.js'
import { randomUUID } from 'node:crypto'
import { accountService, type OnlineIdentity } from './auth/service.js'
import { Room, ServerError, type Client } from '@colyseus/core'
import { TICK_MS, INPUT_TIMEOUT_MS, ONLINE_CAPACITY_TARGET } from '@crossline/shared'
import { Actor, HealthPack, TrainingState } from './TrainingRoom.js'
import { TrainingGame } from './training/TrainingGame.js'

export { playerName } from './playerName.js'

let activeArenaId:string|undefined,activeArenaInfo:(()=>{full:boolean;capacity:number;seats:number})|undefined
export function arenaStatus(){return {roomId:activeArenaId ?? null,...(activeArenaInfo?.() ?? {full:false,capacity:onlineCapacity(),seats:0}),target:ONLINE_CAPACITY_TARGET}}
/** Continuous human-only arena. A local menu never pauses the shared simulation. */
export class OnlineRoom extends Room<{state: TrainingState}> {
  maxMessagesPerSecond=120
  autoDispose=false
  private loadMetrics=createLoadMetrics()
  private accounts=new Map<string,OnlineIdentity>()
  private authorized=new Set<string>()
  private checking=false
  private revoked=new Set<string>()
  private authenticating=new Map<string,number>()
  private connectionGeneration=new Map<string,number>()
  private leaderboardBusy=false
  private commits=new CommitGate()
  private game = new TrainingGame('',0,Math.random,'online')
  private lastInput=new Map<string,number>()
  onCreate() {
    if(activeArenaId && activeArenaId!==this.roomId)throw new ServerError(409,'Arena is full. Wait for a free seat and try again.')
    activeArenaId=this.roomId;activeArenaInfo=()=>({full:this.locked,capacity:this.maxClients,seats:this.state.actors.size})
    const capacity=onlineCapacity()
    this.maxClients=capacity
    this.setState(new TrainingState())
    this.state.capacity=capacity; this.state.duration=this.game.durationMs; this.state.phase='playing'
    this.setPatchRate(TICK_MS)
    this.onMessage('input',(client,value:unknown)=>{
      if(!this.canPlay(client.sessionId))return
      if(this.game.acceptInput(value,client.sessionId))this.lastInput.set(client.sessionId,this.clock.elapsedTime)
    })
    this.onMessage('action',(client,value:unknown)=>{
      if(!this.canPlay(client.sessionId))return
      if(value==='start')this.game.enterHuman(client.sessionId)
      else if(value==='reload')this.game.reload(client.sessionId)
      else if(value==='pause')this.game.stopHuman(client.sessionId)
      // Clients cannot reset, finish, pause the world, choose a spawn, or submit damage.
      this.sync()
    })
    this.onMessage('authenticate',async(client,value:unknown)=>{
      const generation=this.connectionGeneration.get(client.sessionId) ?? 0
      if(this.authorized.has(client.sessionId)||this.authenticating.get(client.sessionId)===generation)return
      this.authenticating.set(client.sessionId,generation)
      try{
        const previous=this.accounts.get(client.sessionId),service=await accountService(),next=await service.admit(value)
        if(!previous||next.id!==previous.id||next.sessionId!==previous.sessionId||!(await service.valid(previous)))throw new Error('Invalid session')
        // An async check for an old connection cannot authorize a later reconnect.
        if(!this.clients.includes(client)||this.connectionGeneration.get(client.sessionId)!==generation)return
        this.authorized.add(client.sessionId);client.send('authenticated',{username:next.displayName})
      }catch{if(this.connectionGeneration.get(client.sessionId)===generation)this.revoke(client)}finally{if(this.authenticating.get(client.sessionId)===generation)this.authenticating.delete(client.sessionId)}
    })
    this.onMessage('leaderboard',()=>{void this.publishLeaders()})
    this.onMessage('*',()=>{})
    this.clock.setInterval(()=>{void this.commits.retry();void this.publishLeaders();void this.checkSessions()},2000)
    this.setSimulationInterval(()=>{
      if(this.commits.blocked)return
      const started=this.loadMetrics?performance.now():0
      for(const id of this.game.actors.keys())
        if(!this.canPlay(id)||this.clock.elapsedTime-(this.lastInput.get(id) ?? -Infinity)>INPUT_TIMEOUT_MS)this.game.stopHuman(id)
      this.game.step(TICK_MS)
      const events=this.game.drainEvents(),records:{id:string;killer:string;victim:string}[]=[]
      for(const event of events)if(event.type==='kill'){
        const killer=this.accounts.get(event.killerId),victim=this.accounts.get(event.victimId)
        if(killer&&victim)records.push({id:randomUUID(),killer:killer.id,victim:victim.id})
      }
      const publish=()=>{this.sync();for(const event of events)this.broadcast('event',event)}
      if(records.length)void this.commits.submit(async()=>{
        const statistics=(await accountService()).statistics
        for(const record of records)await statistics.record(record.id,record.killer,record.victim)
      },publish)
      else publish()
      this.loadMetrics?.tick(performance.now()-started)
    },TICK_MS)
  }
  private canPlay(id:string){const account=this.accounts.get(id);return this.authorized.has(id)&&Boolean(account&&account.expiresAt>Date.now())}
  private revoke(client:Client){this.revoked.add(client.sessionId);this.authorized.delete(client.sessionId);this.game.stopHuman(client.sessionId);client.send('session-ended',{});client.leave(4001,'Sign in again')}
  private async checkSessions(){
    if(this.checking||this.clients.length===0)return;this.checking=true
    try{const service=await accountService();for(const client of this.clients){const who=this.accounts.get(client.sessionId);if(!who||!(await service.valid(who)))this.revoke(client)}}
    catch{for(const client of this.clients)this.revoke(client)}finally{this.checking=false}
  }
  async onAuth(_client:Client,options:unknown) {
    const value=options && typeof options==='object'?options as {joinToken?:unknown}:{}
    try{return await (await accountService()).admit(value.joinToken)}
    catch{throw new ServerError(4214,'Sign in with your account to enter Online.')}
  }
  onJoin(client:Client,_options:unknown,account:OnlineIdentity) {
    this.loadMetrics?.client(client)
    if([...this.accounts.values()].some(a=>a.id===account.id))throw new ServerError(4215,'This account is already in the arena. Reconnect or leave its other session.')
    this.accounts.set(client.sessionId,account);this.connectionGeneration.set(client.sessionId,0);this.authorized.add(client.sessionId)
    this.game.addHuman(client.sessionId,account.displayName)
    this.lastInput.set(client.sessionId,this.clock.elapsedTime);this.sync()
    void this.publishLeaders()
  }
  private async publishLeaders(){
    if(this.leaderboardBusy||this.clients.length===0)return
    this.leaderboardBusy=true
    try{this.broadcast('leaderboard',await (await accountService()).statistics.leaderboard())}
    catch{this.broadcast('leaderboard-status',{unavailable:true})}
    finally{this.leaderboardBusy=false}
  }
  async onDispose(){await this.commits.retry();this.loadMetrics?.close();if(activeArenaId===this.roomId){activeArenaId=undefined;activeArenaInfo=undefined}}
  onDrop(client: Client) {
    this.connectionGeneration.set(client.sessionId,(this.connectionGeneration.get(client.sessionId) ?? 0)+1)
    if(this.revoked.has(client.sessionId))return
    this.authorized.delete(client.sessionId)
    this.game.stopHuman(client.sessionId)
    const actor=this.game.actors.get(client.sessionId)
    if(actor)actor.connected=false
    this.sync()
    // A dropped body stays vulnerable; reconnecting cannot heal or reset score.
    void this.allowReconnection(client,20).catch(()=>{})
  }
  onReconnect(client: Client) {
    this.connectionGeneration.set(client.sessionId,(this.connectionGeneration.get(client.sessionId) ?? 0)+1)
    this.authorized.delete(client.sessionId)
    this.clock.setTimeout(()=>{if(this.clients.includes(client)&&!this.authorized.has(client.sessionId))this.revoke(client)},5000)
    const actor=this.game.actors.get(client.sessionId)
    if(actor)actor.connected=true
    this.game.stopHuman(client.sessionId)
    this.lastInput.set(client.sessionId,this.clock.elapsedTime);this.sync()
  }
  onLeave(client: Client) {
    this.revoked.delete(client.sessionId);this.connectionGeneration.delete(client.sessionId);this.authenticating.delete(client.sessionId)
    this.accounts.delete(client.sessionId);this.authorized.delete(client.sessionId)
    this.game.removeHuman(client.sessionId);this.lastInput.delete(client.sessionId)
    this.state.actors.delete(client.sessionId);this.sync()
  }
  private sync() {
    if(this.commits.blocked)return
    for(const [id,value] of this.game.healthPacks){let pack=this.state.healthPacks.get(id);if(!pack){pack=new HealthPack();this.state.healthPacks.set(id,pack)}Object.assign(pack,value)}
    this.state.phase=this.game.phase
    this.state.elapsed=this.game.elapsed
    for(const [id,value] of this.game.actors) {
      let actor=this.state.actors.get(id)
      if(!actor){actor=new Actor();this.state.actors.set(id,actor)}
      Object.assign(actor,value)
    }
  }
}
