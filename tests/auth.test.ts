import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { openAccountDatabase } from '../packages/db/src/auth.ts'
import { createAccountService } from '../apps/match/src/auth/service.ts'
import * as schema from '../packages/db/src/schema.ts'
const { eq } = createRequire(new URL('../packages/db/package.json', import.meta.url))('drizzle-orm')
const base = 'http://127.0.0.1:3001',
  password = 'Synthetic-Test-Only-2026!'
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), 'crossline-auth-'))
  const database = await openAccountDatabase({
    localPath: path,
    migrations: resolve('packages/db/drizzle'),
  })
  const service = createAccountService({
    database,
    baseURL: base,
    secret: 'only-synthetic-local-auth-tests-no-production-use',
    local: true,
  })
  async function request(
    path: string,
    body?: object,
    cookie = '',
    ip = '127.0.0.2',
    origin = base,
  ) {
    return service.auth.handler(
      new Request(base + '/api/auth/' + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          'content-type': 'application/json',
          origin,
          'x-crossline-client-ip': ip,
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    )
  }
  async function signup(username: string) {
    const response = await request('sign-up/email', {
      username,
      name: username,
      email: username.toLowerCase() + '@example.test',
      password,
    })
    assert.equal(response.status, 200)
    return response
  }
  const cookies = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
  async function login(username: string) {
    const response = await request('sign-in/email', {
      email: username.toLowerCase() + '@example.test',
      password,
    })
    assert.equal(response.status, 200)
    return cookies(response)
  }
  async function token(cookie: string) {
    const response = await request('one-time-token/generate', undefined, cookie)
    assert.equal(response.status, 200)
    return ((await response.json()) as { token: string }).token
  }
  return {
    path,
    database,
    service,
    request,
    signup,
    login,
    token,
    cookies,
    async close() {
      await service.close()
      await rm(path, { recursive: true, force: true })
    },
  }
}
test('signup establishes a session without claiming email ownership; admission rejects forged and expired credentials', async (t) => {
  const f = await fixture()
  t.after(() => f.close())
  const signup = await f.signup('Alpha')
  const cookie = f.cookies(signup)
  assert.ok(cookie.includes('session_token'))
  assert.equal((await f.database.db.select().from(schema.user))[0]!.emailVerified, false)
  const login = await f.request('sign-in/email', { email: 'alpha@example.test', password })
  assert.equal(login.status, 200)
  await assert.rejects(() => f.service.admit('a'.repeat(64)))
  const ticket = await f.token(cookie),
    who = await f.service.admit(ticket)
  assert.equal(who.displayName, 'alpha')
  assert.equal(await f.service.valid(who), true)
  await assert.rejects(() => f.service.admit(ticket), 'single-use ticket rejects replay')
  const concurrentTicket = await f.token(cookie)
  const concurrent = await Promise.allSettled([
    f.service.admit(concurrentTicket),
    f.service.admit(concurrentTicket),
  ])
  assert.equal(
    concurrent.filter((result) => result.status === 'fulfilled').length,
    1,
    'concurrent redemption has one winner',
  )
  assert.equal(
    (await f.database.db.select().from(schema.account))[0]!.password === password,
    false,
    'library stores a password hash',
  )
  const raw = await f.database.db.select().from(schema.account)
  assert.match(raw[0]!.password!, /^[a-f0-9]+:/)
  await f.database.db
    .update(schema.session)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(schema.session.id, who.sessionId))
  assert.equal(await f.service.valid(who), false)
  await assert.rejects(() => f.token(cookie))
})
test('username uniqueness, required normalization and validation are enforced by the server', async (t) => {
  const f = await fixture()
  t.after(() => f.close())
  await f.signup('ALPHA')
  for (const body of [
    { username: 'alpha', name: 'imposter', email: 'other@example.test', password },
    { name: 'Missing', email: 'missing@example.test', password },
    { username: '<script>', name: 'bad', email: 'invalid@example.test', password },
    { username: 'short', name: 'short', email: 'short@example.test', password: 'short' },
    { username: 'badmail', name: 'badmail', email: 'not-an-email', password },
  ]) {
    const response = await f.request('sign-up/email', body)
    assert.ok(response.status >= 400)
  }
  const rows = await f.database.db.select().from(schema.user)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.username, 'alpha')
})
test('logout revokes session and join tickets, cross-origin mutations fail, and login attempts are rate limited', async (t) => {
  const f = await fixture()
  t.after(() => f.close())
  await f.signup('bravo')
  const cookie = await f.login('bravo')
  const who = await f.service.admit(await f.token(cookie)),
    unused = await f.token(cookie)
  const csrf = await f.request('sign-out', {}, cookie, '127.0.0.2', 'https://attacker.example')
  assert.equal(csrf.status, 403)
  assert.equal(await f.service.valid(who), true)
  const logout = await f.request('sign-out', {}, cookie)
  assert.equal(logout.status, 200)
  assert.equal(await f.service.valid(who), false)
  await assert.rejects(() => f.service.admit(unused))
  let last = 0
  for (let i = 0; i < 12; i++)
    last = (
      await f.request('sign-in/email', { email: 'nobody@example.test', password }, '', '127.0.0.9')
    ).status
  assert.equal(last, 429)
})
test('account statistics use authenticated IDs, deduplicate atomic events, exclude private fields and survive reopen', async (t) => {
  const f = await fixture()
  let closed = false
  t.after(async () => {
    if (!closed) await f.close()
    else await rm(f.path, { recursive: true, force: true })
  })
  await f.signup('killer')
  await f.signup('victim')
  const a = await f.service.admit(await f.token(await f.login('killer'))),
    b = await f.service.admit(await f.token(await f.login('victim'))),
    event = randomUUID()
  assert.equal(await f.service.statistics.record(event, a.id, b.id), true)
  assert.equal(await f.service.statistics.record(event, a.id, b.id), false)
  const ownGrenade = randomUUID()
  assert.equal(await f.service.statistics.record(ownGrenade, a.id, a.id), true)
  assert.equal(await f.service.statistics.record(ownGrenade, a.id, a.id), false)
  const ownStats = await f.database.db
    .select()
    .from(schema.accountStats)
    .where(eq(schema.accountStats.userId, a.id))
  assert.equal(ownStats[0]!.deaths, 1)
  assert.equal(ownStats[0]!.kills, 1)
  await assert.rejects(() => f.service.statistics.record(randomUUID(), a.id, 'forged-account'))
  const board = await f.service.statistics.leaderboard()
  assert.equal(board.topKills[0]!.displayName, 'killer')
  assert.equal(board.topKills[0]!.kills, 1)
  assert.equal(board.topDeaths[0]!.deaths, 1)
  const serialized = JSON.stringify(board)
  for (const secret of ['@example.test', 'email', 'token', 'password', a.sessionToken])
    assert.equal(serialized.includes(secret), false)
  await f.service.close()
  closed = true
  const reopened = await openAccountDatabase({
    localPath: f.path,
    migrations: resolve('packages/db/drizzle'),
  })
  try {
    const users = await reopened.db.select().from(schema.user)
    assert.equal(users.length, 2)
    const stats = await reopened.db.select().from(schema.accountStats)
    assert.equal(stats.find((s) => s.userId === a.id)!.kills, 1)
  } finally {
    await reopened.close()
  }
})
test('expired join tickets fail and public-cookie settings require Secure, HttpOnly and SameSite', async (t) => {
  const f = await fixture()
  t.after(() => f.close())
  await f.signup('cookiecheck')
  const cookie = await f.login('cookiecheck')
  const ticket = await f.token(cookie)
  await f.database.db.update(schema.verification).set({ expiresAt: new Date(Date.now() - 1000) })
  await assert.rejects(() => f.service.admit(ticket))
  const secure = createAccountService({
    database: f.database,
    baseURL: 'https://crossline.example',
    secret: 'synthetic-production-cookie-policy-test-fixture-only',
    local: false,
  })
  const response = await secure.auth.handler(
    new Request('https://crossline.example/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://crossline.example',
        'x-crossline-client-ip': '127.0.0.10',
      },
      body: JSON.stringify({ email: 'cookiecheck@example.test', password }),
    }),
  )
  assert.equal(response.status, 200)
  const values = response.headers.getSetCookie().join('; ')
  assert.match(values, /Secure/i)
  assert.match(values, /HttpOnly/i)
  assert.match(values, /SameSite=Lax/i)
})

test('first-run local auth creates nested private storage without an existing database directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'crossline-auth-first-run-'))
  try {
    const database = await openAccountDatabase({
      localPath: join(directory, 'nested', 'accounts'),
      migrations: resolve('packages/db/drizzle'),
    })
    try {
      assert.equal((await database.db.select().from(schema.user)).length, 0)
    } finally {
      await database.close()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('ordinary email signup signs in immediately while client-supplied email ownership stays unverified', async (t) => {
  const f = await fixture()
  t.after(() => f.close())
  const response = await f.request('sign-up/email', {
    username: 'ordinary',
    name: 'ordinary',
    email: 'player@example.com',
    password,
    emailVerified: true,
  })
  assert.equal(response.status, 200)
  const cookie = f.cookies(response),
    who = await f.service.admit(await f.token(cookie))
  assert.equal(who.displayName, 'ordinary')
  assert.equal((await f.database.db.select().from(schema.user))[0]!.emailVerified, false)
})
