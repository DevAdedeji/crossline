import { boundedBody, clientIP, signProxy } from '@crossline/shared/proxy'
import {
  type H3Event,
  getRequestURL,
  getRequestHeader,
  toWebRequest,
  sendWebResponse,
  createError,
} from 'h3'
export async function matchProxy(event: H3Event, path: string) {
  const config = useRuntimeConfig(event),
    url = new URL(String(config.public.matchUrl)),
    secure = url.protocol === 'wss:'
  if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password)
    throw createError({ statusCode: 503, statusMessage: 'Match service configuration unavailable' })
  if (!secure && !['127.0.0.1', 'localhost'].includes(url.hostname))
    throw createError({ statusCode: 503, statusMessage: 'Secure match connection required' })
  url.protocol = secure ? 'https:' : 'http:'
  url.pathname = path
  url.search = getRequestURL(event).search
  if (process.env.VERCEL === '1' && !secure)
    throw createError({ statusCode: 503, statusMessage: 'Secure match connection required' })
  const origin = getRequestHeader(event, 'origin'),
    cookie = getRequestHeader(event, 'cookie') ?? '',
    headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    }
  if (
    secure &&
    (!config.webOrigin ||
      new URL(config.webOrigin).origin !== config.webOrigin ||
      !config.webOrigin.startsWith('https://'))
  )
    throw createError({ statusCode: 503, statusMessage: 'Web origin configuration unavailable' })
  if (secure && origin && origin !== config.webOrigin)
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  let body: string
  try {
    body = await boundedBody(toWebRequest(event))
  } catch {
    throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  }
  if (secure) {
    // Vercel overwrites this platform header. Never enable forwarded-IP trust on an arbitrary host.
    if (process.env.VERCEL !== '1')
      throw createError({ statusCode: 503, statusMessage: 'Trusted web proxy is not configured' })
    let ip: string
    try {
      ip = clientIP(getRequestHeader(event, 'x-vercel-forwarded-for') ?? '')
    } catch {
      throw createError({ statusCode: 403, statusMessage: 'Client address unavailable' })
    }
    Object.assign(
      headers,
      signProxy(
        String(config.matchProxySecret),
        event.method,
        url.pathname + url.search,
        body,
        ip,
        cookie,
      ),
    )
  }
  const response = await fetch(url, {
    method: event.method,
    headers,
    ...(body ? { body } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  })
  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('cache-control', 'no-store')
  return sendWebResponse(
    event,
    new Response(response.body, { status: response.status, headers: responseHeaders }),
  )
}
