import { TICK_MS, move, type Position } from '@crossline/shared'
import { worldHit } from '@crossline/shared/combat'
import { TrainingGame } from './TrainingGame.js'
import { CAMPAIGN_WORLD, CAMPAIGN_GUARDS, EXTRACTION_MISSION as mission, parseCampaignProgress, type CampaignState } from '../campaign.js'

/** Mission rules stay in the simulation, never in UI proximity checks. */
export class CampaignGame extends TrainingGame {
  campaign: CampaignState
  private interacting = false
  private escortPath: Position[] = []
  private nextEscortPlan = 0
  constructor(id: string, progress: unknown = undefined, random: () => number = Math.random) {
    super(id, 0, random, 'solo', {
      world: CAMPAIGN_WORLD, spawns: [mission.spawn, ...CAMPAIGN_GUARDS], botCount: CAMPAIGN_GUARDS.length, respawn: false,
      healthPacks: [{ id: 'relay-supplies', x: 3, y: 0, z: 26, availableAt: 0 }, { id: 'south-supplies', x: -24, y: 0, z: -28, availableAt: 0 }],
    })
    const save = parseCampaignProgress(progress)
    this.campaign = { stage: save.checkpoint, checkpoint: save.checkpoint, outcome: 'active', progressMs: 0, canInteract: false,
      captive: { ...mission.captive, yaw: Math.PI }, following: save.checkpoint === 'extract', waiting: false,
      radio: 'CONTROL: Get to the relay. Finch is counting on us.', save }
    this.restoreCheckpoint()
  }
  private restoreCheckpoint() {
    const state = this.campaign, save = state.save
    state.stage = save.checkpoint; state.checkpoint = save.checkpoint; state.outcome = 'active'
    state.progressMs = 0; state.canInteract = false; state.following = save.checkpoint === 'extract'; state.waiting = false
    state.captive = { ...mission.captive, yaw: Math.PI }
    state.radio = state.following ? 'FINCH: I’m with you. Keep me close and get us to the vehicle.' : state.stage === 'rescue' ? 'CONTROL: Alarm is down. Finch is inside the relay office.' : 'CONTROL: Get to the relay. Finch is counting on us.'
    this.interacting = false; this.escortPath = []; this.nextEscortPlan = 0
    this.elapsed = save.elapsedMs ?? 0
    const spawn = state.stage === 'extract' ? mission.escortSpawn : state.stage === 'rescue' ? mission.rescueSpawn : mission.spawn
    Object.assign(this.actors.get(this.humanId)!, spawn, { protectedUntil: this.elapsed + 4000, yaw: 0 })
    for (const id of save.cleared) { const guard = this.actors.get(id); if (guard) guard.health = 0 }
    this.events.push({ type: 'spawn', actorId: this.humanId, yaw: 0 })
  }
  override restart() {
    super.restart()
    this.restoreCheckpoint()
  }
  override pause() { this.interacting = false; this.campaign.progressMs = 0; super.pause() }
  override finish() {
    this.campaign.outcome = 'failed'
    this.campaign.radio = 'CONTROL: Operation aborted. Your last checkpoint is available.'
    super.finish()
  }
  interact(held: boolean) { this.interacting = this.phase === 'playing' && held }
  private checkpoint(stage: CampaignState['stage']) {
    const state = this.campaign
    state.stage = stage; state.checkpoint = stage; state.progressMs = 0; state.canInteract = false
    state.save = { ...state.save, checkpoint: stage, elapsedMs: this.elapsed,
      cleared: [...this.actors.values()].filter(a => a.bot && a.health <= 0).map(a => a.id) }
    this.interacting = false
  }
  private near(point: Position, target: Position, radius: number) {
    if (Math.abs(point.y - target.y) > 1 || Math.hypot(point.x-target.x, point.z-target.z) > radius) return false
    const dx = target.x-point.x, dz = target.z-point.z, length = Math.hypot(dx,dz)
    return length < .01 || worldHit({ ...point, y: point.y + 1 }, {x:dx/length,y:0,z:dz/length}, length, this.world) >= length - .05
  }
  override step(delta = TICK_MS) {
    if (this.phase !== 'playing') return
    super.step(delta)
    const dt = Math.max(0, Math.min(delta, TICK_MS)), player = this.actors.get(this.humanId)!, state = this.campaign
    if (player.health <= 0) { this.finish(); state.radio = 'CONTROL: We lost contact. Regroup at the last checkpoint.'; return }
    if (state.stage !== 'extract') {
      const target = state.stage === 'relay' ? mission.relay : mission.captive
      state.canInteract = this.near(player, target, 2.8)
      state.progressMs = state.canInteract && this.interacting ? state.progressMs + dt : 0
      if (state.progressMs >= mission.interactMs) {
        if (state.stage === 'relay') { this.checkpoint('rescue'); state.radio = 'CONTROL: Alarm disabled. Checkpoint saved. Find Finch in the relay office.' }
        else { this.checkpoint('extract'); state.following = true; state.radio = 'FINCH: You came back for me. Lead the way. I’ll follow you to extraction.' }
      }
      return
    }
    const distance = Math.hypot(player.x-state.captive.x, player.z-state.captive.z)
    state.waiting = distance > 18
    state.canInteract = false
    if (!state.waiting && distance > 2.5) {
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
    const extracting = this.near(player, mission.extraction, 5) && this.near(state.captive, mission.extraction, 5)
    state.progressMs = extracting ? state.progressMs + dt : 0
    if (state.progressMs >= mission.extractMs) {
      state.outcome = 'success'; state.radio = mission.debrief
      const bestTimeMs = Math.min(state.save.bestTimeMs ?? Infinity, this.elapsed)
      state.save = { version: 1, checkpoint: 'relay', cleared: [], completed: true, bestTimeMs }
      super.finish()
    }
  }
}
