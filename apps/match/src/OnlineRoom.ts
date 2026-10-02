import { randomUUID } from 'node:crypto'
import { guestStore, type GuestSession } from './online/GuestStore.js'
import { Room, ServerError, type Client } from '@colyseus/core'
import { TICK_MS, INPUT_TIMEOUT_MS, ONLINE_CAPACITY_TARGET, VERIFIED_ONLINE_CAPACITY } from '@crossline/shared'
import { Actor, HealthPack, TrainingState } from './TrainingRoom.js'
import { TrainingGame } from './training/TrainingGame.js'

export { playerName } from './playerName.js'

let activeArenaId:string|undefined,activeArena:OnlineRoom|undefined
export function arenaStatus(){return {roomId:activeArenaId ?? null,full:activeArena?.locked ?? false,capacity:activeArena?.maxClients ?? VERIFIED_ONLINE_CAPACITY,target:ONLINE_CAPACITY_TARGET,seats:activeArena?.state.actors.size ?? 0}}
/** Continuous human-only arena. A local menu never pauses the shared simulation. */
export class OnlineRoom extends Room<{state: TrainingState}> {
  maxMessagesPerSecond=120
  autoDispose=false
  private guests=new Map<string,GuestSession>()
  private leaderboardBusy=false
  private game = new TrainingGame('',0,Math.random,'online')
  private lastInput=new Map<string,number>()
  onCreate() {
    if(activeArenaId && activeArenaId!==this.roomId)throw new ServerError(4213,'Arena is full. Wait for a free seat and try again.')
    activeArenaId=this.roomId;activeArena=this
    const capacity=Number(process.env.FFA_MAX_CLIENTS ?? VERIFIED_ONLINE_CAPACITY)
    if(!Number.isInteger(capacity)||capacity<2||capacity>VERIFIED_ONLINE_CAPACITY) throw new Error('FFA_MAX_CLIENTS must be 2–8; the requested 500-player target is not load-verified')
    this.maxClients=capacity
    this.setState(new TrainingState())
    this.state.capacity=capacity; this.state.duration=this.game.durationMs; this.state.phase='playing'
    this.setPatchRate(TICK_MS)
    this.onMessage('input',(client,value:unknown)=>{
      if(this.game.acceptInput(value,client.sessionId))this.lastInput.set(client.sessionId,this.clock.elapsedTime)
    })
    this.onMessage('action',(client,value:unknown)=>{
      if(value==='start')this.game.enterHuman(client.sessionId)
      else if(value==='reload')this.game.reload(client.sessionId)
      else if(value==='pause')this.game.stopHuman(client.sessionId)
      // Clients cannot reset, finish, pause the world, choose a spawn, or submit damage.
      this.sync()
    })
    this.onMessage('profile',client=>{const guest=this.guests.get(client.sessionId);if(guest)client.send('guest',guest)})
    this.onMessage('leaderboard',()=>{void this.publishLeaders()})
    this.onMessage('*',()=>{})
    this.clock.setInterval(()=>{void guestStore().flush();void this.publishLeaders()},5000)
    this.setSimulationInterval(()=>{
      for(const id of this.game.actors.keys())
        if(this.clock.elapsedTime-(this.lastInput.get(id) ?? -Infinity)>INPUT_TIMEOUT_MS)this.game.stopHuman(id)
      this.game.step(TICK_MS);this.sync()
      for(const event of this.game.drainEvents()) {
        if(event.type==='kill') {
          const killer=this.guests.get(event.killerId),victim=this.guests.get(event.victimId)
          if(killer && victim)guestStore().enqueue(randomUUID(),killer.id,victim.id)
        }
        this.broadcast('event',event)
      }
    },TICK_MS)
  }
  async onAuth(_client:Client,options:unknown) {
    const value=options && typeof options==='object'?options as {name?:unknown;guestToken?:unknown}:{}
    try{return await guestStore().identify(value.guestToken,value.name)}
    catch{throw new ServerError(4214,'Guest statistics are temporarily unavailable. Please retry.')}
  }
  onJoin(client:Client,_options:unknown,guest:GuestSession) {
    this.guests.set(client.sessionId,guest)
    this.game.addHuman(client.sessionId,guest.displayName)
    this.lastInput.set(client.sessionId,this.clock.elapsedTime);this.sync()
    void this.publishLeaders()
  }
  private async publishLeaders(){
    if(this.leaderboardBusy)return
    this.leaderboardBusy=true
    try{this.broadcast('leaderboard',await guestStore().leaderboard())}
    catch{this.broadcast('leaderboard-status',{unavailable:true})}
    finally{this.leaderboardBusy=false}
  }
  onDispose(){if(activeArenaId===this.roomId){activeArenaId=undefined;activeArena=undefined}}
  onDrop(client: Client) {
    this.game.stopHuman(client.sessionId)
    const actor=this.game.actors.get(client.sessionId)
    if(actor)actor.connected=false
    this.sync()
    // A dropped body stays vulnerable; reconnecting cannot heal or reset score.
    void this.allowReconnection(client,20).catch(()=>{})
  }
  onReconnect(client: Client) {
    const actor=this.game.actors.get(client.sessionId)
    if(actor)actor.connected=true
    this.game.stopHuman(client.sessionId)
    this.lastInput.set(client.sessionId,this.clock.elapsedTime);this.sync()
  }
  onLeave(client: Client) {
    this.guests.delete(client.sessionId)
    this.game.removeHuman(client.sessionId);this.lastInput.delete(client.sessionId)
    this.state.actors.delete(client.sessionId);this.sync()
  }
  private sync() {
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
