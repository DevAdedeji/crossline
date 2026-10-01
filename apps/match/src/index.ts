import { defineServer, defineRoom, createRouter, createEndpoint } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ROOM_NAME } from '@crossline/shared'
import { TrainingRoom } from './TrainingRoom.js'

const port = Number(process.env.MATCH_PORT ?? 2567)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MATCH_PORT must be a valid TCP port')
const host = process.env.MATCH_HOST ?? '127.0.0.1'
const origin = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000'
if (process.env.NODE_ENV === 'production') throw new Error('This unauthenticated training server is local-only until production access controls are implemented')
const server = defineServer({
  rooms: { [ROOM_NAME]: defineRoom(TrainingRoom) },
  routes: createRouter({ health: createEndpoint('/health', { method: 'GET' }, async () => ({ status: 'ok', service: 'crossline-match' })) }),
  transport: new WebSocketTransport({ maxPayload: 1024, verifyClient: ({ origin: requestOrigin }: { origin: string }) => !requestOrigin || requestOrigin === origin }),
  gracefullyShutdown: false,
  greet: false,
})
await server.listen(port, host)
console.info(JSON.stringify({ event: 'match.listening', host, port }))
let stopping = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, async () => {
  if (stopping) return
  stopping = true
  await server.gracefullyShutdown(false)
  process.exit(0)
})
