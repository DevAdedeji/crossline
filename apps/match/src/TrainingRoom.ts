import { guestBudget } from './admission.js'
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core'
import { schema, t, type SchemaType } from '@colyseus/schema'
import { TICK_MS } from '@crossline/shared'
import { TRAINING, QUICK_MATCH_MS, IDLE_INPUT } from '@crossline/shared/combat'
import { playerName } from './playerName.js'
import { TrainingGame } from './training/TrainingGame.js'

export const Actor = schema(
  {
    crouch: t.number().default(0),
    connected: t.boolean().default(true),
    participating: t.boolean().default(true),
    id: t.string(),
    name: t.string(),
    bot: t.boolean(),
    x: t.number(),
    y: t.number(),
    z: t.number(),
    yaw: t.number(),
    pitch: t.number(),
    health: t.number(),
    ammo: t.number(),
    kills: t.number(),
    deaths: t.number(),
    score: t.number(),
    shots: t.number(),
    hits: t.number(),
    headshots: t.number(),
    reloadUntil: t.number(),
    respawnUntil: t.number(),
    protectedUntil: t.number(),
    lastShot: t.number(),
    lastDamage: t.number(),
  },
  'Actor',
)
export const HealthPack = schema({ id:t.string(), x:t.number(), y:t.number(), z:t.number(), availableAt:t.number() },'HealthPack')
export const TrainingState = schema(
  {
    actors: t.map(Actor),
    healthPacks: t.map(HealthPack),
    phase: t.string().default('ready'),
    elapsed: t.number(),
    duration: t.number().default(TRAINING.durationMs),
    round: t.number().default(1),
    capacity: t.number().default(1),
  },
  'TrainingState',
)
export type TrainingState = SchemaType<typeof TrainingState>
export class TrainingRoom extends Room<{ state: TrainingState }> {
  protected mode: 'training' | 'solo' = 'training'
  maxClients = 1
  maxMessagesPerSecond = 120
  private game?: TrainingGame
  private lastInput = 0
  static async onAuth(_token:unknown,_options:unknown,context:AuthContext){return {ip:context.headers.get('x-crossline-client-ip')??'127.0.0.1'}}
  onCreate() {
    try{guestBudget.reserve(this.roomId)}catch{throw new ServerError(503,'Guest rooms are busy. Try again shortly.')}
    this.clock.setTimeout(()=>{void this.disconnect()},30*60*1000)
    let idleSince=this.clock.elapsedTime
    this.clock.setInterval(()=>{
      if(this.game?.phase==='playing')idleSince=this.clock.elapsedTime
      else if(this.clock.elapsedTime-idleSince>120000)void this.disconnect()
    },10000)
    this.setState(new TrainingState())
    this.setPrivate(true)
    this.setPatchRate(TICK_MS)
    this.onMessage('input', (_client, value: unknown) => {
      if (this.game?.acceptInput(value)) this.lastInput = this.clock.elapsedTime
    })
    this.onMessage('action', (_client, value: unknown) => {
      if (!this.game || typeof value !== 'string') return
      if (value === 'start') {
        this.game.start()
        this.lastInput = this.clock.elapsedTime
      } else if (value === 'pause') this.game.pause()
      else if (value === 'reload') this.game.reload(this.game.humanId)
      else if (value === 'finish' && this.game.phase !== 'ready') this.game.finish()
      else if (
        value === 'restart' &&
        (this.game.phase === 'finished' || this.game.phase === 'paused')
      ) {
        const name=this.game.actors.get(this.game.humanId)?.name
        this.game.restart()
        if(name)this.game.actors.get(this.game.humanId)!.name=name
      }
      this.sync()
    })
    this.setSimulationInterval(() => {
      if (!this.game) return
      if (this.game.phase === 'playing' && this.clock.elapsedTime - this.lastInput > 1200)
        this.game.pause()
      if (this.clock.elapsedTime - this.lastInput > 250)
        this.game.input = { ...IDLE_INPUT, yaw: this.game.input.yaw, pitch: this.game.input.pitch, crouch: this.game.input.crouch }
      this.game.step(TICK_MS)
      this.sync()
      for (const event of this.game.drainEvents()) this.broadcast('event', event)
    }, TICK_MS)
  }
  onJoin(client: Client, options: {name?:unknown}|undefined, auth:{ip:string}) {
    try{guestBudget.attach(this.roomId,auth.ip)}catch{throw new ServerError(4216,'Close another Solo or Practice session first.')}
    const testDuration =
      process.env.NODE_ENV === 'test' ? Number(process.env.TRAINING_TEST_DURATION_MS) : NaN
    const defaultDuration=this.mode==='solo'?QUICK_MATCH_MS:TRAINING.durationMs
    const duration =
      Number.isFinite(testDuration) && testDuration >= 1000 && testDuration <= TRAINING.durationMs
        ? testDuration
        : defaultDuration
    this.game = new TrainingGame(client.sessionId, duration, Math.random, this.mode)
    this.game.actors.get(client.sessionId)!.name=playerName(options?.name,client.sessionId)
    this.lastInput = this.clock.elapsedTime
    this.sync()
  }
  private sync() {
    if (!this.game) return
    for(const [id,value] of this.game.healthPacks) {
      let pack=this.state.healthPacks.get(id)
      if(!pack){pack=new HealthPack();this.state.healthPacks.set(id,pack)}
      Object.assign(pack,value)
    }
    this.state.phase = this.game.phase
    this.state.elapsed = this.game.elapsed
    this.state.duration = this.game.durationMs
    this.state.round = this.game.round
    for (const [id, value] of this.game.actors) {
      let actor = this.state.actors.get(id)
      if (!actor) {
        actor = new Actor()
        this.state.actors.set(id, actor)
      }
      Object.assign(actor, value)
    }
  }
  onDispose(){guestBudget.release(this.roomId)}
  onLeave() {
    this.game?.pause()
    this.game = undefined
    this.state.actors.clear()
    this.state.healthPacks.clear()
  }
}

export class SoloRoom extends TrainingRoom {
  protected override mode = 'solo' as const
}
