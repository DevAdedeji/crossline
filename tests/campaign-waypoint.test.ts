import test from 'node:test'
import assert from 'node:assert/strict'
import { campaignWaypoints } from '../apps/web/app/game/campaignWaypoint.js'
import { CampaignGame } from '../packages/shared/src/simulation/CampaignGame.js'
import { EXTRACTION_MISSION as mission } from '../packages/shared/src/campaign.js'

test('Finch waypoint projects in front, stays on screen behind, and switches to extraction after rescue', () => {
  const state = new CampaignGame('human', {
    version: 1,
    checkpoint: 'rescue',
    completed: false,
    cleared: [],
  }).campaign
  const view = {
    x: mission.captive.x,
    y: 1.6,
    z: mission.captive.z - 20,
    yaw: 0,
    pitch: 0,
    fov: 1.2,
  }
  const front = campaignWaypoints(state, view, 1280, 720, false)[0]!
  assert.equal(front.id, 'finch')
  assert.equal(front.edge, false)
  assert.equal(front.x, 50)
  assert.equal(front.distance, 20)
  const behind = campaignWaypoints(state, { ...view, yaw: Math.PI }, 1280, 720, false)[0]!
  assert.equal(behind.edge, true)
  assert.ok(behind.x >= 10 && behind.x <= 90)
  state.stage = 'extract'
  state.following = true
  const extraction = campaignWaypoints(state, view, 844, 390, true)[0]!
  assert.equal(extraction.id, 'extraction')
  assert.equal(extraction.edge, true)
  assert.ok(extraction.x >= 20 && extraction.x <= 80)
  assert.ok(extraction.y >= 34 && extraction.y <= 66)
  state.waiting = true
  assert.deepEqual(
    campaignWaypoints(state, view, 844, 390, true).map((p) => p.id),
    ['extraction', 'finch'],
  )
  state.outcome = 'success'
  assert.deepEqual(campaignWaypoints(state, view, 844, 390, true), [])
})
