export const DEFAULT_TOUCH_PREFERENCES = { size: 100, opacity: 80 }
export function touchPreferences(value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const clamp = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  return {
    size: clamp(input.size, 85, 120, DEFAULT_TOUCH_PREFERENCES.size),
    opacity: clamp(input.opacity, 35, 100, DEFAULT_TOUCH_PREFERENCES.opacity),
  }
}
