import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMPAIGN_MISSIONS, getCampaignMission, parseCampaignProgress } from '../packages/shared/src/campaign.js'
import { CampaignGame } from '../packages/shared/src/simulation/CampaignGame.js'
import { isBlocked, move, TICK_MS } from '../packages/shared/src/index.js'
import { getNavigation } from '../packages/shared/src/simulation/navigation.js'
const run=(game:CampaignGame,ms:number)=>{for(let i=0;i<Math.ceil(ms/TICK_MS);i++)game.step()}
for(const mission of CAMPAIGN_MISSIONS.slice(1).filter(m=>!m.tasks)) {
  const cleared=mission.guards.map((_,i)=>`bot-${i}`)
  test(`${mission.title}: every spawn and objective is accessible in its own arena`,()=>{
    const world=mission.world,nav=getNavigation(world)
    for(const point of [mission.spawn,mission.rescueSpawn,mission.escortSpawn,mission.relay,mission.captive,mission.extraction,...mission.guards]) assert.equal(isBlocked(point,world),false,JSON.stringify(point))
    for(const [from,to] of [[mission.spawn,mission.relay],[mission.relay,mission.captive],[mission.captive,mission.extraction]] as const) assert.ok(nav.findPath(from,to).length,JSON.stringify({from,to}))
    // The original city's ramp must not create invisible collision in these layouts.
    assert.equal(move({x:-20,y:0,z:8},{x:0,z:0},TICK_MS,world).y,0)
  })
  test(`${mission.title}: ordered objectives, checkpoint retry, and complete extraction`,()=>{
    const game=new CampaignGame('human',{version:1,checkpoint:'relay',cleared,completed:false},()=>.5,mission.id),player=game.actors.get('human')!
    game.start();Object.assign(player,mission.relay);run(game,mission.interactMs+100)
    assert.equal(game.campaign.stage,'rescue');assert.equal(game.campaign.save.missionId,mission.id)
    game.finish();game.restart();assert.equal(game.campaign.stage,'rescue');game.start()
    Object.assign(game.actors.get('human')!,mission.captive);run(game,mission.interactMs+100)
    assert.equal(game.campaign.stage,'extract');assert.equal(game.campaign.following,mission.kind==='extraction')
    const escort=game.actors.get('human')!,path=getNavigation(mission.world).findPath(escort,mission.extraction)
    let tick=0
    for(const point of path)while(Math.hypot(point.x-escort.x,point.z-escort.z)>.3&&tick++<12000){
      const distance=Math.hypot(escort.x-game.campaign.captive.x,escort.z-game.campaign.captive.z),dx=point.x-escort.x,dz=point.z-escort.z,length=Math.hypot(dx,dz)
      const speed=game.campaign.following&&distance>9?0:.65
      game.acceptInput({x:dx/length*speed,z:dz/length*speed,yaw:Math.atan2(dx,dz),pitch:0,fire:false,aim:false});game.step()
      if(game.campaign.following)assert.equal(isBlocked(game.campaign.captive,mission.world),false)
    }
    assert.ok(tick<12000,'Escort or player route stalled')
    game.acceptInput({x:0,z:0,yaw:0,pitch:0,fire:false,aim:false});run(game,10000)
    assert.equal(game.campaign.outcome,'success');assert.equal(game.campaign.save.completed,true)
  })
}
test('Mission saves cannot transfer checkpoint or completion into another chapter',()=>{
  const save={version:1,missionId:'dead-freight',checkpoint:'extract',cleared:['bot-0'],completed:true}
  assert.equal(parseCampaignProgress(save,'last-signal').completed,false)
  assert.equal(parseCampaignProgress(save,'safe-passage').checkpoint,'relay')
  assert.equal(parseCampaignProgress(save,'dead-freight').checkpoint,'extract')
  assert.equal(getCampaignMission('unknown').id,'last-signal')
})
