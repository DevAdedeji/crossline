import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COMBAT_WORLD,
  isBlocked,
  SOLO_HEALTH_PACKS,
  raySolids,
} from '../packages/shared/src/index.ts'
import { CITY_ROOFS, CITY_BUILDINGS } from '../packages/shared/src/city-expansion.ts'
import { rayBox } from '../packages/shared/src/combat.ts'
import { getNavigation } from '../apps/match/src/training/navigation.ts'

test('all new city roofs and district supplies have collision-checked walking routes', async () => {
  const nav = getNavigation(COMBAT_WORLD)
  await nav.precompute()
  assert.equal(CITY_BUILDINGS.length, 144)
  assert.ok(Math.abs(Math.max(...CITY_ROOFS.map((p) => p.y)) - 19.2) < 1e-8)
  assert.equal(SOLO_HEALTH_PACKS.length, 83)
  const start = { x: 0, y: 0, z: -21 }
  for (const goal of [...CITY_ROOFS, ...SOLO_HEALTH_PACKS]) {
    assert.ok(!isBlocked(goal, COMBAT_WORLD))
    const path = nav.findPath(start, goal)
    assert.ok(
      nav.canWalk(path.at(-1)!, goal),
      `cannot reach ${JSON.stringify(goal)}, path ends ${JSON.stringify(path.at(-1))}`,
    )
    assert.ok(nav.canWalk(start, path[0]!))
    for (let i = 1; i < path.length; i++) assert.ok(nav.canWalk(path[i - 1]!, path[i]!))
  }
})
test('spatial shot candidates match exhaustive collision across random, vertical and grid-boundary rays', () => {
  let seed = 813
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < 4000; i++) {
    const span = COMBAT_WORLD.limit * 2 + 20
    const origin = {
      x: i % 5 === 0 ? Math.floor(((rand() - 0.5) * span) / 8) * 8 : (rand() - 0.5) * span,
      y: rand() * 24,
      z: (rand() - 0.5) * span,
    }
    const yaw = rand() * Math.PI * 2,
      pitch = (rand() - 0.5) * Math.PI,
      ray =
        i % 20 === 0
          ? { x: 0, y: -1, z: 0 }
          : {
              x: Math.sin(yaw) * Math.cos(pitch),
              y: Math.sin(pitch),
              z: Math.cos(yaw) * Math.cos(pitch),
            },
      range = 80
    const hit = (boxes: typeof COMBAT_WORLD.colliders) => {
      let nearest = range
      for (const b of boxes) {
        const d = rayBox(
          origin,
          ray,
          { x: b.x - b.width / 2, y: b.y - b.height / 2, z: b.z - b.depth / 2 },
          { x: b.x + b.width / 2, y: b.y + b.height / 2, z: b.z + b.depth / 2 },
          nearest,
        )
        if (d !== null) nearest = Math.min(nearest, d)
      }
      return nearest
    }
    assert.equal(
      hit(raySolids(COMBAT_WORLD, origin, ray, range)),
      hit(COMBAT_WORLD.colliders),
      `ray ${i}`,
    )
  }
})

for (const target of [
  { x: 112, z: 91 },
  { x: 224, z: 203 },
])
  test(`Solo bots reach and engage a human in district ${target.x}/${target.z} without moving bot spawns`, async () => {
    const { TrainingGame } = await import('../apps/match/src/training/TrainingGame.ts')
    await getNavigation(COMBAT_WORLD).precompute()
    let seed = 44
    const game = new TrainingGame(
      'human',
      300000,
      () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296,
      'solo',
    )
    Object.assign(game.actors.get('human')!, { ...target, y: 0 })
    game.start()
    let shots = 0,
      damage = 0
    for (let i = 0; i < 5400; i++) {
      game.step()
      for (const event of game.drainEvents()) {
        if (
          event.type === 'shot' &&
          Math.hypot(event.start.x - target.x, event.start.z - target.z) < 50
        )
          shots++
        if (event.type === 'damage' && event.targetId === 'human') damage++
      }
    }
    assert.ok(shots > 0, 'bots arrive and fire in the outer district')
    assert.ok(damage > 0, 'the human receives authoritative combat damage')
  })
