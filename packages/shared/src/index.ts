export const ROOM_NAME = 'training'
export const TICK_MS = 1000 / 30
export const MOVE_SPEED = 6
export const ARENA_LIMIT = 18
export const INPUT_TIMEOUT_MS = 250
export interface MoveInput { x: number; z: number }
export interface Position { x: number; z: number }

export function parseInput(value: unknown): MoveInput | null {
  if (typeof value !== 'object' || value === null || !('x' in value) || !('z' in value)) return null
  const { x, z } = value
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null
  if (Math.abs(x) > 1 || Math.abs(z) > 1) return null
  const length = Math.max(1, Math.hypot(x, z))
  return { x: x / length, z: z / length }
}

export function move(position: Position, input: MoveInput, dt: number): Position {
  const seconds = Math.max(0, Math.min(dt, TICK_MS)) / 1000
  const clamp = (n: number) => Math.max(-ARENA_LIMIT, Math.min(ARENA_LIMIT, n))
  return { x: clamp(position.x + input.x * MOVE_SPEED * seconds), z: clamp(position.z + input.z * MOVE_SPEED * seconds) }
}
