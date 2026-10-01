import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENA_LIMIT, MOVE_SPEED, TICK_MS, move, parseInput, readStick } from '../packages/shared/src/index.ts'

test('rejects malformed, non-finite and out-of-range network input', () => {
  for (const value of [null, {}, { x: NaN, z: 0 }, { x: Infinity, z: 0 }, { x: 2, z: 0 }, { x: '1', z: 0 }]) assert.equal(parseInput(value), null)
})
test('diagonal input cannot move faster than straight input', () => {
  const input = parseInput({ x: 1, z: 1 })!
  const next = move({ x: 0, y: 0, z: 0 }, input, TICK_MS)
  assert.ok(Math.abs(Math.hypot(next.x, next.z) - MOVE_SPEED * TICK_MS / 1000) < 0.00001)
})
test('movement remains inside the arena and simulation delta is bounded', () => {
  assert.equal(move({ x: ARENA_LIMIT, y: 0, z: 0 }, { x: 1, z: 0 }, TICK_MS).x, ARENA_LIMIT)
  assert.deepEqual(move({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 }, 5000), move({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 }, TICK_MS))
})

test('controller deadzone removes drift and bounds diagonal stick movement', () => {
  assert.deepEqual(readStick(0.1, 0.1), { x: 0, y: 0 })
  assert.deepEqual(readStick(NaN, 0), { x: 0, y: 0 })
  assert.deepEqual(readStick(1, 0), { x: 1, y: 0 })
  const diagonal = readStick(1, 1)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 0.00001)
})
