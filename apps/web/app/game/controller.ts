import { readStick } from '@crossline/shared'

export function controllerButtons(pad: Gamepad): boolean[] {
  return pad.buttons.map((button) => button.pressed || button.value > 0.5)
}

export function controllerActivity(pad: Gamepad): boolean {
  const left = readStick(pad.axes[0], pad.axes[1])
  const right = readStick(pad.axes[2], pad.axes[3])
  return Math.hypot(left.x, left.y, right.x, right.y) > 0.12 || controllerButtons(pad).some(Boolean)
}

/** Prefer the device being used, including generic USB pads without a browser mapping label. */
export function selectController(
  pads: (Gamepad | null)[],
  preferred?: number,
): Gamepad | undefined {
  const connected = pads.filter((pad): pad is Gamepad => Boolean(pad?.connected))
  return (
    connected.find(controllerActivity) ??
    connected.find((pad) => pad.index === preferred) ??
    connected.find((pad) => pad.mapping === 'standard') ??
    connected[0]
  )
}

export type FireBinding =
  | { kind: 'button'; index: number }
  | { kind: 'axis'; index: number; rest: number; direction: number }
export const DEFAULT_FIRE_BINDING: FireBinding = { kind: 'button', index: 7 }
export function controllerFire(pad: Gamepad, binding: FireBinding = DEFAULT_FIRE_BINDING): boolean {
  if (binding.kind === 'button') {
    const button = pad.buttons[binding.index]
    return Boolean(button && (button.pressed || button.value > 0.25))
  }
  const value = pad.axes[binding.index]
  return Number.isFinite(value) && (value! - binding.rest) * binding.direction > 0.35
}
export function loadFireBinding(id: string): FireBinding {
  try {
    const saved = JSON.parse(localStorage.getItem(`crossline.fire.${id}`) ?? 'null')
    if (saved && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < 32) {
      if (saved.kind === 'button') return saved
      if (
        saved.kind === 'axis' &&
        Number.isFinite(saved.rest) &&
        Math.abs(saved.rest) <= 1 &&
        Math.abs(saved.direction) === 1
      )
        return saved
    }
  } catch {
    /* A blocked or unavailable preference store must not disable controls. */
  }
  return DEFAULT_FIRE_BINDING
}
