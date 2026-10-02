import test from 'node:test'
import assert from 'node:assert/strict'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.js'
import { OnlineRoom, playerName } from '../apps/match/src/OnlineRoom.js'
import { TICK_MS, isBlocked, COMBAT_WORLD, COMBAT_SPAWNS } from '../packages/shared/src/index.js'
function game() {
  const g=new TrainingGame('',0,()=>.5,'online')
  g.addHuman('a','ALPHA');g.addHuman('b','BRAVO');g.enterHuman('a');g.enterHuman('b')
  g.elapsed=2000
  Object.assign(g.actors.get('a')!,{x:0,y:0,z:-16,yaw:0,protectedUntil:0})
  Object.assign(g.actors.get('b')!,{x:0,y:0,z:-6,yaw:Math.PI,protectedUntil:0})
  return g
}
const input=(x=0,z=0,fire=false,yaw=0,pitch=0)=>({x,z,fire,yaw,pitch,aim:true})
function run(g:TrainingGame,seconds:number){for(let i=0;i<seconds*1000/TICK_MS;i++)g.step()}
test('Online owns input per human, has no bots and ignores unjoined/invalid input',()=>{
 const g=game(),a=g.actors.get('a')!,b=g.actors.get('b')!
 assert.equal(g.actors.size,2);assert.ok([...g.actors.values()].every(a=>!a.bot))
 assert.equal(g.acceptInput(input(1), 'a'),true);assert.equal(g.acceptInput(input(-1),'b'),true)
 g.step();assert.ok(a.x>0);assert.ok(b.x<0)
 for(const invalid of [{...input(),x:999},{...input(),pitch:Infinity},{...input(),fire:'yes'},null])assert.equal(g.acceptInput(invalid,'a'),false)
 assert.equal(g.acceptInput(input(),'unknown'),false)
 const position=a.x;g.stopHuman('a');g.step();assert.equal(a.x,position)
 g.addHuman('c','CHARLIE');assert.equal(g.acceptInput(input(1),'c'),false)
 assert.equal(g.fire(g.actors.get('c')!,0,0),false)
})
test('Online mutual combat respects world cover, cadence, protection, death and varied fresh respawns',()=>{
 const g=game(),a=g.actors.get('a')!,b=g.actors.get('b')!
 assert.equal(g.fire(a,0,Math.atan2(.5,10),true),true);assert.equal(b.health,75)
 assert.equal(g.fire(a,0,0),false)
 assert.equal(g.fire(b,Math.PI,Math.atan2(.5,10),true),true);assert.equal(a.health,75)
 Object.assign(a,{x:-14,z:-20});Object.assign(b,{x:-14,z:-16});g.elapsed+=200
 g.fire(a,0,Math.atan2(.5,4),true);assert.equal(b.health,75)
 Object.assign(a,{x:0,z:-16});Object.assign(b,{x:0,z:-6,protectedUntil:g.elapsed+1000});g.elapsed+=200
 g.fire(a,0,Math.atan2(.5,10),true);assert.equal(b.health,75)
 b.protectedUntil=0
 for(let i=0;i<3;i++){g.elapsed+=200;g.fire(a,0,Math.atan2(.5,10),true)}
 assert.equal(b.health,0);assert.equal(b.deaths,1);assert.equal(a.kills,1)
 const old={x:b.x,z:b.z};g.stopHuman('a');g.stopHuman('b');run(g,3.1)
 assert.equal(b.health,100);assert.equal(b.ammo,24);assert.ok(b.protectedUntil>g.elapsed)
 assert.ok(Math.hypot(b.x-old.x,b.z-old.z)>4);assert.equal(isBlocked(b,COMBAT_WORLD),false)
 const score=a.score;g.enterHuman('a');assert.equal(a.score,score);assert.equal(a.health,75)
})
test('Online late joins and removal preserve the shared round and identities are bounded',()=>{
 const g=game();g.elapsed=180000;g.step();assert.equal(g.phase,'playing')
 g.actors.get('a')!.score=40;g.addHuman('c','CHARLIE');g.enterHuman('c')
 assert.equal(g.actors.get('a')!.score,40);assert.ok(g.elapsed>180000)
 g.actors.get('a')!.connected=false;assert.equal(g.acceptInput(input(1),'a'),false)
 g.removeHuman('b');assert.equal(g.actors.has('b'),false);g.step();assert.equal(g.phase,'playing')
 assert.equal(playerName('<script> </script>very-long-name','sessionABCD'),'script scriptver-ABCD')
 assert.equal(playerName({},'sessionABCD'),'OPERATOR-ABCD')
})

test('crowded respawn preserves the selected safe location with at most one visibility query per candidate/opponent',()=>{
 const g=new TrainingGame('',0,()=>.5,'online')
 for(let i=0;i<16;i++){g.addHuman(`p${i}`,`P${i}`);Object.assign(g.actors.get(`p${i}`)!,COMBAT_SPAWNS[i*5],{participating:true})}
 let calls=0;const original=g['worldHit'].bind(g)
 g['worldHit']=(origin,ray)=>{calls++;return original(origin,ray)}
 const actor=g.actors.get('p0')!;g['respawn'](actor)
 // Captured from the uncached ranking for this crowded fixture.
 assert.deepEqual({x:actor.x,y:actor.y,z:actor.z},{x:0,y:8,z:45})
 assert.ok(calls>0&&calls<=COMBAT_SPAWNS.length*15,`visibility calls: ${calls}`)
 assert.equal(isBlocked(actor,COMBAT_WORLD),false)
})

test('empty persistent arena performs no leaderboard or session database polling',async()=>{
 const room=new OnlineRoom()
 const forbidden=()=>{throw new Error('Idle arena attempted account work')}
 Object.defineProperty(room,'leaderboardBusy',{get:()=>false,set:forbidden})
 Object.defineProperty(room,'checking',{get:()=>false,set:forbidden})
 await room['publishLeaders']()
 await room['checkSessions']()
})
