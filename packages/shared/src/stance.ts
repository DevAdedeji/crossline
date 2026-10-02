/** Stance is a server-owned fraction: 0 standing, 1 crouched. */
export const CROUCH = { height: 1.05, eye: .9, speed: .55, transitionMs: 180 } as const
export const stanceAmount = (actor: { crouch?: number }) => Math.max(0, Math.min(1, actor.crouch ?? 0))
export const stanceHeight = (actor: { crouch?: number }) => 1.75 - .7 * stanceAmount(actor)
export const stanceEye = (actor: { crouch?: number }) => 1.6 - .7 * stanceAmount(actor)
export const stanceAim = (actor: { crouch?: number }) => 1.1 - .45 * stanceAmount(actor)
export const stanceHead = (actor: { crouch?: number }) => 1.3 - .52 * stanceAmount(actor)
