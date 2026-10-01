import { TICK_MS, move, isBlocked, type Position } from '@crossline/shared'
import {
  TRAINING,
  RIFLE,
  EYE_HEIGHT,
  IDLE_INPUT,
  parseCombatInput,
  direction,
  worldHit,
  actorHit,
  TRAINING_SPAWNS,
  type Combatant,
  type CombatInput,
  type Phase,
  type GameEvent,
} from '@crossline/shared/combat'
import { findPath } from './navigation.js'

interface BotMemory {
  path: Position[]
  nextPlan: number
}
export class TrainingGame {
  actors = new Map<string, Combatant>()
  phase: Phase = 'ready'
  elapsed = 0
  round = 1
  input: CombatInput = { ...IDLE_INPUT }
  events: GameEvent[] = []
  private spawnHistory = new Map<string, string[]>()
  private memories = new Map<string, BotMemory>()
  constructor(
    readonly humanId: string,
    readonly durationMs: number = TRAINING.durationMs,
    private readonly random: () => number = Math.random,
  ) {
    this.reset()
  }
  private actor(id: string, name: string, bot: boolean, position: Position): Combatant {
    return {
      id,
      name,
      bot,
      ...position,
      yaw: bot ? [Math.PI / 2, 0, -Math.PI / 3, 0, Math.PI * 0.75][Number(id.slice(-1))]! : 0,
      pitch: 0,
      health: 100,
      ammo: RIFLE.magazine,
      kills: 0,
      deaths: 0,
      score: 0,
      shots: 0,
      hits: 0,
      headshots: 0,
      reloadUntil: 0,
      respawnUntil: 0,
      protectedUntil: TRAINING.protectionMs,
      lastShot: -10000,
      lastDamage: -10000,
    }
  }
  reset() {
    this.spawnHistory.clear()
    this.actors.clear()
    this.memories.clear()
    this.elapsed = 0
    this.phase = 'ready'
    this.input = { ...IDLE_INPUT }
    this.events = []
    this.actors.set(this.humanId, this.actor(this.humanId, 'YOU', false, TRAINING_SPAWNS[0]!))
    for (let i = 0; i < TRAINING.botCount; i++) {
      const id = `bot-${i}`
      this.actors.set(
        id,
        this.actor(id, ['ROOK', 'MAKO', 'ECHO', 'SABLE', 'VEX'][i]!, true, TRAINING_SPAWNS[i + 1]!),
      )
      this.memories.set(id, {
        path: [],
        nextPlan: 0,
      })
    }
  }
  restart() {
    this.round++
    this.reset()
  }
  start() {
    if (this.phase === 'ready' || this.phase === 'paused') this.phase = 'playing'
  }
  pause() {
    if (this.phase === 'playing') {
      this.phase = 'paused'
      this.input = { ...IDLE_INPUT }
    }
  }
  finish() {
    this.phase = 'finished'
    this.input = { ...IDLE_INPUT }
  }
  acceptInput(value: unknown): boolean {
    const input = parseCombatInput(value)
    if (!input) return false
    this.input = input
    return true
  }
  reload(id: string) {
    const actor = this.actors.get(id)
    if (
      this.phase !== 'playing' ||
      !actor ||
      actor.health <= 0 ||
      actor.reloadUntil ||
      actor.ammo >= RIFLE.magazine
    )
      return false
    actor.reloadUntil = this.elapsed + RIFLE.reloadMs
    return true
  }
  private respawn(actor: Combatant) {
    const others = [...this.actors.values()].filter((other) => other.id !== actor.id)
    const key = (point: Position) => `${point.x}/${point.y}/${point.z}`
    const history = this.spawnHistory.get(actor.id) ?? []
    const separation = (point: Position) =>
      Math.min(
        ...others.map(
          (other) =>
            Math.hypot(other.x - point.x, other.z - point.z) + Math.abs(other.y - point.y) * 3,
        ),
      )
    const candidates = TRAINING_SPAWNS.filter(
      (point) =>
        !isBlocked(point) &&
        Math.hypot(point.x - actor.x, point.z - actor.z) > 4 &&
        separation(point) > 2,
    )
    const fresh = candidates.filter((point) => !history.includes(key(point)))
    const pool = fresh.length ? fresh : candidates
    const ranked = [...pool].sort((a, b) => separation(b) - separation(a))
    const spawn = actor.bot
      ? (ranked[Math.floor(this.random() * Math.min(4, ranked.length))] ?? TRAINING_SPAWNS[0]!)
      : (ranked[0] ?? TRAINING_SPAWNS[0]!)
    this.spawnHistory.set(actor.id, [key(spawn), ...history].slice(0, 3))
    Object.assign(actor, spawn, {
      health: 100,
      ammo: RIFLE.magazine,
      reloadUntil: 0,
      respawnUntil: 0,
      protectedUntil: this.elapsed + TRAINING.protectionMs,
      lastDamage: this.elapsed,
      lastShot: this.elapsed,
    })
    actor.yaw = actor.bot
      ? (Number(actor.id.slice(-1)) * 1.2 + spawn.x * 0.13) % (Math.PI * 2)
      : Math.atan2(-spawn.x, -spawn.z)
    this.events.push({ type: 'spawn', actorId: actor.id, yaw: actor.yaw })
    const memory = this.memories.get(actor.id)
    if (memory) {
      memory.path = []
      memory.nextPlan = 0
    }
  }
  fire(actor: Combatant, yaw: number, pitch: number, aiming = false): boolean {
    const cadence = RIFLE.intervalMs
    if (
      this.phase !== 'playing' ||
      actor.bot ||
      actor.health <= 0 ||
      actor.reloadUntil ||
      actor.ammo <= 0 ||
      this.elapsed - actor.lastShot < cadence
    )
      return false
    actor.lastShot = this.elapsed
    actor.ammo--
    actor.shots++
    const spread = aiming ? 0.0015 : 0.012
    const ray = direction(
      yaw + (this.random() - 0.5) * spread,
      pitch + (this.random() - 0.5) * spread,
    )
    const origin = { x: actor.x, y: actor.y + EYE_HEIGHT, z: actor.z }
    let distance = worldHit(origin, ray)
    let victim: Combatant | undefined
    for (const candidate of this.actors.values()) {
      if (candidate.id === actor.id || candidate.health <= 0) continue
      const hit = actorHit(origin, ray, candidate, distance)
      if (hit !== null && hit < distance) {
        distance = hit
        victim = candidate
      }
    }
    const end = {
      x: origin.x + ray.x * distance,
      y: origin.y + ray.y * distance,
      z: origin.z + ray.z * distance,
    }
    let damage = 0
    let headshot = false
    let eliminated = false
    if (victim && victim.protectedUntil <= this.elapsed) {
      headshot = end.y >= victim.y + 1.3
      damage = headshot ? RIFLE.headDamage : RIFLE.damage
      victim.health = Math.max(0, victim.health - damage)
      victim.lastDamage = this.elapsed
      actor.hits++
      actor.score += 10
      if (headshot) actor.headshots++
      this.events.push({
        type: 'damage',
        targetId: victim.id,
        sourceId: actor.id,
        damage,
        health: victim.health,
      })
      if (victim.health === 0) {
        eliminated = true
        victim.deaths++
        victim.respawnUntil = this.elapsed + TRAINING.respawnMs
        victim.reloadUntil = 0
        actor.kills++
        actor.score += 100 + (headshot ? 25 : 0)
        this.events.push({
          type: 'kill',
          killer: actor.name,
          victim: victim.name,
          humanKill: actor.id === this.humanId,
        })
      }
    }
    this.events.push({
      type: 'shot',
      shooterId: actor.id,
      start: origin,
      end,
      hitId: victim?.id ?? '',
      damage,
      headshot,
      eliminated,
    })
    return true
  }
  private botStep(bot: Combatant, dt: number) {
    const index = Number(bot.id.slice(-1))
    // Three stationary practice targets and two slow patrols. No pursuit behavior in Training.
    if (index % 2 === 0) {
      Object.assign(bot, move(bot, { x: 0, z: 0 }, dt))
      return
    }
    // A confirmed hit stops locomotion for the complete flinch; no combat AI in target practice.
    if (this.elapsed - bot.lastDamage < 350) return
    const memory = this.memories.get(bot.id)!
    const routes =
      index === 1
        ? [
            [3, 7],
            [3, -4],
            [0, -5],
            [0, 6],
          ]
        : [
            [13, 12],
            [13, 5.5],
            [8, 5.5],
            [8, 12],
          ]
    const stage = (Math.floor(this.elapsed / 14000) + 1) % routes.length
    if (this.elapsed >= memory.nextPlan || !memory.path.length) {
      const point = routes[stage]!
      memory.path = findPath(bot, { x: point[0]!, y: 0, z: point[1]! })
      memory.nextPlan = this.elapsed + 2000
    }
    const waypoint = memory.path[0]
    if (waypoint) {
      const dx = waypoint.x - bot.x,
        dz = waypoint.z - bot.z,
        length = Math.hypot(dx, dz)
      if (length < 0.25) memory.path.shift()
      else {
        bot.yaw = Math.atan2(dx, dz)
        Object.assign(bot, move(bot, { x: (dx / length) * 0.16, z: (dz / length) * 0.16 }, dt))
      }
    }
  }

  step(delta = TICK_MS) {
    if (this.phase !== 'playing') return
    const dt = Math.max(0, Math.min(delta, TICK_MS))
    this.elapsed += dt
    if (this.elapsed >= this.durationMs) {
      this.elapsed = this.durationMs
      this.finish()
      return
    }
    for (const actor of this.actors.values()) {
      if (actor.health <= 0) {
        if (actor.respawnUntil <= this.elapsed) this.respawn(actor)
        continue
      }
      if (actor.reloadUntil && actor.reloadUntil <= this.elapsed) {
        actor.ammo = RIFLE.magazine
        actor.reloadUntil = 0
      }
      if (this.elapsed - actor.lastDamage > 5000)
        actor.health = Math.min(100, actor.health + dt * 0.01)
      if (actor.bot) this.botStep(actor, dt)
      else {
        actor.yaw = this.input.yaw
        actor.pitch = this.input.pitch
        Object.assign(
          actor,
          move(
            actor,
            {
              x: this.input.x * (this.input.aim ? 0.65 : 1),
              z: this.input.z * (this.input.aim ? 0.65 : 1),
            },
            dt,
          ),
        )
        if (this.input.fire) this.fire(actor, this.input.yaw, this.input.pitch, this.input.aim)
      }
    }
  }
  drainEvents(): GameEvent[] {
    const events = this.events
    this.events = []
    return events
  }
}
