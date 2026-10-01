import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rotateLook, MAX_PITCH } from '../apps/web/app/game/look.ts'

test('look can turn sideways, backwards, and through repeated full circles', () => {
  let view = { yaw: 0, pitch: 0 }
  for (let turn = 0; turn < 12; turn++) view = rotateLook(view, Math.PI / 2, 0)
  assert.ok(Math.abs(Math.sin(view.yaw)) < 0.000001)
  view = rotateLook(view, -Math.PI, 0)
  assert.ok(Math.abs(Math.cos(view.yaw) + 1) < 0.000001)
  assert.equal(view.pitch, 0)
})
test('looking up/down stays bounded without restricting horizontal rotation', () => {
  const up = rotateLook({ yaw: 0, pitch: 0 }, Math.PI, -100)
  assert.equal(up.pitch, -MAX_PITCH)
  assert.equal(up.yaw, Math.PI)
  assert.equal(rotateLook(up, 0, 100).pitch, MAX_PITCH)
})
