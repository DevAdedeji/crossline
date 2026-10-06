/** Smooth small step changes only; horizontal aiming and collision remain immediate. */
export class StairCamera {
  private height: number | undefined
  reset() {
    this.height = undefined
  }
  update(target: number, dt: number): number {
    if (this.height === undefined || Math.abs(target - this.height) > 0.75) this.height = target
    else this.height += (target - this.height) * (1 - Math.exp(-Math.max(0, dt) * 18))
    return this.height
  }
}
