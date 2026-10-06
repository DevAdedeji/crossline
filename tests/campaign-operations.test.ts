import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMPAIGN_MISSIONS,
  activeCampaignTask,
  getCampaignMission,
  parseCampaignProgress,
} from '../packages/shared/src/campaign.js'
import { CampaignGame } from '../packages/shared/src/simulation/CampaignGame.js'
import { isBlocked, TICK_MS } from '../packages/shared/src/index.js'
import { getNavigation } from '../packages/shared/src/simulation/navigation.js'
const operations = CAMPAIGN_MISSIONS.filter((m) => m.tasks)
const run = (game: CampaignGame, ms: number) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) game.step()
}
function quiet(game: CampaignGame) {
  for (const actor of game.actors.values()) if (actor.bot) actor.health = 0
}
function gameAt(id: string, index = 0) {
  const m = getCampaignMission(id)
  const game = new CampaignGame(
    'human',
    {
      version: 1,
      missionId: id,
      checkpoint: 'relay',
      objectiveIndex: index,
      cleared: m.guards.map((_, i) => `bot-${i}`),
      completed: false,
    },
    () => 0.5,
    id,
  )
  game.start()
  return game
}
test('Campaign contains twenty uniquely named chapters and arenas with longer varied objective sequences', () => {
  assert.equal(CAMPAIGN_MISSIONS.length, 20)
  assert.equal(new Set(CAMPAIGN_MISSIONS.map((m) => m.id)).size, 20)
  assert.equal(new Set(CAMPAIGN_MISSIONS.map((m) => m.world.id)).size, 20)
  assert.equal(operations.length, 17)
  const geometry = operations.map((m) =>
    JSON.stringify(m.world.solids.map((s) => [s.x, s.y, s.z, s.width, s.height, s.depth])),
  )
  assert.equal(new Set(geometry).size, 17, 'Each new sector must have a distinct physical layout')
  for (const mission of operations) {
    assert.ok(mission.tasks!.length >= 5)
    assert.equal(mission.tasks!.at(-1)!.kind, 'extract')
  }
  assert.equal(new Set(operations.flatMap((m) => m.tasks!.map((t) => t.kind))).size, 7)
})
for (const mission of operations) {
  test(`${mission.title}: all spawn points, objective circles, checkpoint and escort routes are navigable`, () => {
    const points = [mission.spawn, ...mission.guards, ...mission.tasks!.map((t) => t.position)],
      nav = getNavigation(mission.world)
    for (const point of points)
      assert.equal(isBlocked(point, mission.world), false, JSON.stringify(point))
    let from = mission.spawn
    for (const task of mission.tasks!) {
      assert.ok(nav.findPath(from, task.position).length, `${task.title} is unreachable`)
      from = task.position
    }
  })
  test(`${mission.title}: complete every objective and preserve a checkpoint at each transition`, () => {
    const game = gameAt(mission.id),
      player = game.actors.get('human')!
    for (let index = 0; index < mission.tasks!.length; index++) {
      const task = mission.tasks![index]!
      assert.equal(game.campaign.operation!.index, index)
      quiet(game)
      Object.assign(player, task.position)
      if (game.campaign.following) Object.assign(game.campaign.captive, task.position)
      run(game, task.durationMs + 100)
      if (index < mission.tasks!.length - 1) {
        assert.equal(game.campaign.save.objectiveIndex, index + 1)
        const retry = new CampaignGame('retry', game.campaign.save, () => 0.5, mission.id)
        assert.equal(retry.campaign.operation!.index, index + 1)
        assert.equal(
          retry.campaign.following,
          mission.tasks!.slice(0, index + 1).some((t) => t.kind === 'rescue'),
        )
      }
    }
    assert.equal(game.campaign.outcome, 'success')
    assert.equal(game.campaign.save.completed, true)
    assert.equal(game.campaign.save.objectiveIndex, 0)
  })
}
test('A marked squad must be eliminated before its objective can complete', () => {
  const game = gameAt('blackout'),
    task = activeCampaignTask(game.campaign),
    player = game.actors.get('human')!,
    guard = game.actors.get(task.enemyIds![0]!)!
  Object.assign(player, task.position, { protectedUntil: 100000 })
  guard.health = 100
  Object.assign(guard, task.position)
  run(game, 2500)
  assert.equal(game.campaign.operation!.index, 0)
  assert.equal(game.campaign.operation!.enemiesRemaining, 1)
  guard.health = 0
  run(game, 1100)
  assert.equal(game.campaign.operation!.index, 1)
})
test('Defense is contested by nearby enemies, interrupted by leaving, and frozen while paused', () => {
  const game = gameAt('blackout', 3),
    task = activeCampaignTask(game.campaign),
    player = game.actors.get('human')!,
    guard = game.actors.get('bot-0')!
  Object.assign(player, task.position, { protectedUntil: 100000 })
  run(game, 2000)
  assert.ok(game.campaign.progressMs > 1000)
  Object.assign(guard, task.position, { health: 100 })
  const progress = game.campaign.progressMs
  run(game, 1000)
  assert.equal(game.campaign.operation!.contested, true)
  assert.equal(game.campaign.progressMs, progress)
  guard.health = 0
  Object.assign(player, game.mission.spawn)
  game.step()
  assert.equal(game.campaign.progressMs, 0)
  game.pause()
  run(game, 50000)
  assert.equal(game.campaign.operation!.index, 3)
})
test('A timed device fails when time runs out, freezes while paused, and retries the same checkpoint', () => {
  const game = gameAt('cold-water', 1),
    operation = game.campaign.operation!
  run(game, 1000)
  game.pause()
  const remaining = operation.remainingMs
  run(game, 5000)
  assert.equal(operation.remainingMs, remaining)
  game.start()
  run(game, remaining + 100)
  assert.equal(game.campaign.outcome, 'failed')
  assert.match(game.campaign.radio, /detonated/)
  game.restart()
  assert.equal(game.campaign.operation!.index, 1)
  assert.equal(game.campaign.operation!.remainingMs, 120000)
})
test('Reinforcements are hidden until their trigger and do not respawn after a saved elimination', () => {
  const mission = getCampaignMission('blackout'),
    index = mission.tasks!.findIndex((t) => t.reinforcements?.length),
    wave = mission.tasks![index]!.reinforcements!
  const game = new CampaignGame('human', undefined, () => 0.5, mission.id)
  for (const n of wave) assert.equal(game.actors.get(`bot-${n}`)!.participating, false)
  const resumed = new CampaignGame(
    'human',
    {
      version: 1,
      missionId: mission.id,
      checkpoint: 'rescue',
      objectiveIndex: index,
      cleared: [`bot-${wave[0]}`],
      completed: false,
    },
    () => 0.5,
    mission.id,
  )
  assert.equal(resumed.actors.get(`bot-${wave[0]}`)!.health, 0)
  assert.equal(resumed.actors.get(`bot-${wave[1]}`)!.participating, true)
  assert.equal(resumed.actors.get(`bot-${wave[1]}`)!.health, 100)
})
test('Invalid objective indices and cross-mission saves cannot skip mission rules', () => {
  for (const objectiveIndex of [-1, NaN, Infinity, 1.5, 99])
    assert.equal(
      parseCampaignProgress(
        { version: 1, checkpoint: 'extract', objectiveIndex, completed: true },
        'blackout',
      ).completed,
      false,
    )
  assert.equal(
    parseCampaignProgress(
      {
        version: 1,
        missionId: 'blackout',
        checkpoint: 'extract',
        objectiveIndex: 3,
        completed: true,
      },
      'cold-water',
    ).completed,
    false,
  )
})
for (const mission of operations.filter((m) => m.companion))
  test(`${mission.title}: escort physically follows through every remaining objective`, () => {
    const rescueIndex = mission.tasks!.findIndex((t) => t.kind === 'rescue'),
      game = gameAt(mission.id, rescueIndex + 1),
      player = game.actors.get('human')!,
      nav = getNavigation(mission.world)
    let ticks = 0
    for (const task of mission.tasks!.slice(rescueIndex + 1)) {
      for (const point of nav.findPath(player, task.position))
        while (Math.hypot(player.x - point.x, player.z - point.z) > 0.3 && ticks++ < 16000) {
          quiet(game)
          const dx = point.x - player.x,
            dz = point.z - player.z,
            length = Math.hypot(dx, dz),
            distance = Math.hypot(
              player.x - game.campaign.captive.x,
              player.z - game.campaign.captive.z,
            ),
            speed = distance > 9 ? 0 : 0.65
          game.acceptInput({
            x: (dx / length) * speed,
            z: (dz / length) * speed,
            yaw: Math.atan2(dx, dz),
            pitch: 0,
            fire: false,
            aim: false,
          })
          game.step()
          assert.equal(isBlocked(game.campaign.captive, mission.world), false)
        }
      assert.ok(ticks < 16000, `Escort stalled at ${task.title}`)
      game.acceptInput({ x: 0, z: 0, yaw: 0, pitch: 0, fire: false, aim: false })
      quiet(game)
      run(game, task.durationMs + 5000)
    }
    assert.equal(game.campaign.outcome, 'success')
  })

test('Triggered reinforcements advance toward the defense objective', () => {
  const game = gameAt('blackout', 3),
    task = activeCampaignTask(game.campaign),
    guard = game.actors.get(`bot-${task.reinforcements![0]}`)!,
    player = game.actors.get('human')!
  Object.assign(player, task.position, { protectedUntil: 100000 })
  guard.health = 100
  const before = Math.hypot(guard.x - task.position.x, guard.z - task.position.z)
  run(game, 7000)
  assert.ok(Math.hypot(guard.x - task.position.x, guard.z - task.position.z) < before - 8)
})
