import { TICK_MS } from '@crossline/shared'
import { RIFLE, type Combatant, type GameMode } from '@crossline/shared/combat'
/** Predict muzzle/audio only; damage, hit markers and ammo remain server-confirmed. */
export class WeaponFeedback {
  private last = -Infinity
  private confirmed = 0
  private pending = 0
  reset() {
    this.last = -Infinity
    this.confirmed = 0
    this.pending = 0
  }
  sync(actor: Combatant) {
    if (actor.shots < this.confirmed || actor.health <= 0) {
      this.reset()
    }
    this.pending = Math.max(0, this.pending - Math.max(0, actor.shots - this.confirmed))
    this.confirmed = actor.shots
    if (actor.reloadUntil) this.pending = 0
  }
  fire(now: number, held: boolean, actor: Combatant, elapsed: number, mode: GameMode) {
    // If confirmations stop arriving, feedback must not invent an endless magazine.
    if (
      !held ||
      actor.health <= 0 ||
      actor.participating === false ||
      actor.reloadUntil ||
      actor.ammo - this.pending <= 0 ||
      (mode !== 'training' && mode !== 'campaign' && actor.protectedUntil > elapsed)
    )
      return false
    if (now - this.last < Math.ceil(RIFLE.intervalMs / TICK_MS) * TICK_MS) return false
    this.last = now
    this.pending++
    return true
  }
}
