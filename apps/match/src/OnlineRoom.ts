import { Room, type Client } from '@colyseus/core'
import { TICK_MS, INPUT_TIMEOUT_MS } from '@crossline/shared'
import { Actor, TrainingState } from './TrainingRoom.js'
import { TrainingGame } from './training/TrainingGame.js'

export function playerName(value: unknown, id: string): string {
  const label=typeof value==='string' ? value.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,16) : ''
  return `${label || 'OPERATOR'}-${id.slice(-4).toUpperCase()}`
}
/** Continuous human-only FFA. A local menu never pauses the shared simulation. */
export class OnlineRoom extends Room<{state: TrainingState}> {
  maxMessagesPerSecond=120
  private game = new TrainingGame('',0,Math.random,'online')
  private lastInput=new Map<string,number>()
  onCreate() {
    const capacity=Number(process.env.FFA_MAX_CLIENTS ?? 8)
    if(!Number.isInteger(capacity)||capacity<2||capacity>8) throw new Error('FFA_MAX_CLIENTS must be an integer from 2 to 8')
    this.maxClients=capacity
    this.setState(new TrainingState())
    this.state.capacity=capacity; this.state.duration=0; this.state.phase='playing'
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
    this.onMessage('*',()=>{})
    this.setSimulationInterval(()=>{
      for(const id of this.game.actors.keys())
        if(this.clock.elapsedTime-(this.lastInput.get(id) ?? -Infinity)>INPUT_TIMEOUT_MS)this.game.stopHuman(id)
      this.game.step(TICK_MS);this.sync()
      for(const event of this.game.drainEvents())this.broadcast('event',event)
    },TICK_MS)
  }
  onJoin(client: Client, options: unknown) {
    const requested=options && typeof options==='object' && 'name' in options ? options.name : undefined
    this.game.addHuman(client.sessionId,playerName(requested,client.sessionId))
    this.lastInput.set(client.sessionId,this.clock.elapsedTime);this.sync()
  }
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
    this.game.removeHuman(client.sessionId);this.lastInput.delete(client.sessionId)
    this.state.actors.delete(client.sessionId);this.sync()
  }
  private sync() {
    this.state.elapsed=this.game.elapsed
    for(const [id,value] of this.game.actors) {
      let actor=this.state.actors.get(id)
      if(!actor){actor=new Actor();this.state.actors.set(id,actor)}
      Object.assign(actor,value)
    }
  }
}
