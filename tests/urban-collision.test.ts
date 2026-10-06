import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  move,
  isBlocked,
  TICK_MS,
  PARKED_CARS,
  BUILDINGS,
  SPAWNS,
  ROOF_HEIGHT,
  type Position,
  type MoveInput,
} from '../packages/shared/src/index.ts'

function walk(start: Position, input: MoveInput, ticks: number): Position {
  let position = start
  for (let tick = 0; tick < ticks; tick++) {
    position = move(position, input, TICK_MS)
    assert.equal(isBlocked(position), false, `player penetrated map at ${JSON.stringify(position)}`)
  }
  return position
}
function to(start: Position, target: { x: number; z: number }): Position {
  let position = start
  for (let tick = 0; tick < 1500; tick++) {
    const dx = target.x - position.x
    const dz = target.z - position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 0.2) return position
    position = move(position, { x: dx / distance, z: dz / distance }, TICK_MS)
    assert.equal(isBlocked(position), false)
  }
  assert.fail(`route blocked at ${JSON.stringify(position)} en route to ${JSON.stringify(target)}`)
}

test('all spawn points have unobstructed player clearance', () => {
  for (const spawn of SPAWNS) assert.equal(isBlocked(spawn), false)
})
test('each parked car blocks traversal from the street', () => {
  for (const car of PARKED_CARS) {
    const zEdge = car.z - (car.sideways ? 1 : 2.25)
    const end = walk({ x: car.x, y: 0, z: zEdge - 2 }, { x: 0, z: 1 }, 60)
    assert.ok(end.z <= zEdge - 0.35)
    assert.ok(end.z >= zEdge - 0.6)
  }
})
test('solid walls stop players while each main doorway admits them', () => {
  for (const building of BUILDINGS) {
    const east = building.doors[0] === 'east'
    const direction = east ? -1 : 1
    const outsideX = building.x + (east ? 1 : -1) * (building.width / 2 + 2)
    const blocked = walk({ x: outsideX, y: 0, z: building.z - 2 }, { x: direction, z: 0 }, 40)
    assert.ok(Math.abs(blocked.x - building.x) > building.width / 2)
    const inside = to({ x: outsideX, y: 0, z: building.z }, { x: building.x, z: building.z })
    assert.ok(Math.abs(inside.x - building.x) < 0.2)
    assert.equal(inside.y, 0, 'entering an interior must not teleport onto its roof')
  }
})
test('a player can slide alongside cover without passing through it', () => {
  const end = walk({ x: -1.5, y: 0, z: -13 }, { x: -Math.SQRT1_2, z: Math.SQRT1_2 }, 30)
  assert.ok(end.z > -10)
  assert.equal(isBlocked(end), false)
})
test('the west alley and ramp form a continuous accessible rooftop route', () => {
  let position = SPAWNS[0]!
  for (const waypoint of [
    { x: -21, z: -22 },
    { x: -21, z: -20 },
    { x: -24, z: -20 },
    { x: -24, z: 5.2 },
    { x: -20, z: 5.2 },
    { x: -20, z: 15.4 },
    { x: -15, z: 15.3 },
    { x: -12, z: 11 },
  ])
    position = to(position, waypoint)
  assert.ok(Math.abs(position.y - ROOF_HEIGHT) < 0.001)
})
test('a high ramp side cannot be entered from street level', () => {
  const end = walk({ x: -24, y: 0, z: 13 }, { x: 1, z: 0 }, 40)
  assert.ok(end.x < -21.4)
  assert.equal(end.y, 0)
})
test('gravity resolves with zero movement input after stepping off elevation', () => {
  const end = walk({ x: -24, y: ROOF_HEIGHT, z: 0 }, { x: 0, z: 0 }, 30)
  assert.equal(end.y, 0)
})
