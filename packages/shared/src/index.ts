import { TRAINING_WORLD, nearbySolids, RAMP, rampHeight, type Solid, type WorldGeometry } from './urban-map.ts'
export * from './urban-map.ts'
export * from './combat-map.ts'
export * from './landmarks.ts'
export * from './stance.ts'
export * from './solo.ts'

export const ROOM_NAME = 'training'
export const TICK_MS = 1000 / 30
export const MOVE_SPEED = 6
export const ARENA_LIMIT = 26
export const INPUT_TIMEOUT_MS = 250
export interface MoveInput { x: number; z: number }
export interface Position { x: number; y: number; z: number }
export const PLAYER_RADIUS = 0.36
export const PLAYER_HEIGHT = 1.75
const STEP_HEIGHT = 0.24

export function parseInput(value: unknown): MoveInput | null {
  if (typeof value !== 'object' || value === null || !('x' in value) || !('z' in value)) return null
  const { x, z } = value
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null
  if (Math.abs(x) > 1 || Math.abs(z) > 1) return null
  const length = Math.max(1, Math.hypot(x, z))
  return { x: x / length, z: z / length }
}

function overlapsFootprint(x: number, z: number, solid: Solid): boolean {
  const nearestX = Math.max(solid.x - solid.width / 2, Math.min(solid.x + solid.width / 2, x))
  const nearestZ = Math.max(solid.z - solid.depth / 2, Math.min(solid.z + solid.depth / 2, z))
  return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < PLAYER_RADIUS ** 2 - 0.000001
}
function onRamp(x: number, z: number): boolean {
  return x >= RAMP.minX && x <= RAMP.maxX && z >= RAMP.minZ && z <= RAMP.maxZ
}
function supportHeight(position: Position, world: WorldGeometry): number {
  let height = 0
  for (const solid of nearbySolids(world, position.x, position.z)) {
    const top = solid.y + solid.height / 2
    if (top <= position.y + STEP_HEIGHT && top > height && overlapsFootprint(position.x, position.z, solid)) height = top
  }
  if (onRamp(position.x, position.z)) {
    const ramp = rampHeight(position.z)
    if (ramp <= position.y + STEP_HEIGHT) height = Math.max(height, ramp)
  }
  return height
}
export function isBlocked(position: Position, world: WorldGeometry = TRAINING_WORLD, height = PLAYER_HEIGHT): boolean {
  for (const solid of nearbySolids(world, position.x, position.z)) {
    if (position.y >= solid.y + solid.height / 2 - 0.0001 || position.y + height <= solid.y - solid.height / 2 + 0.0001) continue
    if (overlapsFootprint(position.x, position.z, solid)) return true
  }
  // The ramp is solid below its sloped surface, so it cannot be entered sideways at height.
  const rampX = Math.max(RAMP.minX, Math.min(RAMP.maxX, position.x))
  const rampZ = Math.max(RAMP.minZ, Math.min(RAMP.maxZ, position.z))
  const touchesRamp = (position.x - rampX) ** 2 + (position.z - rampZ) ** 2 < PLAYER_RADIUS ** 2 - 0.000001
  if (touchesRamp && position.y < rampHeight(rampZ) - 0.001) return true
  return false
}
export function move(position: Position, input: MoveInput, dt: number, world: WorldGeometry = TRAINING_WORLD, height = PLAYER_HEIGHT): Position {
  const seconds = Math.max(0, Math.min(dt, TICK_MS)) / 1000
  const clamp = (n: number) => Math.max(-world.limit, Math.min(world.limit, n))
  let next = { x: position.x, y: position.y, z: position.z }
  // Axis-separated resolution allows wall sliding; max movement is 0.2 m/tick.
  for (const axis of ['x', 'z'] as const) {
    const candidate = { ...next, [axis]: clamp(next[axis] + input[axis] * MOVE_SPEED * seconds) }
    const support = supportHeight(candidate, world)
    candidate.y = Math.max(candidate.y, support)
    if (!isBlocked(candidate, world, height)) next = candidate
  }
  // Gravity continues after input times out; stepped-off roofs cannot leave players hovering.
  next.y = Math.max(supportHeight(next, world), next.y - 9 * seconds)
  return next
}

/** Radial deadzone preserves direction and scales the remaining stick range. */
export function readStick(x = 0, y = 0): { x: number; y: number } {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 }
  const length = Math.hypot(x, y)
  const deadzone = 0.18
  if (length <= deadzone) return { x: 0, y: 0 }
  const magnitude = (Math.min(length, 1) - deadzone) / (1 - deadzone)
  return { x: x / length * magnitude, y: y / length * magnitude }
}

export * from './leaderboard.ts'
export * from './nameVisibility.ts'

/** Configured admission ceiling; simultaneous-player performance requires load validation. */
export const ONLINE_CAPACITY_TARGET = 100
