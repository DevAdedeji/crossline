import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { Client, type Room } from '@colyseus/sdk'
import { createTestAccount } from './test-account.ts'
const port = 2571,
  base = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['apps/match/dist/index.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: '',
    AUTH_DEV_LOCAL: '1',
    AUTH_LOCAL_PATH: ':memory:',
    MATCH_PORT: String(port),
    MATCH_HOST: '127.0.0.1',
    WEB_ORIGIN: base,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
child.stdout.on('data', (d) => (logs += d))
child.stderr.on('data', (d) => (logs += d))
const rooms: Room[] = [],
  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until(check: () => boolean | Promise<boolean>, label: string, timeout = 10000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(30)
  }
  throw new Error(label)
}
try {
  await until(async () => {
    try {
      return (await fetch(base + '/health')).ok
    } catch {
      return false
    }
  }, 'auth smoke server ready')
  assert.equal(
    (
      await fetch(base + '/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: '{}',
      })
    ).status,
    404,
  )
  assert.equal(
    (
      await fetch(base + '/api/auth/dev-inbox?email=securealpha@example.test', {
        headers: { origin: 'https://attacker.example' },
      })
    ).status,
    403,
  )
  assert.equal(
    ((await (await fetch(base + '/arena')).json()) as { capacity: number }).capacity,
    100,
    'default admission is 100 before room creation',
  )
  const client = new Client(base.replace('http', 'ws')),
    a = await createTestAccount(base, 'securealpha'),
    b = await createTestAccount(base, 'securebravo')
  for (const route of ['dev-inbox', 'send-verification-email', 'verify-email'])
    assert.equal((await fetch(base + '/api/auth/' + route)).status, 404)
  await assert.rejects(() =>
    client.joinOrCreate('ffa', { name: 'securealpha', guestToken: 'a'.repeat(64), id: a.id }),
  )
  const ticket = await a.token(),
    room = await client.joinOrCreate('ffa', { joinToken: ticket, name: 'IMPOSTER', userId: b.id })
  rooms.push(room)
  await until(() => room.state?.capacity === 100, 'real shared room uses the 100-seat default')
  const events: unknown[] = []
  room.onMessage('*', (_type, message) => events.push(message))
  await until(
    () => room.state?.actors?.get(room.sessionId)?.name === 'securealpha',
    'server bound username',
  )
  await assert.rejects(() => client.joinById(room.roomId, { joinToken: ticket }), 'ticket replay')
  const duplicate = await a.token()
  await assert.rejects(
    () => client.joinById(room.roomId, { joinToken: duplicate }),
    'duplicate account',
  )
  const other = await client.joinById(room.roomId, { joinToken: await b.token() })
  rooms.push(other)
  other.onMessage('*', () => {})
  room.send('action', 'start')
  await until(
    () => room.state.actors.get(room.sessionId).participating,
    'authenticated actor starts',
  )
  const reconnect = room.reconnectionToken,
    id = room.sessionId
  room.reconnection.enabled = false
  room.connection.close()
  await until(() => other.state.actors.get(id)?.connected === false, 'drop visible')
  const recovered = await client.reconnect(reconnect)
  rooms.push(recovered)
  recovered.onMessage('*', () => {})
  await until(() => recovered.state?.actors?.get(id), 'reconnect state')
  const x = recovered.state.actors.get(id).x
  for (let i = 0; i < 5; i++) {
    recovered.send('action', 'start')
    recovered.send('input', { x: 1, z: 0, yaw: 0, pitch: 0, fire: true, aim: false })
    await sleep(60)
  }
  assert.equal(recovered.state.actors.get(id).x, x, 'reconnection alone grants no input authority')
  recovered.send('authenticate', await b.token())
  await until(() => !other.state.actors.get(id), 'wrong-account reconnect removed')
  await a.logout()
  await assert.rejects(() => a.token(), 'logged out session cannot mint tickets')
  await b.logout()
  let closed = false
  other.onLeave(() => (closed = true))
  await until(() => closed, 'logout revokes live socket within session poll', 6000)
  const board = JSON.stringify(await (await fetch(base + '/leaderboard')).json())
  for (const secret of ['@example.test', 'sessionToken', 'tokenHash', 'password'])
    assert.equal(board.includes(secret), false)
  assert.equal(JSON.stringify(events).includes('@example.test'), false)
  const status = (await (await fetch(base + '/arena')).json()) as { seats: number }
  assert.equal(status.seats, 0)
  console.info(
    'PASS: immediate signup and account-only admission, spoof/replay/duplicate rejection, reconnect requires same account session, unauthenticated reconnect input ignored, logout removes live players, public names/totals exclude private fields',
  )
} catch (error) {
  console.error('Auth network verification failed; server diagnostics:', logs)
  throw error
} finally {
  for (const room of rooms) {
    room.reconnection.enabled = false
    try {
      void room.leave()
    } catch {}
  }
  const exit = once(child, 'exit')
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
  await exit
  clearTimeout(timer)
}
