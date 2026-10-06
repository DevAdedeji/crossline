import test from 'node:test'
import assert from 'node:assert/strict'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.ts'
import {
  RIFLE,
  aimedTarget,
  parseCombatInput,
  rayBox,
  sight,
  TRAINING_SPAWNS,
} from '../packages/shared/src/combat.ts'
import { isBlocked, TICK_MS } from '../packages/shared/src/index.ts'
import { findPath } from '../apps/match/src/training/navigation.ts'
const setup = () => {
  const game = new TrainingGame('human', 180000, () => 0.5)
  game.start()
  game.elapsed = 2000
  for (const a of game.actors.values()) a.protectedUntil = 0
  return game
}
const advance = (game: TrainingGame, ms: number) => {
  for (let t = 0; t < ms; t += TICK_MS) game.step()
}
test('combat input rejects forged types, infinite angles and excessive motion', () => {
  for (const raw of [
    { x: 10, z: 0, yaw: 0, pitch: 0, fire: true, aim: false },
    { x: 0, z: 0, yaw: Infinity, pitch: 0, fire: true, aim: false },
    { x: 0, z: 0, yaw: 0, pitch: 2, fire: true, aim: false },
    { x: 0, z: 0, yaw: 0, pitch: 0, fire: 'yes', aim: false },
  ])
    assert.equal(parseCombatInput(raw), null)
  assert.ok(parseCombatInput({ x: 1, z: 1, yaw: Math.PI * 8, pitch: 0, fire: true, aim: false }))
})
test('rays hit solid cover, pass doors and respect ramp wedge', () => {
  assert.equal(
    rayBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 5 }, { x: 1, y: 2, z: 6 }),
    5,
  )
  assert.equal(sight({ x: -3, y: 1.2, z: -16 }, { x: -3, y: 1.2, z: -9 }), false)
  assert.equal(sight({ x: -12, y: 1.6, z: 11 }, { x: -3, y: 1.6, z: 11 }), true)
  assert.equal(sight({ x: -12, y: 1.6, z: 9 }, { x: -3, y: 1.6, z: 9 }), false)
  assert.equal(sight({ x: -24, y: 1, z: 14 }, { x: -17, y: 1, z: 14 }), false)
})
test('server enforces cadence, head damage, death, ammo, reload and respawn', () => {
  const game = setup(),
    human = game.actors.get('human')!,
    victim = game.actors.get('bot-0')!
  for (const [id] of game.actors) if (id !== 'human' && id !== 'bot-0') game.actors.delete(id)
  Object.assign(human, { x: 0, y: 0, z: -21 })
  Object.assign(victim, { x: 0, y: 0, z: -17 })
  assert.equal(game.fire(human, 0, 0, true), true)
  assert.equal(victim.health, 50)
  assert.equal(game.fire(human, 0, 0, true), false)
  assert.equal(human.ammo, 23)
  game.elapsed += RIFLE.intervalMs
  game.fire(human, 0, 0, true)
  assert.equal(victim.health, 0)
  assert.equal(human.kills, 1)
  assert.equal(victim.deaths, 1)
  assert.equal(game.fire(victim, 0, 0), false)
  assert.equal(game.reload('human'), true)
  assert.equal(game.reload('human'), false)
  assert.equal(game.fire(human, 0, 0), false)
  advance(game, 1650)
  assert.equal(human.ammo, 24)
  assert.equal(human.reloadUntil, 0)
  advance(game, 1500)
  assert.ok(victim.health > 0)
  assert.ok(victim.protectedUntil > game.elapsed)
  assert.ok(game.drainEvents().some((e) => e.type === 'spawn'))
  assert.equal(game.drainEvents().length, 0)
})
test('occlusion prevents damage, protection absorbs hits and empty weapons cannot fire', () => {
  const game = setup(),
    human = game.actors.get('human')!,
    victim = game.actors.get('bot-0')!
  Object.assign(human, { x: -3, y: 0, z: -16 })
  Object.assign(victim, { x: -3, y: 0, z: -9 })
  game.fire(human, 0, 0.1, true)
  assert.equal(victim.health, 100)
  Object.assign(human, { x: 0, z: -21, lastShot: 0 })
  Object.assign(victim, { x: 0, z: -17, protectedUntil: 99999 })
  game.fire(human, 0, 0, true)
  assert.equal(victim.health, 100)
  human.ammo = 0
  game.elapsed += 1000
  assert.equal(game.fire(human, 0, 0), false)
})
test('pause freezes all simulation; timer finishes and replay resets all statistics', () => {
  const game = setup()
  advance(game, 100)
  game.pause()
  const snapshot = JSON.stringify([...game.actors.values()]),
    time = game.elapsed
  advance(game, 1000)
  assert.equal(game.elapsed, time)
  assert.equal(JSON.stringify([...game.actors.values()]), snapshot)
  game.start()
  game.elapsed = game.durationMs - 10
  game.step()
  assert.equal(game.phase, 'finished')
  assert.equal(game.elapsed, game.durationMs)
  game.restart()
  assert.equal(game.phase, 'ready')
  assert.equal(game.round, 2)
  assert.equal(game.elapsed, 0)
  assert.equal(game.actors.get('human')!.ammo, 24)
})
test('Training patrols move but never fire at the player or other targets', () => {
  const game = setup(),
    start = game.actors.get('bot-1')!.z
  advance(game, 1000)
  assert.notEqual(game.actors.get('bot-1')!.z, start)
  advance(game, 120000)
  for (const actor of game.actors.values()) {
    assert.equal(actor.health, 100)
    assert.equal(actor.shots, 0)
    assert.equal(actor.deaths, 0)
    if (actor.bot) assert.equal(game.fire(actor, 0, 0), false)
  }
  assert.equal(game.drainEvents().length, 0)
})
test('patrol flinch stops locomotion and resumes its route after recovery', () => {
  const game = setup(),
    bot = game.actors.get('bot-1')!
  bot.lastDamage = game.elapsed
  const before = { x: bot.x, z: bot.z }
  advance(game, 300)
  assert.equal(bot.x, before.x)
  assert.equal(bot.z, before.z)
  advance(game, 1000)
  assert.ok(Math.hypot(bot.x - before.x, bot.z - before.z) > 0.2)
})
test('all training spawns clear map geometry and navigation connects an interior', () => {
  for (const spawn of TRAINING_SPAWNS) assert.equal(isBlocked(spawn), false, JSON.stringify(spawn))
  assert.ok(findPath({ x: 0, y: 0, z: -21 }, { x: -12, y: 0, z: 11 }).length > 0)
})

test('training keeps three targets stationary while patrols walk without pursuit', () => {
  const game = setup(),
    targets = ['bot-0', 'bot-2', 'bot-4']
  for (const id of targets) game.actors.get(id)!.protectedUntil = 999999
  const original = targets.map((id) => ({ ...game.actors.get(id)! }))
  advance(game, 20000)
  targets.forEach((id, i) => {
    const actor = game.actors.get(id)!
    assert.equal(actor.x, original[i]!.x)
    assert.equal(actor.z, original[i]!.z)
    assert.equal(actor.shots, 0)
  })
  const walker = game.actors.get('bot-1')!
  assert.notEqual(walker.z, 7)
  const before = { x: walker.x, z: walker.z }
  game.step()
  assert.ok(Math.hypot(walker.x - before.x, walker.z - before.z) <= 0.033)
})

test('repeated bot respawns move to unoccupied collision-free positions', () => {
  const game = setup(),
    bot = game.actors.get('bot-0')!
  let previous = { ...bot }
  const seen = new Set<string>()
  for (let i = 0; i < 6; i++) {
    bot.health = 0
    bot.respawnUntil = game.elapsed
    game.step()
    assert.equal(bot.health, 100)
    assert.equal(isBlocked(bot), false)
    assert.ok(Math.hypot(bot.x - previous.x, bot.z - previous.z) > 4)
    for (const other of game.actors.values())
      if (other.id !== bot.id)
        assert.ok(Math.hypot(bot.x - other.x, bot.z - other.z) + Math.abs(bot.y - other.y) * 3 > 2)
    seen.add(`${bot.x}/${bot.y}/${bot.z}`)
    previous = { ...bot }
  }
  assert.ok(seen.size >= 4)
})

test('target hint respects nearest living actors, cover, range, protection and rear/side approaches', () => {
  const game = setup(),
    bot = game.actors.get('bot-0')!
  Object.assign(bot, { x: 0, y: 0, z: -17, yaw: 0 })
  const origin = { x: 0, y: 1.6, z: -21 },
    ray = { x: 0, y: 0, z: 1 }
  assert.equal(aimedTarget(origin, ray, [bot], 'human', game.elapsed), bot.id)
  assert.equal(
    aimedTarget({ x: 4, y: 1.6, z: -17 }, { x: -1, y: 0, z: 0 }, [bot], 'human', game.elapsed),
    bot.id,
  )
  assert.equal(aimedTarget(origin, ray, [bot], 'human', game.elapsed, 2), undefined)
  bot.health = 0
  assert.equal(aimedTarget(origin, ray, [bot], 'human', game.elapsed), undefined)
  bot.health = 100
  bot.protectedUntil = 99999
  assert.equal(aimedTarget(origin, ray, [bot], 'human', game.elapsed), undefined)
  bot.protectedUntil = 0
  const nearer = { ...bot, id: 'other-player', z: -19 }
  assert.equal(aimedTarget(origin, ray, [bot, nearer], 'human', game.elapsed), nearer.id)
  Object.assign(bot, { x: -3, z: 9 })
  assert.equal(
    aimedTarget({ x: -12, y: 1.6, z: 9 }, { x: 1, y: 0, z: 0 }, [bot], 'human', game.elapsed),
    undefined,
  )
})
test('stationary target heading stays assigned when the player moves around it', () => {
  const game = setup(),
    bot = game.actors.get('bot-0')!,
    human = game.actors.get('human')!,
    yaw = bot.yaw
  for (const [x, z] of [
    [2, -5],
    [-4, -5],
    [-1, -1],
    [-1, -10],
  ]) {
    Object.assign(human, { x, z })
    advance(game, 400)
    assert.equal(bot.yaw, yaw)
  }
})
