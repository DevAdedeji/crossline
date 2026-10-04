/** World bearing: yaw zero faces north (+Z), positive yaw turns right. */
export function attackBearing(player: { x: number; z: number }, source: { x: number; z: number }) {
  if (Math.hypot(source.x - player.x, source.z - player.z) < .01) return undefined
  return Math.atan2(source.x - player.x, source.z - player.z) * 180 / Math.PI
}
export function relativeBearing(bearing: number, heading: number) {
  return ((bearing - heading) % 360 + 540) % 360 - 180
}
