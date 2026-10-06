import test from 'node:test'
import assert from 'node:assert/strict'
import { CampaignGame } from '../packages/shared/src/simulation/CampaignGame.js'
import {
  clearGrenadeArc,
  grenadeDamage,
  GRENADE_FUSE_MS,
} from '../packages/shared/src/campaignGrenades.js'
import { TICK_MS, type WorldGeometry } from '../packages/shared/src/index.js'
const empty: WorldGeometry = {
  id: 'blast-test',
  name: 'TEST',
  limit: 40,
  buildings: [],
  solids: [],
  cars: [],
  colliders: [],
  roadCenters: [],
  legacyRamp: false,
}
const run = (game: CampaignGame, ms: number) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) game.step()
}
test('Grenade damage falls off with distance and solid cover blocks it', () => {
  assert.equal(grenadeDamage({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, empty), 45)
  assert.equal(grenadeDamage({ x: 8, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, empty), 0)
  assert.ok(grenadeDamage({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, empty) < 20)
  const wall = {
    id: 'wall',
    x: 2,
    y: 2,
    z: 0,
    width: 0.5,
    height: 4,
    depth: 12,
    material: 'concrete' as const,
  }
  assert.equal(
    grenadeDamage({ x: 4, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { ...empty, colliders: [wall] }),
    0,
  )
  const grenade = {
    sourceId: 'bot-0',
    start: { x: 0, y: 1.5, z: 0 },
    target: { x: 4, y: 0, z: 0 },
    remainingMs: GRENADE_FUSE_MS,
  }
  assert.equal(clearGrenadeArc(grenade, empty), true)
  assert.equal(clearGrenadeArc(grenade, { ...empty, colliders: [{ ...wall, height: 12 }] }), false)
})
test('Campaign guards throw with a fuse, pause freezes it, and moving away avoids the blast', () => {
  const game = new CampaignGame('human', undefined, () => 0.5),
    human = game.actors.get('human')!,
    guard = game.actors.get('bot-0')!
  for (const bot of game.actors.values()) if (bot.bot && bot !== guard) bot.health = 0
  Object.assign(human, { x: 0, y: 0, z: -30, protectedUntil: 0 })
  Object.assign(guard, { x: 0, y: 0, z: -15, yaw: Math.PI, ammo: 0, reloadUntil: 100000 })
  game.start()
  run(game, 10500)
  assert.equal(game.campaign.grenades.length, 1)
  assert.ok(game.campaign.grenades[0]!.remainingMs > 1500)
  assert.equal(human.health, 100)
  game.pause()
  const remaining = game.campaign.grenades[0]!.remainingMs
  run(game, 4000)
  assert.equal(game.campaign.grenades[0]!.remainingMs, remaining)
  Object.assign(human, { x: 8, z: -30 })
  game.start()
  run(game, 4000)
  assert.equal(human.health, 100)
  assert.equal(game.campaign.grenades.length, 0)
})
test('A grenade detonates once, respects protection and clears on retry', () => {
  for (const protectedUntil of [0, 4000]) {
    const game = new CampaignGame('human'),
      human = game.actors.get('human')!
    for (const bot of game.actors.values()) if (bot.bot) bot.health = 0
    Object.assign(human, { x: 0, y: 0, z: -30, protectedUntil })
    game.campaign.grenades.push({
      sourceId: 'bot-0',
      start: { x: 0, y: 1, z: -30 },
      target: { x: 0, y: 0, z: -30 },
      remainingMs: 10,
    })
    game.start()
    run(game, 500)
    assert.equal(human.health, protectedUntil ? 100 : 55)
    assert.equal(game.campaign.grenades.length, 0)
    assert.equal(game.drainEvents().filter((event) => event.type === 'explosion').length, 1)
    game.finish()
    game.restart()
    assert.equal(game.campaign.grenades.length, 0)
  }
})
