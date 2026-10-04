import { parseCampaignProgress, type CampaignProgress } from '@crossline/shared/campaign'
const KEY = 'crossline.campaign.last-signal.v1'
export function readCampaignProgress(): CampaignProgress {
  try { return parseCampaignProgress(JSON.parse(localStorage.getItem(KEY) ?? 'null')) }
  catch { return parseCampaignProgress(null) }
}
export function saveCampaignProgress(progress: CampaignProgress): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); return true } catch { return false }
}
