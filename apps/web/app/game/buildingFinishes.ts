/** Stable finishes shared by the wall shell and its facade modules. */
export const BUILDING_FINISHES = [
  { wall: '#bca88a', trim: '#7e776b', brick: true }, // natural brick / sandstone
  { wall: '#b5af9d', trim: '#78786e', brick: false }, // limestone
  { wall: '#82968b', trim: '#526760', brick: false }, // weathered sage
  { wall: '#8399a7', trim: '#526573', brick: false }, // blue grey
  { wall: '#bd9f6a', trim: '#79674d', brick: false }, // ochre plaster
  { wall: '#b58670', trim: '#73594d', brick: true }, // terracotta
] as const

export function buildingFinishIndex(id: string) {
  if (id === 'mercer-hospital') return 2
  let hash = 0
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
  return hash % BUILDING_FINISHES.length
}
