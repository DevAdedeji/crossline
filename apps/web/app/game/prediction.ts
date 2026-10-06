import { moveHuman, TICK_MS, type WorldGeometry, type Position } from '@crossline/shared'
import type { CombatInput, Combatant } from '@crossline/shared/combat'
type Body = Position & { crouch?: number }
/** Cosmetic prediction only. Server state remains the sole source of health, hits and scores. */
export class MovementPrediction {
  body: Body | undefined
  private pending: { seq: number; input: CombatInput }[] = []
  private stamp = ''
  private offset = { x: 0, y: 0, z: 0 }
  constructor(private world: WorldGeometry) {}
  reset(actor?: Combatant) {
    this.body = actor ? { x: actor.x, y: actor.y, z: actor.z, crouch: actor.crouch } : undefined
    this.pending = []
    this.offset = { x: 0, y: 0, z: 0 }
  }
  reconcile(actor: Combatant, round: number, enabled: boolean) {
    const stamp = `${round}/${actor.protectedUntil}/${actor.deaths}`
    if (!enabled || actor.health <= 0 || stamp !== this.stamp || !this.body) {
      this.stamp = stamp
      this.reset(actor)
      return
    }
    const before = this.body
    this.pending = this.pending.filter((entry) => entry.seq > (actor.inputSeq ?? 0))
    let next: Body = { x: actor.x, y: actor.y, z: actor.z, crouch: actor.crouch }
    for (const entry of this.pending) next = moveHuman(next, entry.input, TICK_MS, this.world)
    this.body = next
    const distance = Math.hypot(before.x - next.x, before.y - next.y, before.z - next.z)
    // Large authority corrections (respawns/teleports) snap; small drift settles without a camera jolt.
    if (distance < 1) {
      for (const axis of ['x', 'y', 'z'] as const) this.offset[axis] += before[axis] - next[axis]
    } else this.offset = { x: 0, y: 0, z: 0 }
  }
  command(seq: number, input: CombatInput) {
    if (!this.body || this.pending.length >= 30) return
    this.pending.push({ seq, input: { ...input } })
    this.body = moveHuman(this.body, input, TICK_MS, this.world)
  }
  view(input: CombatInput, remainder: number, dt: number): Body | undefined {
    if (!this.body) return
    const preview =
      this.pending.length < 30 ? moveHuman(this.body, input, remainder, this.world) : this.body
    const result = { ...preview }
    for (const axis of ['x', 'y', 'z'] as const) {
      this.offset[axis] *= Math.exp(-dt * 14)
      result[axis] += this.offset[axis]
    }
    return result
  }
}
