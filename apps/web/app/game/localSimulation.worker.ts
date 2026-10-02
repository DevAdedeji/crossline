/// <reference lib="webworker" />
import { TrainingGame } from '@crossline/shared/TrainingGame'
import { TICK_MS } from '@crossline/shared'
import { QUICK_MATCH_MS, TRAINING } from '@crossline/shared/combat'
let game: TrainingGame | undefined
function publish() {
 if(!game)return
 postMessage({type:'state',state:{actors:game.actors,healthPacks:game.healthPacks,phase:game.phase,elapsed:game.elapsed,duration:game.durationMs,round:game.round,capacity:1}})
 for(const event of game.drainEvents())postMessage({type:'event',event})
}
onmessage=({data})=>{
 if(data.type==='init'){
  game=new TrainingGame(data.id,data.mode==='solo'?QUICK_MATCH_MS:TRAINING.durationMs,Math.random,data.mode)
  game.actors.get(data.id)!.name=String(data.name||'Player').slice(0,24)
 }else if(game){
  if(data.type==='input')game.acceptInput(data.value)
  else if(data.type==='action'){
   if(data.value==='start')game.start()
   else if(data.value==='pause')game.pause()
   else if(data.value==='reload')game.reload(game.humanId)
   else if(data.value==='finish'&&game.phase!=='ready')game.finish()
   else if(data.value==='restart'&&(game.phase==='finished'||game.phase==='paused'))game.restart()
  }
 }
 if(data.type!=='input')publish()
}
// Fixed, bounded steps: a throttled background tab never catches up minutes of combat.
setInterval(()=>{if(game){game.step(TICK_MS);publish()}},TICK_MS)
