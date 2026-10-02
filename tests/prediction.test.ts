import test from 'node:test'
import assert from 'node:assert/strict'
import { MovementPrediction } from '../apps/web/app/game/prediction.ts'
import { WeaponFeedback } from '../apps/web/app/game/weaponFeedback.ts'
import { TrainingGame } from '../apps/match/src/training/TrainingGame.ts'
import { TRAINING_WORLD, TICK_MS, isBlocked, moveHuman } from '../packages/shared/src/index.ts'
import { IDLE_INPUT, parseCombatInput } from '../packages/shared/src/combat.ts'

test('local collision prediction moves before network acknowledgment and reconciles pending commands',()=>{
 const game=new TrainingGame('test');game.start()
 const actor=game.actors.get('test')!,prediction=new MovementPrediction(TRAINING_WORLD)
 prediction.reconcile(actor,1,true)
 const input={...IDLE_INPUT,x:1}
 prediction.command(1,input);prediction.command(2,input)
 assert.ok(prediction.body!.x>actor.x,'movement does not wait for authority')
 game.acceptInput({...input,seq:1});game.step(TICK_MS)
 prediction.reconcile(actor,1,true)
 game.acceptInput({...input,seq:2});game.step(TICK_MS)
 assert.ok(Math.abs(prediction.body!.x-actor.x)<1e-9,'pending command replay matches authority')
 prediction.reconcile(actor,1,true)
 assert.ok(Math.abs(prediction.body!.x-actor.x)<1e-9)
 assert.equal(actor.inputSeq,2)
})
test('prediction shares crouch, aim speed and collision, and drops queued movement after death/respawn',()=>{
 const game=new TrainingGame('test');game.start();const actor=game.actors.get('test')!
 const prediction=new MovementPrediction(TRAINING_WORLD);prediction.reconcile(actor,1,true)
 const input={...IDLE_INPUT,x:1,crouch:true,aim:true}
 for(let seq=1;seq<20;seq++){
  prediction.command(seq,input);game.acceptInput({...input,seq});game.step(TICK_MS)
  assert.deepEqual(prediction.body,{x:actor.x,y:actor.y,z:actor.z,crouch:actor.crouch})
  assert.equal(isBlocked(prediction.body!,TRAINING_WORLD,1.05),false)
  prediction.reconcile(actor,1,true)
 }
 prediction.command(20,input);actor.health=0;prediction.reconcile(actor,1,true)
 assert.equal(prediction.body!.x,actor.x)
 actor.health=100;actor.x=-20;actor.protectedUntil+=1000;prediction.reconcile(actor,1,true)
 assert.equal(prediction.body!.x,-20)
 assert.deepEqual(moveHuman(actor,{...IDLE_INPUT,x:1},TICK_MS*10),moveHuman(actor,{...IDLE_INPUT,x:1},TICK_MS),'movement time remains bounded')
 assert.equal(parseCombatInput({...input,seq:Infinity}),null)
 assert.equal(parseCombatInput({...input,seq:-1}),null)
})
test('immediate weapon feedback remains bounded by ammo, cadence, reload and confirmed shots',()=>{
 const actor=new TrainingGame('test').actors.get('test')!,feedback=new WeaponFeedback();feedback.sync(actor)
 assert.equal(feedback.fire(0,true,actor,0,'training'),true)
 assert.equal(feedback.fire(10,true,actor,0,'training'),false)
 for(let i=1;i<24;i++)assert.equal(feedback.fire(i*200,true,actor,0,'training'),true)
 assert.equal(feedback.fire(5000,true,actor,0,'training'),false,'no invented unlimited magazine')
 actor.shots=24;actor.ammo=0;feedback.sync(actor)
 assert.equal(feedback.fire(5200,true,actor,0,'training'),false)
 actor.reloadUntil=6000;actor.ammo=24;feedback.sync(actor)
 assert.equal(feedback.fire(5400,true,actor,0,'training'),false)
 actor.reloadUntil=0;feedback.sync(actor)
 assert.equal(feedback.fire(6200,true,actor,0,'training'),true)
 actor.health=0;assert.equal(feedback.fire(6500,true,actor,0,'training'),false)
})
