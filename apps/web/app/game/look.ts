export interface LookState {
  yaw: number
  pitch: number
}
export const MOUSE_SENSITIVITY = 0.0024
export const MAX_PITCH = 1.45

/** Yaw wraps for numeric stability but has no directional limit; pitch avoids flipping. */
export function rotateLook(view: LookState, yawDelta: number, pitchDelta: number): LookState {
  if (!Number.isFinite(yawDelta) || !Number.isFinite(pitchDelta)) return view
  return {
    yaw: (view.yaw + yawDelta) % (Math.PI * 2),
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, view.pitch + pitchDelta)),
  }
}
