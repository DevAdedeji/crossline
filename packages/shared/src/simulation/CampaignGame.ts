import { clearGrenadeArc, grenadeDamage, GRENADE_FUSE_MS } from '../campaignGrenades.js'
import { TICK_MS, move, type Position } from '@crossline/shared'
import { worldHit } from '@crossline/shared/combat'
import { TrainingGame } from './TrainingGame.js'
import { activeCampaignTask, getCampaignMission, type CampaignMission, parseCampaignProgress, type CampaignState } from '../campaign.js'

/** Mission rules stay in the simulation, never in UI proximity checks. */
export class CampaignGame extends TrainingGame {
  readonly mission: CampaignMission
  campaign: CampaignState
  private escortPath: Position[] = []
  private nextEscortPlan = 0
  private nextGrenadeAt = 10000
  private nextReinforcementPlan = 0
  constructor(id: string, progress: unknown = undefined, random: () => number = Math.random, missionId = 'last-signal') {
    const mission = getCampaignMission(missionId)
    super(id, 0, random, 'solo', {
      fireEndsProtection: true,
      botProfile: { sightRange: 68, nearAwareness: 28, halfFov: 2.1, reactionMs: 550, reactionJitterMs: 200,
        shotIntervalMs: 600, burstShots: 3, burstRestMs: 1100, burstRestJitterMs: 350,
        maxAttackers: 3, bodyDamage: 8, headDamage: 12, damageGraceMs: 650, searchMs: 9000, patrolRadius: 12 },
      world: mission.world, spawns: [mission.spawn, ...mission.guards], botCount: mission.guards.length, respawn: false,
      healthPacks: [mission.spawn, mission.rescueSpawn, mission.escortSpawn].map((p,i)=>({id:`mission-supplies-${i}`,...p,availableAt:0})),
    })
    this.mission = mission
    const save = parseCampaignProgress(progress, mission.id)
    this.campaign = { missionId: mission.id, grenades: [], stage: save.checkpoint, checkpoint: save.checkpoint, outcome: 'active', progressMs: 0, canInteract: false,
      captive: { ...mission.captive, yaw: Math.PI }, following: mission.kind === 'extraction' && save.checkpoint === 'extract', waiting: false,
      radio: '', save }
    this.restoreCheckpoint()
  }
  private restoreCheckpoint() {
    const mission = this.mission
    const state = this.campaign, save = state.save
    state.stage = save.checkpoint; state.checkpoint = save.checkpoint; state.outcome = 'active'
    state.progressMs = 0; state.canInteract = false; state.following = mission.kind === 'extraction' && save.checkpoint === 'extract'; state.waiting = false
    state.captive = { ...mission.captive, yaw: Math.PI }
    state.radio = `CONTROL: ${mission.objectives[state.stage].instruction}`
    this.escortPath = []; this.nextEscortPlan = 0
    this.elapsed = save.elapsedMs ?? 0
    state.grenades = []; this.nextGrenadeAt = this.elapsed + 10000
    let spawn = state.stage === 'extract' ? mission.escortSpawn : state.stage === 'rescue' ? mission.rescueSpawn : mission.spawn
    if (mission.tasks) {
      const index=save.objectiveIndex ?? 0, task=mission.tasks[index]!
      state.operation={index,remainingMs:task.timeLimitMs ?? 0,contested:false,enemiesRemaining:0,targets:[]}
      state.stage=index===0?'relay':index===mission.tasks.length-1?'extract':'rescue';state.checkpoint=state.stage
      state.following=mission.tasks.slice(0,index).some(t=>t.kind==='rescue')
      spawn=index===0?mission.spawn:mission.tasks[index-1]!.position
      if(state.following)state.captive={...spawn,yaw:0}
      const reserved=new Set(mission.tasks.flatMap(t=>t.reinforcements??[]))
      const activated=new Set(mission.tasks.slice(0,index+1).flatMap(t=>t.reinforcements??[]))
      for(const n of reserved){const guard=this.actors.get(`bot-${n}`)!;guard.participating=activated.has(n);if(!guard.participating)guard.health=0}
      this.nextReinforcementPlan=0
      state.radio=`CONTROL: ${task.instruction}`
    }
    const target=mission.tasks?.[state.operation!.index]?.position
    const yaw=target?Math.atan2(target.x-spawn.x,target.z-spawn.z):0
    Object.assign(this.actors.get(this.humanId)!, spawn, { protectedUntil: this.elapsed + 4000, yaw })
    for (const id of save.cleared) { const guard = this.actors.get(id); if (guard) guard.health = 0 }
    this.events.push({ type: 'spawn', actorId: this.humanId, yaw })
  }
  override restart() {
    super.restart()
    this.restoreCheckpoint()
  }
  override pause() { this.campaign.progressMs = 0; super.pause() }
  override finish() {
    this.campaign.outcome = 'failed'
    this.campaign.radio = 'CONTROL: Operation aborted. Your last checkpoint is available.'
    super.finish()
  }
  private checkpoint(stage: CampaignState['stage'], objectiveIndex?: number) {
    const state = this.campaign
    state.stage = stage; state.checkpoint = stage; state.progressMs = 0; state.canInteract = false
    state.save = { ...state.save, checkpoint: stage, elapsedMs: this.elapsed, ...(objectiveIndex !== undefined ? {objectiveIndex} : {}),
      cleared: [...this.actors.values()].filter(a => a.bot && a.participating !== false && a.health <= 0).map(a => a.id) }
  }
  private near(point: Position, target: Position, radius: number) {
    if (Math.abs(point.y - target.y) > 1 || Math.hypot(point.x-target.x, point.z-target.z) > radius) return false
    const dx = target.x-point.x, dz = target.z-point.z, length = Math.hypot(dx,dz)
    return length < .01 || worldHit({ ...point, y: point.y + 1 }, {x:dx/length,y:0,z:dz/length}, length, this.world) >= length - .05
  }
  private updateGrenades(dt: number) {
    const player = this.actors.get(this.humanId)!, state = this.campaign
    for (const grenade of state.grenades) {
      const previous = grenade.remainingMs
      grenade.remainingMs -= dt
      if (grenade.remainingMs > 0 || previous <= 0) continue
      this.events.push({type:'explosion',position:grenade.target})
      const damage = player.protectedUntil > this.elapsed ? 0 : grenadeDamage(player, grenade.target, this.world)
      if (damage > 0 && player.health > 0) {
        player.health = Math.max(0, player.health - damage); player.lastDamage = this.elapsed
        this.events.push({type:'damage',sourceId:grenade.sourceId,targetId:player.id,damage,health:player.health})
        if (!player.health) {
          player.deaths++; player.reloadUntil=0
          const guard=this.actors.get(grenade.sourceId)!
          guard.kills++;guard.score+=100
          this.events.push({type:'kill',killerId:guard.id,victimId:player.id,killer:guard.name,victim:player.name,humanKill:false})
        }
      }
    }
    state.grenades=state.grenades.filter(grenade=>grenade.remainingMs > -350)
    if (state.grenades.length || this.elapsed<this.nextGrenadeAt || player.health<=0 || player.protectedUntil>this.elapsed) return
    this.nextGrenadeAt=this.elapsed+1500
    for(const guard of this.actors.values()) {
      const distance=Math.hypot(guard.x-player.x,guard.z-player.z)
      if(!guard.bot||guard.participating===false||guard.health<=0||distance<10||distance>28||Math.abs(guard.y-player.y)>1)continue
      const start={x:guard.x,y:guard.y+1.5,z:guard.z},target={x:player.x,y:player.y,z:player.z}
      const dx=target.x-start.x,dz=target.z-start.z
      // Throw only at a visible player, never using hidden position through cover.
      if(worldHit(start,{x:dx/distance,y:0,z:dz/distance},distance,this.world)<distance-.05)continue
      const grenade={sourceId:guard.id,start,target,remainingMs:GRENADE_FUSE_MS}
      if(!clearGrenadeArc(grenade,this.world))continue
      state.grenades.push(grenade);this.nextGrenadeAt=this.elapsed+16000
      break
    }
  }
  private followCaptive(dt: number) {
    const player=this.actors.get(this.humanId)!,state=this.campaign
    const distance = Math.hypot(player.x-state.captive.x, player.z-state.captive.z)
    state.waiting = state.following && distance > 18
    state.canInteract = false
    if (state.following && !state.waiting && distance > 2.5) {
      if (this.elapsed >= this.nextEscortPlan || !this.escortPath.length) {
        this.escortPath = this.navigation.findPath(state.captive, player)
        this.nextEscortPlan = this.elapsed + 1200
      }
      while (this.escortPath[0] && this.near(state.captive, this.escortPath[0], .3)) this.escortPath.shift()
      const next = this.escortPath[0]
      if (next) {
        const dx=next.x-state.captive.x, dz=next.z-state.captive.z, length=Math.hypot(dx,dz)
        if (length > .01) {
          const speed = Math.min(.62, length / (6 * dt / 1000 || 1))
          Object.assign(state.captive, move(state.captive, {x:dx/length*speed,z:dz/length*speed}, dt, this.world))
          state.captive.yaw = Math.atan2(dx,dz)
        }
      }
    } else this.escortPath = []
  }
  private completeMission() {
    const state=this.campaign,mission=this.mission
    for(const task of mission.tasks??[])if(task.kind==='plant')this.events.push({type:'explosion',position:task.position})
    state.outcome='success';state.radio=mission.debrief
    state.save={missionId:mission.id,version:1,checkpoint:'relay',...(mission.tasks?{objectiveIndex:0}:{}),cleared:[],completed:true,bestTimeMs:Math.min(state.save.bestTimeMs??Infinity,this.elapsed)}
    super.finish()
  }
  private stepOperation(dt: number) {
    const state=this.campaign,operation=state.operation!,tasks=this.mission.tasks!,task=activeCampaignTask(state),player=this.actors.get(this.humanId)!
    if(task.timeLimitMs){operation.remainingMs=Math.max(0,operation.remainingMs-dt);if(!operation.remainingMs){this.finish();state.radio=`CONTROL: ${task.title} failed. The device detonated. Retry the checkpoint.`;this.events.push({type:'explosion',position:task.position});return}}
    this.followCaptive(dt)
    const inZone=this.near(player,task.position,task.radius)
    const enemies=[...this.actors.values()].filter(a=>a.bot&&a.participating!==false&&a.health>0)
    const targets=task.kind==='clear'?enemies.filter(a=>task.enemyIds?.includes(a.id)):[]
    operation.enemiesRemaining=targets.length
    operation.targets=targets.map(a=>({x:a.x,y:a.y,z:a.z}))
    operation.contested=(task.kind==='defend'||task.kind==='extract')&&enemies.some(a=>this.near(a,task.position,task.radius+2))
    if(task.kind==='defend' && this.elapsed>=this.nextReinforcementPlan){
      const activeWaves=tasks.slice(0,operation.index+1).flatMap(t=>t.reinforcements??[]).map(n=>`bot-${n}`)
      this.investigate(activeWaves,task.position);this.nextReinforcementPlan=this.elapsed+2500
    }
    const escortReady=task.kind!=='extract'||!state.following||this.near(state.captive,task.position,task.radius)
    state.canInteract=inZone&&!operation.contested&&!targets.length&&escortReady
    if(state.canInteract)state.progressMs+=dt
    else if(!inZone||task.kind!=='defend')state.progressMs=0
    if(state.progressMs<task.durationMs)return
    if(task.kind==='rescue')state.following=true
    if(operation.index===tasks.length-1){this.completeMission();return}
    const index=operation.index+1,next=tasks[index]!
    this.checkpoint(index===tasks.length-1?'extract':'rescue',index)
    state.operation={index,remainingMs:next.timeLimitMs??0,contested:false,enemiesRemaining:0,targets:[]}
    for(const n of next.reinforcements??[]){
      const guard=this.actors.get(`bot-${n}`)!
      guard.participating=true
      if(!state.save.cleared.includes(guard.id)){Object.assign(guard,this.mission.guards[n],{health:100,protectedUntil:this.elapsed+1000,ammo:24,reloadUntil:0});this.events.push({type:'spawn',actorId:guard.id,yaw:guard.yaw})}
    }
    state.radio=`CONTROL: Checkpoint saved. ${next.reinforcements?.length?'Enemy reinforcements incoming. ':''}${next.instruction}`
  }
  override step(delta = TICK_MS) {
    if (this.phase !== 'playing') return
    const mission = this.mission
    super.step(delta)
    const dt = Math.max(0, Math.min(delta, TICK_MS)), player = this.actors.get(this.humanId)!, state = this.campaign
    this.updateGrenades(dt)
    if (player.health <= 0) { this.finish(); state.radio = 'CONTROL: We lost contact. Regroup at the last checkpoint.'; return }
    if (mission.tasks) { this.stepOperation(dt); return }
    if (state.stage !== 'extract') {
      const target = state.stage === 'relay' ? mission.relay : mission.captive
      state.canInteract = this.near(player, target, mission.interactionRadius)
      state.progressMs = state.canInteract ? state.progressMs + dt : 0
      if (state.progressMs >= mission.interactMs) {
        if (state.stage === 'relay') { this.checkpoint('rescue'); state.radio = `CONTROL: Checkpoint saved. ${mission.objectives.rescue.instruction}` }
        else { this.checkpoint('extract'); state.following = mission.kind === 'extraction'; state.radio = state.following ? `${mission.companion.toUpperCase()}: I’m with you. Lead the way to extraction.` : 'CONTROL: Charge armed. Reach the safe zone for remote detonation.' }
      }
      return
    }
    this.followCaptive(dt)
    const extracting = this.near(player, mission.extraction, mission.extractionRadius) && (!state.following || this.near(state.captive, mission.extraction, mission.extractionRadius))
    state.progressMs = extracting ? state.progressMs + dt : 0
    if (state.progressMs >= mission.extractMs) {
      if (mission.kind === 'sabotage') this.events.push({type:'explosion',position:mission.captive})
      this.completeMission()
    }
  }
}
