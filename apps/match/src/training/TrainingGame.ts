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
import { findPath, NAV_POINTS } from './navigation.js'

interface BotMemory {
  path: Position[]
  nextPlan: number
  targetId?: string
  lastSeen?: Position
  seenAt?: number
  reactAt?: number
  nextShot?: number
  burstLeft?: number
  aimYaw?: number
  aimPitch?: number
  nextScan?: number
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
    readonly mode: 'training' | 'solo' = 'training',
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
    const safety = (point: Position) => separation(point) + (this.mode === 'solo'
      ? others.filter(other => other.health > 0 && worldHit(
        { x: other.x, y: other.y + EYE_HEIGHT, z: other.z },
        direction(Math.atan2(point.x - other.x, point.z - other.z),
          -Math.atan2(point.y + 1.1 - other.y - EYE_HEIGHT, Math.hypot(point.x - other.x, point.z - other.z))),
      ) < Math.hypot(point.x - other.x, point.z - other.z) - 0.5).length * 6
      : 0)
    const ranked = [...pool].sort((a, b) => safety(b) - safety(a))
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
      Object.assign(memory, { path: [], nextPlan: 0, targetId: undefined, lastSeen: undefined,
        seenAt: undefined, reactAt: undefined, nextShot: undefined, burstLeft: 0, nextScan: 0 })
    }
  }
  fire(actor: Combatant, yaw: number, pitch: number, aiming = false): boolean {
    const cadence = RIFLE.intervalMs
    if (
      this.phase !== 'playing' ||
      (actor.bot && this.mode === 'training') ||
      (this.mode === 'solo' && actor.protectedUntil > this.elapsed) ||
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
    if (this.mode === 'solo') {
      this.combatBotStep(bot, dt)
      return
    }
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

  private canSee(bot: Combatant, target: Position): boolean {
    const dx = target.x - bot.x, dz = target.z - bot.z
    const distance = Math.hypot(dx, dz)
    if (distance > 44) return false
    const yaw = Math.atan2(dx, dz)
    const angle = Math.atan2(Math.sin(yaw - bot.yaw), Math.cos(yaw - bot.yaw))
    if (Math.abs(angle) > 1.25 && this.elapsed - bot.lastDamage > 1200) return false
    const ray = direction(yaw, -Math.atan2(target.y + 1.1 - bot.y - EYE_HEIGHT, distance))
    return worldHit({ x: bot.x, y: bot.y + EYE_HEIGHT, z: bot.z }, ray) >
      Math.hypot(dx, dz, target.y + 1.1 - bot.y - EYE_HEIGHT) - 0.4
  }
  private combatBotStep(bot: Combatant, dt: number) {
    const memory = this.memories.get(bot.id)!
    if (this.elapsed - bot.lastDamage < 300) return
    if (bot.ammo === 0) this.reload(bot.id)
    if (this.elapsed >= (memory.nextScan ?? 0)) {
      const candidates = [...this.actors.values()].filter((actor) =>
        actor.id !== bot.id && actor.health > 0 && actor.protectedUntil <= this.elapsed && this.canSee(bot, actor))
      candidates.sort((a, b) =>
        Math.hypot(a.x - bot.x, a.z - bot.z) * (a.id === memory.targetId ? 0.75 : 1) -
        Math.hypot(b.x - bot.x, b.z - bot.z) * (b.id === memory.targetId ? 0.75 : 1))
      const target = candidates[0]
      if (target) {
        if (target.id !== memory.targetId) {
          memory.reactAt = this.elapsed + 450 + this.random() * 250
          memory.burstLeft = 0
          memory.nextShot = memory.reactAt
        }
        memory.targetId = target.id
        memory.lastSeen = { x: target.x, y: target.y, z: target.z }
        memory.seenAt = this.elapsed
      } else memory.targetId = undefined
      memory.nextScan = this.elapsed + 180
    }
    const target = memory.targetId ? this.actors.get(memory.targetId) : undefined
    const visible = target && target.health > 0 && target.protectedUntil <= this.elapsed && this.canSee(bot, target)
    let destination: Position | undefined
    if (visible) {
      const dx = target.x - bot.x, dz = target.z - bot.z, distance = Math.hypot(dx, dz)
      const wanted = Math.atan2(dx, dz)
      const delta = Math.atan2(Math.sin(wanted - bot.yaw), Math.cos(wanted - bot.yaw))
      bot.yaw += Math.max(-dt * 0.0025, Math.min(dt * 0.0025, delta))
      bot.pitch = -Math.atan2(target.y + 1.1 - bot.y - EYE_HEIGHT, distance)
      if (this.elapsed >= (memory.reactAt ?? Infinity) && !bot.reloadUntil &&
          Math.abs(delta) < 0.12 && this.elapsed >= (memory.nextShot ?? 0)) {
        if (!memory.burstLeft) {
          memory.burstLeft = 3 + Math.floor(this.random() * 3)
          memory.aimYaw = (this.random() - 0.5) * 0.045
          memory.aimPitch = (this.random() - 0.5) * 0.025
        }
        if (this.fire(bot, bot.yaw + (memory.aimYaw ?? 0), bot.pitch + (memory.aimPitch ?? 0), true)) {
          memory.burstLeft--
          memory.nextShot = this.elapsed + (memory.burstLeft ? 270 : 650 + this.random() * 400)
        }
      }
      if (bot.reloadUntil || bot.health < 45) {
        // Seek nearby geometry that breaks the opponent's line of sight while recovering.
        const cover = NAV_POINTS.filter((point) => Math.hypot(point.x - bot.x, point.z - bot.z) < 12 &&
          Math.abs(point.y - bot.y) < 0.5 &&
          worldHit({ x: target.x, y: target.y + EYE_HEIGHT, z: target.z },
            direction(Math.atan2(point.x - target.x, point.z - target.z),
              -Math.atan2(point.y + 1.1 - target.y - EYE_HEIGHT, Math.hypot(point.x - target.x, point.z - target.z)))) <
            Math.hypot(point.x - target.x, point.z - target.z) - 0.5)
        cover.sort((a, b) => Math.hypot(a.x - bot.x, a.z - bot.z) - Math.hypot(b.x - bot.x, b.z - bot.z))
        destination = cover[0]
      } else if (distance > 17) destination = memory.lastSeen
      else if (!memory.burstLeft) {
        const side = Number(bot.id.slice(-1)) % 2 ? 1 : -1
        Object.assign(bot, move(bot, { x: Math.cos(bot.yaw) * side * 0.2, z: -Math.sin(bot.yaw) * side * 0.2 }, dt))
      }
    } else if (memory.lastSeen && this.elapsed - (memory.seenAt ?? 0) < 2500) {
      destination = memory.lastSeen
    } else if (!memory.path.length || this.elapsed >= memory.nextPlan) {
      destination = NAV_POINTS[Math.floor(this.random() * NAV_POINTS.length)]
    }
    if (destination && (this.elapsed >= memory.nextPlan || !memory.path.length)) {
      memory.path = findPath(bot, destination)
      memory.nextPlan = this.elapsed + (visible ? 1000 : 4000)
    }
    const waypoint = memory.path[0]
    if (waypoint && (!visible || destination)) {
      const dx = waypoint.x - bot.x, dz = waypoint.z - bot.z, distance = Math.hypot(dx, dz)
      if (distance < 0.3) memory.path.shift()
      else {
        if (!visible) {
          const delta = Math.atan2(Math.sin(Math.atan2(dx, dz) - bot.yaw), Math.cos(Math.atan2(dx, dz) - bot.yaw))
          bot.yaw += Math.max(-dt * 0.0025, Math.min(dt * 0.0025, delta))
          bot.pitch *= 0.9
        }
        Object.assign(bot, move(bot, { x: dx / distance * 0.34, z: dz / distance * 0.34 }, dt))
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
