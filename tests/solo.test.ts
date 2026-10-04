import test from 'node:test'
import assert from 'node:assert/strict'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.js'
import { TICK_MS } from '../packages/shared/src/index.js'
function setup(mode: 'solo' | 'training' = 'solo') {
  let seed = 124
  const game = new TrainingGame('human', 180000, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }, mode)
  game.start(); game.elapsed = 2000
  for (const [id, actor] of game.actors) {
    if (id !== 'human' && id !== 'bot-0') game.actors.delete(id)
    actor.protectedUntil = 0
  }
  Object.assign(game.actors.get('human')!, { x: 0, y: 0, z: -14 })
  Object.assign(game.actors.get('bot-0')!, { x: 0, y: 0, z: -6, yaw: Math.PI })
  return game
}
function run(game: TrainingGame, seconds: number) { for (let i = 0; i < seconds * 1000 / TICK_MS; i++) game.step() }
test('Solo pursuit advances along a street without reversing toward old graph anchors', () => {
  const game=setup(),bot=game.actors.get('bot-0')!,human=game.actors.get('human')!
  Object.assign(bot,{x:0,y:0,z:-61,yaw:Math.PI})
  Object.assign(human,{x:0,y:0,z:-105})
  for(let i=0;i<300;i++) {
    const before={x:bot.x,z:bot.z}
    game.step()
    assert.ok(bot.z<=before.z+.001,`bot reversed at tick ${i}: ${before.z} -> ${bot.z}`)
    assert.ok(Math.hypot(bot.x-before.x,bot.z-before.z)<=1.8*TICK_MS/1000+.001,'movement stays within 1.8 m/s walking speed')
  }
  assert.ok(bot.z < -77,`bot makes sustained progress, ended at ${bot.z}`)
})
test('Solo bots hold an engagement position instead of shuffling between shots', () => {
  const game=setup(),bot=game.actors.get('bot-0')!,human=game.actors.get('human')!
  Object.assign(bot,{x:0,y:0,z:-60,yaw:Math.PI})
  Object.assign(human,{x:0,y:0,z:-78})
  run(game,5)
  assert.equal(bot.x,0);assert.equal(bot.z,-60)
  assert.ok(bot.shots>0)
  // Small target movement around the old 17m threshold must not restart pursuit.
  for(const z of [-77,-78,-79,-78]){human.z=z;run(game,.4)}
  assert.equal(bot.x,0);assert.equal(bot.z,-60)
})
test('Solo bots react before firing, damage the player, reload and stop while paused', () => {
  const game = setup(), bot = game.actors.get('bot-0')!, human = game.actors.get('human')!
  run(game, .35); assert.equal(bot.shots, 0)
  run(game, 5); assert.ok(bot.shots > 0); assert.ok(human.health < 100 || human.deaths > 0)
  bot.ammo = 0; run(game, .4); assert.ok(bot.reloadUntil > game.elapsed)
  game.pause(); const snapshot = JSON.stringify([...game.actors]); const elapsed = game.elapsed
  run(game, 3); assert.equal(game.elapsed, elapsed); assert.equal(JSON.stringify([...game.actors]), snapshot)
  game.start(); run(game, 2); assert.ok(bot.ammo > 0)
})
test('Solo blocks bot friendly fire, including a bot standing between the shooter and human', () => {
  const solo = setup(), human = solo.actors.get('human')!, bot = solo.actors.get('bot-0')!
  const other = { ...human, id: 'bot-1', bot: true, name: 'OTHER', z: -10 }
  solo.actors.set(other.id, other)
  for (let i=0;i<8;i++) {
    solo.elapsed+=200
    assert.equal(solo.fire(bot, Math.PI, Math.atan2(.5, 8), true), true)
  }
  assert.equal(other.health,100); assert.equal(other.deaths,0)
  assert.equal(human.health,100); assert.equal(bot.hits,0); assert.equal(bot.score,0)
  assert.ok(solo.drainEvents().every(event=>event.type!=='damage' && event.type!=='kill'))
  // Human shots still damage bots.
  assert.equal(solo.fire(human,0,Math.atan2(.5,4),true),true)
  assert.equal(other.health,75)
  const training = setup('training'); assert.equal(training.fire(training.actors.get('bot-0')!, Math.PI, 0), false)
  run(training, 10); assert.equal(training.actors.get('human')!.health, 100)
})
test('Solo rejects stale bot targets before flinch delays and never acquires a bot without a human', () => {
  const game=setup(),bot=game.actors.get('bot-0')!,human=game.actors.get('human')!
  const other={...human,id:'bot-1',bot:true,name:'OTHER'}
  game.actors.delete(human.id);game.actors.set(other.id,other)
  game['memories'].set(other.id,{path:[],nextPlan:0})
  const memory=game['memories'].get(bot.id)!
  Object.assign(memory,{targetId:other.id,lastSeenId:other.id,lastSeen:{x:other.x,y:other.y,z:other.z},nextScan:Infinity,burstLeft:3})
  bot.lastDamage=game.elapsed;game.step()
  assert.equal(memory.targetId,undefined);assert.equal(memory.lastSeen,undefined);assert.equal(memory.burstLeft,0)
  run(game,15)
  for(const actor of game.actors.values()){assert.equal(actor.shots,0);assert.equal(actor.health,100)}
  for(const state of game['memories'].values()){assert.equal(state.targetId,undefined);assert.equal(state.lastSeenId,undefined)}
})
test('Solo forgets dead/protected humans and reacquires them with a fresh reaction after respawn', () => {
  const game=setup(),bot=game.actors.get('bot-0')!,human=game.actors.get('human')!
  const memory=game['memories'].get(bot.id)!
  game.step();assert.equal(memory.targetId,human.id)
  // Sight may be lost before death; last-seen pursuit must also be invalidated.
  memory.targetId=undefined;memory.nextScan=Infinity
  human.health=0;human.respawnUntil=game.elapsed+500
  bot.lastDamage=game.elapsed;game.step()
  assert.equal(memory.lastSeen,undefined);assert.equal(memory.targetId,undefined)
  const shots=bot.shots
  run(game,.6);assert.equal(human.health,100);assert.ok(human.protectedUntil>game.elapsed)
  Object.assign(human,{x:0,y:0,z:-14})
  Object.assign(bot,{x:0,y:0,z:-6,yaw:Math.PI})
  // Even a stale target restored during protection must be rejected before the next scan.
  Object.assign(memory,{targetId:human.id,lastSeenId:human.id,nextScan:Infinity})
  game.step();assert.equal(memory.targetId,undefined);assert.equal(memory.lastSeenId,undefined)
  run(game,.3);assert.equal(bot.shots,shots);assert.equal(human.health,100)
  human.protectedUntil=game.elapsed
  Object.assign(bot,{x:0,y:0,z:-6,yaw:Math.PI,lastDamage:-10000})
  memory.nextScan=0;game.step()
  assert.equal(memory.targetId,human.id);assert.ok(memory.reactAt!>game.elapsed)
  run(game,.3);assert.equal(bot.shots,shots)
  run(game,2);assert.ok(bot.shots>shots);assert.ok(human.health<100 || human.deaths>0)
})
test('Solo dead actors respawn safely, restart clears AI and protection prevents instant spawn attacks', () => {
  const game = setup(), bot = game.actors.get('bot-0')!
  bot.health = 0; bot.reloadUntil = game.elapsed + 1000; bot.respawnUntil = game.elapsed
  const previous = { x: bot.x, z: bot.z }; game.step()
  assert.equal(bot.health, 100); assert.equal(bot.ammo, 24); assert.equal(bot.reloadUntil, 0)
  assert.ok(Math.hypot(bot.x - previous.x, bot.z - previous.z) > 4)
  assert.equal(game.fire(bot, 0, 0), false)
  game.restart(); assert.equal(game.mode, 'solo'); assert.equal(game.phase, 'ready'); assert.equal(game.elapsed, 0)
  assert.ok([...game.actors.values()].every(actor => actor.shots === 0 && actor.kills === 0))
})

test('Solo cannot shoot through the store wall and humans respawn with a fresh protected life', () => {
  const game = setup(), bot = game.actors.get('bot-0')!, human = game.actors.get('human')!
  Object.assign(bot, { x: -14, z: -20, yaw: 0 })
  Object.assign(human, { x: -14, z: -16 })
  // The solid south wall is at z=-18; both actors are outside its collision volume.
  assert.equal(game.fire(bot, 0, Math.atan2(.5, 4), true), true)
  assert.equal(human.health, 100)
  run(game, .7); assert.equal(human.health, 100)
  human.health = 0; human.deaths = 1; human.respawnUntil = game.elapsed
  game.step()
  assert.equal(human.health, 100); assert.equal(human.ammo, 24)
  assert.equal(human.deaths, 1); assert.ok(human.protectedUntil > game.elapsed)
  assert.ok(Math.hypot(human.x + 14, human.z + 16) > 4)
  assert.equal(game.fire(human, 0, 0), false)
  game.finish(); const state = JSON.stringify([...game.actors]); run(game, 5)
  assert.equal(JSON.stringify([...game.actors]), state)
})
