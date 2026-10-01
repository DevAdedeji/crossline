import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { Client, type Room } from '@colyseus/sdk'

interface State { players: { size: number; get(id: string): { x: number; z: number } | undefined } }
const port = 2568
const child = spawn(process.execPath, ['apps/match/dist/index.js'], { env: { ...process.env, NODE_ENV: 'test', MATCH_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
child.stdout.on('data', (data) => { logs += data })
child.stderr.on('data', (data) => { logs += data })
const rooms: Room<State>[] = []
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) { if (await check()) return; await delay(40) }
  throw new Error(`Smoke check timed out. Match server output:\n${logs}`)
}
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/health`)).ok } catch { return false } })
  const client = new Client(`ws://127.0.0.1:${port}`)
  const a = await client.joinOrCreate<State>('training'); rooms.push(a)
  const b = await client.joinOrCreate<State>('training'); rooms.push(b)
  assert.equal(a.roomId, b.roomId)
  await until(() => a.state?.players?.size === 2 && b.state?.players?.size === 2)
  const initial = a.state.players.get(a.sessionId)!.x
  a.send('input', { x: 1, z: 0 })
  await until(() => a.state.players.get(a.sessionId)!.x > initial + 0.1)
  await delay(450)
  const stopped = a.state.players.get(a.sessionId)!.x
  await delay(200)
  assert.equal(a.state.players.get(a.sessionId)!.x, stopped, 'stale inputs must stop movement')
  assert.equal(b.state.players.get(a.sessionId)!.x, stopped, 'both clients observe the same authoritative position')
  a.send('input', { x: 999999, z: 0 }); await delay(150)
  assert.equal(a.state.players.get(a.sessionId)!.x, stopped, 'invalid movement must be rejected')
  await b.leave(); rooms.pop()
  await until(() => a.state.players.size === 1)
  console.info('PASS: health, two-client join, authoritative movement, stale input timeout, invalid input rejection, synchronized state, disconnect cleanup')
} catch (error) {
  console.error(logs)
  throw error
} finally {
  for (const room of rooms) await room.leave()
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const force = setTimeout(() => child.kill('SIGKILL'), 5000)
  await exited; clearTimeout(force)
}
