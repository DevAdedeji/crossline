import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { postgresGuestRepository } from '../packages/db/src/server.ts'
import * as schema from '../packages/db/src/schema.ts'
import { GuestStore, memoryGuestRepository } from '../apps/match/src/online/GuestStore.ts'
import { nameVisible, COMBAT_WORLD } from '../packages/shared/src/index.ts'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.ts'
const { drizzle } = createRequire(new URL('../packages/db/package.json', import.meta.url))(
  'drizzle-orm/pglite',
)
test('guest identities cannot be claimed by nickname or forged token; temporary totals deduplicate events', async () => {
  const repo = memoryGuestRepository(),
    store = new GuestStore(repo)
  const a = await store.identify(undefined, 'SAME'),
    b = await store.identify(undefined, 'SAME')
  assert.notEqual(a.id, b.id)
  assert.notEqual(a.displayName, b.displayName)
  assert.equal((await store.identify(a.token, 'IMPERSONATOR')).id, a.id)
  assert.notEqual((await store.identify('a'.repeat(64), 'SAME')).id, a.id)
  const id = randomUUID()
  assert.equal(await repo.record(id, a.id, b.id), true)
  assert.equal(await repo.record(id, a.id, b.id), false)
  assert.equal(await repo.record(randomUUID(), a.id, a.id), false)
  const board = await store.leaderboard()
  assert.equal(board.durable, false)
  assert.equal(board.topKills[0]!.kills, 1)
  assert.equal(board.topDeaths[0]!.deaths, 1)
  assert.notEqual(
    board.topKills.find((r) => r.id === a.id),
    board.topDeaths.find((r) => r.id === a.id),
    'public rankings must not share object references',
  )
  assert.ok(!JSON.stringify(board).includes(a.token))
  assert.ok(!JSON.stringify(board).includes('tokenHash'))
})
test('PostgreSQL migrations and transactions persist guest totals across restart, reject duplicate kills and roll back partial events', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'crossline-stats-test-'))
  let database = new PGlite(directory)
  t.after(async () => {
    await database.close()
    await rm(directory, { recursive: true, force: true })
  })
  for (const file of (await readdir('packages/db/drizzle'))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await database.exec(await readFile(`packages/db/drizzle/${file}`, 'utf8'))
  const repo = postgresGuestRepository(drizzle(database, { schema })),
    store = new GuestStore(repo, true)
  const a = await store.identify(undefined, 'ALPHA'),
    b = await store.identify(undefined, 'BRAVO'),
    event = randomUUID()
  assert.equal(await repo.record(event, a.id, b.id), true)
  assert.equal(await repo.record(event, a.id, b.id), false)
  const failed = randomUUID()
  await assert.rejects(() => repo.record(failed, a.id, randomUUID()))
  assert.equal((await repo.leaders()).topKills[0]!.kills, 1)
  assert.equal(
    await repo.record(failed, b.id, a.id),
    true,
    'failed transaction leaves no consumed event ID',
  )
  await database.close()
  database = new PGlite(directory)
  const restored = new GuestStore(postgresGuestRepository(drizzle(database, { schema })), true)
  assert.equal((await restored.identify(a.token, 'NEW LABEL')).id, a.id)
  const board = await restored.leaderboard()
  assert.equal(board.durable, true)
  assert.equal(board.topKills.find((r) => r.id === a.id)!.kills, 1)
  assert.equal(board.topDeaths.find((r) => r.id === a.id)!.deaths, 1)
})
test('small player names obey range, death and authoritative wall occlusion', () => {
  const game = new TrainingGame('a', 0, () => 0.5, 'online')
  game.addHuman('a', 'ALPHA')
  game.enterHuman('a')
  const actor = game.actors.get('a')!
  Object.assign(actor, { x: 0, y: 0, z: -6, health: 100 })
  assert.equal(nameVisible({ x: 0, y: 1.6, z: -16 }, actor, COMBAT_WORLD), true)
  assert.equal(nameVisible({ x: 0, y: 1.6, z: -60 }, actor, COMBAT_WORLD), false)
  Object.assign(actor, { x: -14, z: -16 })
  assert.equal(nameVisible({ x: -14, y: 1.6, z: -20 }, actor, COMBAT_WORLD), false)
  actor.health = 0
  assert.equal(nameVisible({ x: -14, y: 1.6, z: -17 }, actor, COMBAT_WORLD), false)
})
