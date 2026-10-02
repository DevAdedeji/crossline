import { guestStore, closeGuestStore } from './online/GuestStore.js'
import { defineServer, defineRoom, createRouter, createEndpoint } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { getNavigation } from './training/navigation.js'
import { ROOM_NAME, COMBAT_WORLD } from '@crossline/shared'
import { OnlineRoom, arenaStatus } from './OnlineRoom.js'
import { TrainingRoom, SoloRoom } from './TrainingRoom.js'

const port = Number(process.env.MATCH_PORT ?? process.env.PORT ?? 2567)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MATCH_PORT must be a valid TCP port')
const host = process.env.MATCH_HOST ?? '127.0.0.1'
const origin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000'
if (process.env.NODE_ENV === 'production') throw new Error('This unauthenticated Crossline match server is local-only until production access controls are implemented')
const server = defineServer({
  rooms: { [ROOM_NAME]: defineRoom(TrainingRoom), solo: defineRoom(SoloRoom), ffa: defineRoom(OnlineRoom) },
  routes: createRouter({ arena:createEndpoint('/arena',{method:'GET'},async()=>arenaStatus()), leaderboard:createEndpoint('/leaderboard',{method:'GET'},async()=>guestStore().leaderboard()), health: createEndpoint('/health', { method: 'GET' }, async () => ({ status: 'ok', service: 'crossline-match' })) }),
  transport: new WebSocketTransport({ maxPayload: 1024, verifyClient: ({ origin: requestOrigin }: { origin: string }) => !requestOrigin || requestOrigin === origin }),
  gracefullyShutdown: false,
  greet: false,
})
// Build cached navigation in small yielding batches before accepting any matches.
await getNavigation(COMBAT_WORLD).precompute()
await server.listen(port, host)
console.info(JSON.stringify({ event: 'match.listening', host, port }))
let stopping = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, async () => {
  if (stopping) return
  stopping = true
  await server.gracefullyShutdown(false)
  await closeGuestStore()
  process.exit(0)
})
