import type { Position } from './index.js'
export type CampaignTaskKind = 'interact' | 'clear' | 'defend' | 'defuse' | 'plant' | 'rescue' | 'extract'
export interface CampaignTask {
  id: string
  kind: CampaignTaskKind
  title: string
  instruction: string
  position: Position
  durationMs: number
  radius: number
  timeLimitMs?: number
  enemyIds?: readonly string[]
  reinforcements?: readonly number[]
}
