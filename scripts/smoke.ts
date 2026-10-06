import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { Client, type Room } from '@colyseus/sdk'
import type { Combatant, GameEvent } from '../packages/shared/src/combat.ts'
interface State {
  actors: { size: number; get(id: string): Combatant | undefined }
  phase: string
  elapsed: number
  round: number
}
const port = 2568,
  child = spawn(process.execPath, ['apps/match/dist/index.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: '',
      TRAINING_TEST_DURATION_MS: '7000',
      MATCH_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
let logs = ''
child.stdout.on('data', (d) => (logs += d))
child.stderr.on('data', (d) => (logs += d))
const rooms: Room<State>[] = [],
  delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let heartbeat: ReturnType<typeof setInterval> | undefined
async function until(check: () => boolean | Promise<boolean>) {
  const end = Date.now() + 10000
  while (Date.now() < end) {
    if (await check()) return
    await delay(40)
  }
  throw new Error(`Smoke timeout: ${logs}`)
}
try {
  await until(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${port}/health`)).ok
    } catch {
      return false
    }
  })
  const client = new Client(`ws://127.0.0.1:${port}`),
    a = await client.create<State>('training'),
    b = await client.create<State>('training')
  rooms.push(a, b)
  let shotEvents = 0
  a.onMessage('event', (e: GameEvent) => {
    if (e.type === 'shot') shotEvents++
  })
  b.onMessage('event', () => {})
  assert.notEqual(a.roomId, b.roomId)
  await until(() => a.state?.actors?.size === 6 && b.state?.actors?.size === 6)
  assert.equal(a.state.phase, 'ready')
  assert.equal(b.state.phase, 'ready')
  a.send('action', 'start')
  a.send('input', { x: 1, z: 0, yaw: 0, pitch: 0, fire: true, aim: false })
  await until(() => a.state.actors.get(a.sessionId)!.x > 0.1)
  await delay(550)
  const stopped = a.state.actors.get(a.sessionId)!.x
  await delay(200)
  assert.equal(a.state.actors.get(a.sessionId)!.x, stopped)
  assert.equal(b.state.elapsed, 0)
  assert.ok(a.state.actors.get(a.sessionId)!.ammo < 24)
  a.send('input', { x: 999, z: 0, yaw: 0, pitch: 0, fire: true, aim: false })
  await delay(150)
  assert.equal(a.state.actors.get(a.sessionId)!.x, stopped)
  await until(() => a.state.phase === 'paused')
  const frozen = a.state.elapsed
  await delay(150)
  assert.equal(a.state.elapsed, frozen)
  heartbeat = setInterval(
    () => a.send('input', { x: 0, z: 0, yaw: 0, pitch: 0, fire: false, aim: false }),
    50,
  )
  a.send('action', 'start')
  a.send('action', 'reload')
  await until(() => a.state.actors.get(a.sessionId)!.ammo === 24)
  await until(() => a.state.phase === 'finished')
  assert.equal(a.state.elapsed, 7000)
  assert.ok(shotEvents > 0)
  a.send('action', 'restart')
  await until(() => a.state.phase === 'ready' && a.state.round === 2)
  assert.equal(a.state.elapsed, 0)
  a.send('action', 'start')
  await until(() => a.state.phase === 'playing')
  a.send('action', 'finish')
  await until(() => a.state.phase === 'finished')
  console.info(
    'PASS: isolated personal rooms, six actors, validated movement, stale-input stop/auto-pause, authoritative shots/ammo/reload, pause/resume, natural timer completion, replay, early finish',
  )
} finally {
  clearInterval(heartbeat)
  for (const room of rooms) await room.leave()
  const exit = once(child, 'exit')
  child.kill('SIGTERM')
  const force = setTimeout(() => child.kill('SIGKILL'), 5000)
  await exit
  clearTimeout(force)
}
