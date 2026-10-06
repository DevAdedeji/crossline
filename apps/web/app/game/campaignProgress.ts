import {
  getCampaignMission,
  parseCampaignProgress,
  type CampaignProgress,
} from '@crossline/shared/campaign'
const key = (id: string) => `crossline.campaign.${getCampaignMission(id).id}.v1`
export function readCampaignProgress(missionId = 'last-signal'): CampaignProgress {
  try {
    return parseCampaignProgress(
      JSON.parse(localStorage.getItem(key(missionId)) ?? 'null'),
      missionId,
    )
  } catch {
    return parseCampaignProgress(null, missionId)
  }
}
export function saveCampaignProgress(progress: CampaignProgress): boolean {
  try {
    localStorage.setItem(key(progress.missionId ?? 'last-signal'), JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}
