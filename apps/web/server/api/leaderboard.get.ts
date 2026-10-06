import type { Leaderboard } from '@crossline/shared'
export default defineEventHandler(async (event): Promise<Leaderboard> => {
  const config = useRuntimeConfig(event),
    url = new URL(String(config.public.matchUrl))
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  url.pathname = '/leaderboard'
  url.search = ''
  try {
    const response = await fetch(url.href, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error('Unavailable')
    return (await response.json()) as Leaderboard
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Leaderboard temporarily unavailable' })
  }
})
