import type { Position } from './index.js'
import type { WorldGeometry } from './urban-map.js'
import { worldHit } from './combat.js'
export const GRENADE_FUSE_MS = 2600
export const GRENADE_FLIGHT_MS = 1100
export const GRENADE_RADIUS = 7
export interface CampaignGrenade {
  sourceId: string
  start: Position
  target: Position
  remainingMs: number
}
export function grenadePosition(grenade: CampaignGrenade): Position {
  const t = Math.max(0, Math.min(1, (GRENADE_FUSE_MS - grenade.remainingMs) / GRENADE_FLIGHT_MS))
  return {
    x: grenade.start.x + (grenade.target.x - grenade.start.x) * t,
    y: grenade.start.y + (grenade.target.y + 0.12 - grenade.start.y) * t + 4 * 3 * t * (1 - t),
    z: grenade.start.z + (grenade.target.z - grenade.start.z) * t,
  }
}
/** Refuse throws whose arc crosses a wall or ceiling. */
export function clearGrenadeArc(grenade: CampaignGrenade, world: WorldGeometry): boolean {
  let previous = grenadePosition(grenade)
  for (let i = 1; i <= 20; i++) {
    const next = grenadePosition({
      ...grenade,
      remainingMs: GRENADE_FUSE_MS - (GRENADE_FLIGHT_MS * i) / 20,
    })
    const dx = next.x - previous.x,
      dy = next.y - previous.y,
      dz = next.z - previous.z,
      length = Math.hypot(dx, dy, dz)
    if (
      worldHit(previous, { x: dx / length, y: dy / length, z: dz / length }, length, world) <
      length - 0.02
    )
      return false
    previous = next
  }
  return true
}
export function grenadeDamage(
  target: Position,
  blast: Position,
  world: WorldGeometry,
  power = 45,
): number {
  const distance = Math.hypot(target.x - blast.x, target.y - blast.y, target.z - blast.z)
  if (distance >= GRENADE_RADIUS) return 0
  const origin = { ...blast, y: blast.y + 0.35 },
    dx = target.x - origin.x,
    dy = target.y + 1 - origin.y,
    dz = target.z - origin.z,
    length = Math.hypot(dx, dy, dz)
  if (
    length > 0.01 &&
    worldHit(origin, { x: dx / length, y: dy / length, z: dz / length }, length, world) <
      length - 0.02
  )
    return 0
  return Math.round(power * (1 - distance / GRENADE_RADIUS))
}

export interface PlayerGrenade extends Position {
  id: string
  sourceId: string
  vx: number
  vy: number
  vz: number
  remainingMs: number
}
export const PLAYER_GRENADES = 2
/** Axis sweeps keep fast throws out of walls and ceilings; collisions lose energy. */
export function stepPlayerGrenade(g: PlayerGrenade, world: WorldGeometry, dt: number): void {
  const seconds = dt / 1000
  g.vy -= 12 * seconds
  for (const [axis, velocity] of [
    ['x', 'vx'],
    ['z', 'vz'],
    ['y', 'vy'],
  ] as const) {
    const delta = g[velocity] * seconds,
      length = Math.abs(delta)
    if (length < 0.00001) continue
    const ray = { x: 0, y: 0, z: 0 }
    ray[axis] = Math.sign(delta)
    const hit = worldHit(g, ray, length + 0.12, world),
      travel = Math.max(0, Math.min(length, hit - 0.12))
    g[axis] += Math.sign(delta) * travel
    if (travel < length - 0.0001) {
      g[velocity] *= -0.3
      if (axis === 'y') {
        g.vx *= 0.72
        g.vz *= 0.72
        if (Math.abs(g.vy) < 0.5) g.vy = 0
      }
    }
  }
  g.remainingMs -= dt
}
