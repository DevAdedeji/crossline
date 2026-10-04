import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attackBearing, relativeBearing } from '../apps/web/app/game/combatFeedback'
import { touchPreferences, DEFAULT_TOUCH_PREFERENCES } from '../apps/web/app/game/touchPreferences'

test('incoming fire remains aligned to its source when the player turns across north', () => {
  const player = { x: 10, z: 10 }
  assert.equal(attackBearing(player, { x: 10, z: 20 }), 0)
  assert.equal(attackBearing(player, { x: 20, z: 10 }), 90)
  assert.equal(attackBearing(player, { x: 0, z: 10 }), -90)
  assert.equal(relativeBearing(0, 90), -90)
  assert.equal(relativeBearing(10, 350), 20)
  assert.equal(relativeBearing(-170, 170), 20)
  assert.equal(relativeBearing(90, -270), 0)
  assert.equal(attackBearing(player, player), undefined)
})

test('stored touch preferences reject invalid data and stay within usable layout limits', () => {
  for (const value of [null, 'invalid', {}, { size: 'large', opacity: NaN }]) {
    assert.deepEqual(touchPreferences(value), DEFAULT_TOUCH_PREFERENCES)
  }
  assert.deepEqual(touchPreferences({ size: 999, opacity: -1 }), { size: 120, opacity: 35 })
  assert.deepEqual(touchPreferences({ size: 85, opacity: 95 }), { size: 85, opacity: 95 })
})
