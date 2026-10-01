import { TRAINING_WORLD, RAMP, rampHeight, type WorldGeometry } from './urban-map.ts'
import { parseInput, type MoveInput, type Position } from './index.ts'

export const TRAINING = {
  durationMs: 180_000,
  botCount: 5,
  respawnMs: 3000,
  protectionMs: 1800,
  maxHealth: 100,
} as const
export const RIFLE = {
  name: 'CL-24 CARBINE',
  magazine: 24,
  intervalMs: 140,
  reloadMs: 1600,
  range: 80,
  damage: 25,
  headDamage: 50,
} as const
export const EYE_HEIGHT = 1.6
export type Phase = 'ready' | 'playing' | 'paused' | 'finished'
export interface CombatInput extends MoveInput {
  yaw: number
  pitch: number
  fire: boolean
  aim: boolean
}
export const IDLE_INPUT: CombatInput = { x: 0, z: 0, yaw: 0, pitch: 0, fire: false, aim: false }
export function parseCombatInput(value: unknown): CombatInput | null {
  const movement = parseInput(value)
  if (
    !movement ||
    !value ||
    typeof value !== 'object' ||
    !('yaw' in value) ||
    !('pitch' in value) ||
    !('fire' in value) ||
    !('aim' in value)
  )
    return null
  const { yaw, pitch, fire, aim } = value
  if (
    typeof yaw !== 'number' ||
    !Number.isFinite(yaw) ||
    Math.abs(yaw) > 1000 ||
    typeof pitch !== 'number' ||
    !Number.isFinite(pitch) ||
    Math.abs(pitch) > 1.45 ||
    typeof fire !== 'boolean' ||
    typeof aim !== 'boolean'
  )
    return null
  return { ...movement, yaw: yaw % (Math.PI * 2), pitch, fire, aim }
}
export interface Combatant extends Position {
  id: string
  name: string
  bot: boolean
  yaw: number
  pitch: number
  health: number
  ammo: number
  kills: number
  deaths: number
  score: number
  shots: number
  hits: number
  headshots: number
  reloadUntil: number
  respawnUntil: number
  protectedUntil: number
  lastShot: number
  lastDamage: number
}
export interface ShotEvent {
  type: 'shot'
  shooterId: string
  start: Position
  end: Position
  hitId: string
  damage: number
  headshot: boolean
  eliminated: boolean
}
export type GameEvent =
  | ShotEvent
  | { type: 'damage'; targetId: string; sourceId: string; damage: number; health: number }
  | { type: 'spawn'; actorId: string; yaw: number }
  | { type: 'kill'; killer: string; victim: string; humanKill: boolean }
export function direction(yaw: number, pitch: number): Position {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  }
}
export function rayBox(
  origin: Position,
  ray: Position,
  min: Position,
  max: Position,
  range: number = RIFLE.range,
): number | null {
  let near = 0
  let far = range
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(ray[axis]) < 0.000001) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null
      continue
    }
    const a = (min[axis] - origin[axis]) / ray[axis]
    const b = (max[axis] - origin[axis]) / ray[axis]
    near = Math.max(near, Math.min(a, b))
    far = Math.min(far, Math.max(a, b))
    if (near > far) return null
  }
  return near <= range && far >= 0 ? near : null
}
export function worldHit(origin: Position, ray: Position, range: number = RIFLE.range, world: WorldGeometry = TRAINING_WORLD): number {
  let distance = range
  for (const box of world.colliders) {
    const hit = rayBox(
      origin,
      ray,
      { x: box.x - box.width / 2, y: box.y - box.height / 2, z: box.z - box.depth / 2 },
      { x: box.x + box.width / 2, y: box.y + box.height / 2, z: box.z + box.depth / 2 },
      distance,
    )
    if (hit !== null) distance = Math.min(distance, hit)
  }
  if (ray.y < -0.000001) distance = Math.min(distance, Math.max(0, -origin.y / ray.y))
  // Ray/convex-wedge clipping includes the ramp's slope and side faces.
  let enter = 0
  let exit = distance
  const slope = RAMP.height / (RAMP.maxZ - RAMP.minZ)
  const planes: [Position, number][] = [
    [{ x: -1, y: 0, z: 0 }, -RAMP.minX],
    [{ x: 1, y: 0, z: 0 }, RAMP.maxX],
    [{ x: 0, y: 0, z: -1 }, -RAMP.minZ],
    [{ x: 0, y: 0, z: 1 }, RAMP.maxZ],
    [{ x: 0, y: -1, z: 0 }, 0],
    [{ x: 0, y: 1, z: -slope }, -slope * RAMP.minZ],
  ]
  let intersects = true
  for (const [normal, offset] of planes) {
    const numerator = offset - (normal.x * origin.x + normal.y * origin.y + normal.z * origin.z)
    const denominator = normal.x * ray.x + normal.y * ray.y + normal.z * ray.z
    if (Math.abs(denominator) < 0.000001) {
      if (numerator < 0) {
        intersects = false
        break
      }
      continue
    }
    const t = numerator / denominator
    if (denominator < 0) enter = Math.max(enter, t)
    else exit = Math.min(exit, t)
    if (enter > exit) {
      intersects = false
      break
    }
  }
  if (intersects && exit >= 0) distance = Math.min(distance, enter)
  return distance
}
export function sight(from: Position, to: Position): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const length = Math.hypot(dx, dy, dz)
  return (
    length < 0.01 ||
    worldHit(from, { x: dx / length, y: dy / length, z: dz / length }, length) >= length - 0.02
  )
}
export function actorHit(
  origin: Position,
  ray: Position,
  actor: Position,
  range: number,
): number | null {
  return rayBox(
    origin,
    ray,
    { x: actor.x - 0.36, y: actor.y, z: actor.z - 0.36 },
    { x: actor.x + 0.36, y: actor.y + 1.75, z: actor.z + 0.36 },
    range,
  )
}
export const TRAINING_SPAWNS: Position[] = [
  { x: 0, y: 0, z: -21 },
  { x: -1, y: 0, z: -5 },
  { x: 3, y: 0, z: 7 },
  { x: -12, y: 0, z: 11 },
  { x: 13, y: 0, z: 12 },
  { x: -12, y: 4.1, z: 11 },
  { x: -24, y: 0, z: 5 },
  { x: 15, y: 0, z: -6 },
  { x: 0, y: 0, z: 21 },
]
export { rampHeight }

/** Target hint uses the same bounded actor ray and world occlusion as server shots. */
export function aimedTarget(
  origin: Position,
  ray: Position,
  actors: readonly Combatant[],
  viewerId: string,
  elapsed: number,
  range: number = RIFLE.range,
  world: WorldGeometry = TRAINING_WORLD,
): string | undefined {
  let distance = worldHit(origin, ray, range, world)
  let nearest: Combatant | undefined
  for (const actor of actors) {
    if (actor.id === viewerId || actor.health <= 0) continue
    const hit = actorHit(origin, ray, actor, distance)
    if (hit !== null && hit < distance) {
      distance = hit
      nearest = actor
    }
  }
  return nearest && nearest.protectedUntil <= elapsed ? nearest.id : undefined
}
