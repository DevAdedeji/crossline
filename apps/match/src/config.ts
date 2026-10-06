import { onlineCapacity } from './capacity.js'
export function matchConfig(env: NodeJS.ProcessEnv) {
  onlineCapacity(env)
  const production = env.NODE_ENV === 'production',
    port = Number(env.MATCH_PORT ?? env.PORT ?? 2567),
    host = env.MATCH_HOST ?? '127.0.0.1',
    origin = env.WEB_ORIGIN ?? 'http://127.0.0.1:3000'
  const url = new URL(origin)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('MATCH_PORT must be a valid TCP port')
  if (url.origin !== origin || url.username || url.password)
    throw new Error('WEB_ORIGIN must be one exact origin without a trailing slash')
  if (production) {
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      throw new Error('Production requires an exact public HTTPS WEB_ORIGIN')
    if (
      env.AUTH_DEV_LOCAL === '1' ||
      env.AUTH_LOCAL_PATH ||
      env.CROSSLINE_LOCAL_LOAD ||
      env.TRAINING_TEST_DURATION_MS
    )
      throw new Error('Local fixture and load settings are forbidden in production')
    if (
      !env.DATABASE_URL ||
      !env.BETTER_AUTH_SECRET ||
      env.BETTER_AUTH_SECRET.length < 32 ||
      !env.MATCH_PROXY_SECRET ||
      env.MATCH_PROXY_SECRET.length < 32 ||
      env.MATCH_PROXY_SECRET === env.BETTER_AUTH_SECRET
    )
      throw new Error('Production requires PostgreSQL and distinct strong auth/proxy secrets')
    // Publicly trusted providers use Node's CA store; private provider CAs are optional.
  } else if (host !== '127.0.0.1')
    throw new Error('Development match servers must bind to loopback')
  return { production, port, host, origin }
}
