import type { Page } from '@playwright/test'
import { CAMPAIGN_GUARDS } from '../../packages/shared/src/campaign'
/** Saved cleared guards isolate input/audio tests without adding a production test hook. */
export async function quietCampaign(page: Page) {
  await page.addInitScript(
    (cleared) =>
      localStorage.setItem(
        'crossline.campaign.last-signal.v1',
        JSON.stringify({ version: 1, checkpoint: 'relay', cleared, completed: false }),
      ),
    CAMPAIGN_GUARDS.map((_, i) => `bot-${i}`),
  )
}
