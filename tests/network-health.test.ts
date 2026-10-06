import test from 'node:test'
import assert from 'node:assert/strict'
import { NetworkHealth } from '../apps/web/app/game/networkHealth.ts'
test('network health measures acknowledgments, bounds loss and recovers without stale acknowledgments', () => {
  const health = new NetworkHealth()
  health.reset(0)
  health.command(1, 10)
  health.acknowledge(1, 310)
  assert.equal(health.state(320), 'weak')
  health.command(2, 350)
  health.acknowledge(2, 390)
  assert.equal(health.state(400), 'good')
  for (let seq = 3; seq < 1000; seq++) health.command(seq, 400)
  assert.equal(health.state(1390), 'stalled')
  health.acknowledge(1, 1400)
  assert.equal(health.state(1401), 'stalled')
  health.acknowledge(999, 1410)
  assert.equal(health.state(1411), 'weak')
  health.command(1000, 1450)
  health.acknowledge(1000, 1490)
  assert.equal(health.state(1500), 'good')
  assert.equal(health.state(1500, 9000), 'stalled')
})
