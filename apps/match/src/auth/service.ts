import { boundedBody } from '@crossline/shared/proxy'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer, oneTimeToken, username } from 'better-auth/plugins'
import * as schema from '@crossline/db'
import { openAccountDatabase, AccountStatistics } from '@crossline/db/auth'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'

export interface OnlineIdentity {
  id: string
  displayName: string
  sessionId: string
  sessionToken: string
  expiresAt: number
}
export function createAccountService(options: {
  database: Awaited<ReturnType<typeof openAccountDatabase>>
  baseURL: string
  secret: string
  local: boolean
}) {
  const auth = betterAuth({
    appName: 'Crossline',
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [options.baseURL],
    database: drizzleAdapter(options.database.db, { provider: 'pg', schema }),
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: !options.local,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: { ipAddressHeaders: ['x-crossline-client-ip'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 20 },
        '/one-time-token/generate': { window: 60, max: 120 },
      },
    },
    account: { accountLinking: { enabled: false } },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 16,
        immutableUsername: true,
        usernameValidator: (v) => /^[a-zA-Z0-9_]{3,16}$/.test(v),
        displayUsernameValidator: (v) => /^[a-zA-Z0-9_]{3,16}$/.test(v),
      }),
      bearer(),
      oneTimeToken({ expiresIn: 1, storeToken: 'hashed', disableSetSessionCookie: true }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (data) => {
            const name = (data as typeof data & { username?: string }).username
            if (!name || !/^[a-z0-9_]{3,16}$/.test(name))
              throw new APIError('BAD_REQUEST', { message: 'Choose a valid username.' })
            return { data: { ...data, name } }
          },
        },
      },
    },
  })
  const statistics = new AccountStatistics(options.database.db)
  async function identity(
    value: Awaited<ReturnType<typeof auth.api.getSession>>,
  ): Promise<OnlineIdentity> {
    const user = value?.user as
      | (NonNullable<typeof value>['user'] & { username?: string })
      | undefined
    if (
      !value ||
      !user?.username ||
      !/^[a-z0-9_]{3,16}$/.test(user.username) ||
      new Date(value.session.expiresAt).getTime() <= Date.now()
    )
      throw new Error('Sign in to Online')
    return {
      id: user.id,
      displayName: user.username,
      sessionId: value.session.id,
      sessionToken: value.session.token,
      expiresAt: new Date(value.session.expiresAt).getTime(),
    }
  }
  return {
    auth,
    statistics,
    local: options.local,
    close: options.database.close,
    async admit(token: unknown) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 256)
        throw new Error('Sign in to Online')
      const value = await auth.api.verifyOneTimeToken({ body: { token } })
      const who = await identity(value)
      await statistics.ensure(who.id)
      return who
    },
    async valid(who: OnlineIdentity) {
      try {
        const current = await identity(
          await auth.api.getSession({
            headers: new Headers({ authorization: `Bearer ${who.sessionToken}` }),
          }),
        )
        return current.id === who.id && current.sessionId === who.sessionId
      } catch {
        return false
      }
    },
  }
}
export type AccountService = ReturnType<typeof createAccountService>
let service: Promise<AccountService> | undefined
export function accountService() {
  if (!service)
    service = initialize().catch((error) => {
      service = undefined
      throw error
    })
  return service
}
async function initialize() {
  const baseURL = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000',
    host = process.env.MATCH_HOST ?? '127.0.0.1'
  const local = process.env.AUTH_DEV_LOCAL === '1'
  if (
    local &&
    (process.env.NODE_ENV === 'production' ||
      host !== '127.0.0.1' ||
      new URL(baseURL).hostname !== '127.0.0.1')
  )
    throw new Error('Local auth is restricted to loopback development')
  if (!local) {
    const secret = process.env.BETTER_AUTH_SECRET,
      url = process.env.DATABASE_URL
    if (!secret || secret.length < 32 || !url || new URL(baseURL).protocol !== 'https:')
      throw new Error('Approved account database, strong auth secret and HTTPS origin are required')
    const database = await openAccountDatabase({ url, migrations: '' })
    return createAccountService({ database, baseURL, secret, local: false })
  }
  // Explicit local fixture secret, never accepted for a public/production server.
  const secret = 'crossline-local-fixture-secret-not-for-production-2026'
  let root = dirname(fileURLToPath(import.meta.url))
  while (!existsSync(resolve(root, 'packages/db/drizzle')) && dirname(root) !== root)
    root = dirname(root)
  const migrations = process.env.AUTH_MIGRATIONS_DIR ?? resolve(root, 'packages/db/drizzle')
  const database = await openAccountDatabase({
    localPath: process.env.AUTH_LOCAL_PATH ?? resolve(root, '.crossline-local/accounts'),
    migrations,
  })
  return createAccountService({ database, baseURL, secret, local })
}
export async function closeAccountService() {
  if (service) {
    const value = await service
    await value.statistics.flush()
    await value.close()
  }
}
export async function handleAccountRequest(request: Request) {
  const headers = { 'cache-control': 'no-store' },
    url = new URL(request.url),
    path = url.pathname.replace(/^\/api\/auth/, '')
  const origin = request.headers.get('origin')
  if (origin && origin !== (process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000'))
    return Response.json({ message: 'Unable to continue' }, { status: 403, headers })
  let value: AccountService
  try {
    value = await accountService()
  } catch {
    return Response.json(
      { message: 'Online accounts are not configured. Solo and Practice are available.' },
      { status: 503, headers },
    )
  }
  if (path === '/status') return Response.json({ available: true, local: value.local }, { headers })

  const allowed = new Set([
    '/sign-up/email',
    '/sign-in/email',
    '/sign-out',
    '/get-session',
    '/one-time-token/generate',
  ])
  if (!allowed.has(path)) return Response.json({ message: 'Unavailable' }, { status: 404, headers })
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    return Response.json({ message: 'Request too large' }, { status: 413, headers })
  // requestGuard authenticates this IP; direct callers cannot set a forwarding header.
  const safeHeaders = new Headers(request.headers)
  if (process.env.NODE_ENV !== 'production') safeHeaders.set('x-crossline-client-ip', '127.0.0.1')
  if (!safeHeaders.get('x-crossline-client-ip'))
    return Response.json({ message: 'Forbidden' }, { status: 403, headers })
  let body: string | undefined
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') body = await boundedBody(request)
  } catch {
    return Response.json({ message: 'Request too large' }, { status: 413, headers })
  }
  const response = await value.auth.handler(
    new Request(request.url, {
      method: request.method,
      headers: safeHeaders,
      ...(body ? { body } : {}),
    }),
  )
  response.headers.set('cache-control', 'no-store')
  if (!response.ok) {
    return Response.json(
      {
        message:
          response.status === 429
            ? 'Too many attempts. Wait a minute and retry.'
            : 'Unable to continue. Check your email and password.',
      },
      { status: response.status, headers: response.headers },
    )
  }
  return response
}
