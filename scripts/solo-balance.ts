/** Deterministic exposed-player scenarios; no spawn protection, shooting or health supplies. */
import assert from 'node:assert/strict'
import { isBlocked } from '../packages/shared/src/index.ts'
import { pathToFileURL } from 'node:url'
import { TrainingGame } from '../packages/shared/src/simulation/TrainingGame.ts'

export function soloEncounter(seed: number, count: number) {
  let state = seed
  const game = new TrainingGame('human', 180000, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }, 'solo')
  game.start()
  game.healthPacks.clear()
  const human = game.actors.get('human')!
  Object.assign(human, { x: 0, y: 0, z: -14, protectedUntil: 0 })
  let i = 0
  for (const [id, actor] of game.actors) {
    if (!actor.bot) continue
    if (i >= count) { game.actors.delete(id); continue }
    Object.assign(actor, { x: count === 1 ? 0 : (i - (count - 1) / 2) * (count > 4 ? 1 : 2), y: 0, z: -6, yaw: Math.PI, protectedUntil: 0 })
    i++
  }
  for (const actor of game.actors.values()) assert.equal(isBlocked(actor, game.world), false, `Fixture actor ${actor.id} starts inside cover`)
  let firstDamageMs: number | null = null
  const health: Record<number, number> = {}
  while (game.elapsed < 90000 && human.health > 0) {
    game.step()
    if (firstDamageMs === null && human.health < 100) firstDamageMs = game.elapsed
    for (const seconds of [5, 10, 20]) if (game.elapsed >= seconds * 1000 && health[seconds] === undefined) health[seconds] = human.health
    game.drainEvents()
  }
  for (const seconds of [5, 10, 20]) health[seconds] ??= human.health
  return { firstDamageMs, defeatMs: human.health === 0 ? game.elapsed : null, health }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
  }
  console.log(JSON.stringify([1, 2, 4, 8].map(bots => {
    const runs = Array.from({ length: 12 }, (_, i) => soloEncounter(i + 1, bots))
    const defeats = runs.flatMap(r => r.defeatMs === null ? [] : [r.defeatMs])
    return { bots, seeds: 12, survivorsAt90s: 12 - defeats.length,
      medianDefeatMs: defeats.length > runs.length / 2 ? median(runs.map(r => r.defeatMs ?? Infinity)) : null,
      minDefeatMs: defeats.length ? Math.min(...defeats) : null,
      medianFirstDamageMs: median(runs.flatMap(r => r.firstDamageMs === null ? [] : [r.firstDamageMs])),
      medianHealthAt5s: median(runs.map(r => r.health[5]!)),
      medianHealthAt10s: median(runs.map(r => r.health[10]!)),
      medianHealthAt20s: median(runs.map(r => r.health[20]!)) }
  }), null, 2))
}
