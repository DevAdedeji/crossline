import test from 'node:test'
import assert from 'node:assert/strict'
import { CampaignGame } from '../packages/shared/src/simulation/CampaignGame.js'
import { CAMPAIGN_WORLD, CAMPAIGN_GUARDS, EXTRACTION_MISSION as mission, parseCampaignProgress } from '../packages/shared/src/campaign.js'
import { isBlocked, TICK_MS, type Position } from '../packages/shared/src/index.js'
import { getNavigation } from '../packages/shared/src/simulation/navigation.js'
const cleared = CAMPAIGN_GUARDS.map((_, i) => `bot-${i}`)
function run(game: CampaignGame, ms: number) { for(let i=0; i<Math.ceil(ms/TICK_MS); i++) game.step() }
function quietGame(checkpoint = 'relay') { const game = new CampaignGame('human', { version:1, checkpoint, cleared, completed:false }, () => .5); game.start(); return game }

test('Campaign requires ordered, uninterrupted interactions and rejects interaction through cover', () => {
  const game = quietGame(), player = game.actors.get('human')!
  Object.assign(player, mission.captive); game.interact(true); run(game, 2500)
  assert.equal(game.campaign.stage, 'relay')
  Object.assign(player, { x:0, y:0, z:30.5 }); game.interact(true); run(game, 2500)
  assert.equal(game.campaign.canInteract, false)
  Object.assign(player, mission.relay); game.interact(true); run(game, 1000)
  assert.ok(game.campaign.progressMs > 0)
  game.interact(false); game.step(); assert.equal(game.campaign.progressMs, 0)
  game.interact(true); game.pause(); run(game, 3000); assert.equal(game.campaign.stage, 'relay')
  game.start(); run(game, 2500); assert.equal(game.campaign.progressMs, 0)
  game.interact(true); run(game, 2300); assert.equal(game.campaign.stage, 'rescue')
  assert.equal(game.campaign.save.checkpoint, 'rescue')
  Object.assign(player, mission.captive); game.interact(true); run(game,2300)
  assert.equal(game.campaign.stage, 'extract'); assert.equal(game.campaign.following, true)
})

test('Campaign death restores the saved checkpoint, cleared guards and elapsed time without auto-respawning', () => {
  const game = quietGame(), player = game.actors.get('human')!
  Object.assign(player, mission.relay); game.interact(true); run(game,2300)
  const saved = structuredClone(game.campaign.save)
  player.health = 0; game.step()
  assert.equal(game.phase, 'finished'); assert.equal(game.campaign.outcome, 'failed')
  run(game,10000); assert.equal(player.health, 0)
  game.restart(); assert.equal(game.phase, 'ready'); assert.equal(game.campaign.stage,'rescue')
  assert.equal(game.actors.get('human')!.health,100)
  assert.equal(game.elapsed,saved.elapsedMs)
  assert.deepEqual([...game.actors.values()].filter(a=>a.bot).map(a=>a.health),Array(7).fill(0))
  const resumed = new CampaignGame('returning', saved)
  assert.equal(resumed.campaign.stage, 'rescue'); assert.equal(resumed.actors.get('returning')!.z,mission.rescueSpawn.z)
})

test('Campaign spawns and objective routes are walkable inside the dedicated depot', () => {
  const nav = getNavigation(CAMPAIGN_WORLD)
  for(const point of [mission.spawn, mission.rescueSpawn, mission.escortSpawn, mission.relay, mission.captive, mission.extraction, ...CAMPAIGN_GUARDS]) assert.equal(isBlocked(point, CAMPAIGN_WORLD),false,JSON.stringify(point))
  for(const [from,to] of [[mission.spawn,mission.relay],[mission.relay,mission.captive],[mission.captive,mission.extraction]] as const) assert.ok(nav.findPath(from,to).length,`No route: ${JSON.stringify(from)} to ${JSON.stringify(to)}`)
})

test('Finch follows real collision around the office and across the depot to complete extraction', () => {
  const game = quietGame('extract'), player=game.actors.get('human')!, nav=getNavigation(CAMPAIGN_WORLD)
  Object.assign(player, mission.captive)
  const path = nav.findPath(player, mission.extraction)
  let tick = 0
  for(const point of path) {
    while(Math.hypot(point.x-player.x,point.z-player.z)>.3 && tick++<9000) {
      const distance=Math.hypot(player.x-game.campaign.captive.x,player.z-game.campaign.captive.z)
      const dx=point.x-player.x,dz=point.z-player.z,length=Math.hypot(dx,dz)
      game.acceptInput({x:distance>9?0:dx/length*.65,z:distance>9?0:dz/length*.65,yaw:Math.atan2(dx,dz),pitch:0,fire:false,aim:false})
      game.step()
      assert.equal(isBlocked(game.campaign.captive,CAMPAIGN_WORLD),false,'Finch passed through a collider')
    }
  }
  assert.ok(tick<9000,`Escort stalled: ${JSON.stringify({player,finch:game.campaign.captive})}`)
  game.acceptInput({x:0,z:0,yaw:0,pitch:0,fire:false,aim:false});run(game,10000)
  assert.equal(game.campaign.outcome,'success')
  assert.equal(game.phase,'finished');assert.equal(game.campaign.save.completed,true)
  assert.ok(game.campaign.save.bestTimeMs!>5000)
  game.restart();assert.equal(game.campaign.stage,'relay');assert.equal(game.campaign.save.completed,true)
})

test('Extraction cannot complete without Finch; walking away interrupts the countdown', () => {
  const game = quietGame('extract'), player=game.actors.get('human')!
  Object.assign(player,mission.extraction);run(game,6000)
  assert.equal(game.campaign.outcome,'active');assert.equal(game.campaign.waiting,true)
  Object.assign(game.campaign.captive,mission.extraction);run(game,2500)
  assert.ok(game.campaign.progressMs>0)
  Object.assign(player,{x:-20,y:0,z:-36} satisfies Position);game.step();assert.equal(game.campaign.progressMs,0)
})

test('Campaign progress handles corrupt and future save data without losing a playable entry', () => {
  for(const value of [null,[],{version:2},{version:1,checkpoint:'bogus',completed:false}]) assert.equal(parseCampaignProgress(value).checkpoint,'relay')
  const value=parseCampaignProgress({version:1,checkpoint:'extract',completed:true,cleared:['human','bot-0','bot-0','bot-99'],elapsedMs:Infinity,bestTimeMs:NaN})
  assert.deepEqual(value.cleared,['bot-0']);assert.equal(value.elapsedMs,undefined);assert.equal(value.bestTimeMs,undefined)
})

test('Campaign guards use combat AI and stay eliminated instead of practice behavior or respawning', () => {
  const game = new CampaignGame('human', undefined, () => .5)
  const human = game.actors.get('human')!, guard = game.actors.get('bot-0')!
  for(const actor of game.actors.values()) if(actor.bot && actor !== guard) actor.health = 0
  Object.assign(human, {x:0,y:0,z:-30,protectedUntil:0})
  Object.assign(guard, {x:0,y:0,z:-20,yaw:Math.PI,protectedUntil:0})
  game.start();run(game,7000)
  assert.ok(guard.shots > 0);assert.ok(human.health < 100)
  guard.health = 0;guard.respawnUntil=game.elapsed;run(game,7000)
  assert.equal(guard.health,0)
})
