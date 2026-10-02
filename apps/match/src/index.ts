import { matchConfig } from './config.js'
import { requestGuard } from './admission.js'
import { matchMaker } from '@colyseus/core'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { accountService, closeAccountService, handleAccountRequest } from './auth/service.js'
import { defineServer, defineRoom, createRouter, createEndpoint } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { getNavigation } from './training/navigation.js'
import { ROOM_NAME, COMBAT_WORLD } from '@crossline/shared'
import { OnlineRoom, arenaStatus } from './OnlineRoom.js'
import { TrainingRoom, SoloRoom } from './TrainingRoom.js'

const envFile=fileURLToPath(new URL('../.env',import.meta.url))
if(existsSync(envFile))process.loadEnvFile(envFile)
const config=matchConfig(process.env)
const {port,host,origin,production}=config
matchMaker.controller.getCorsHeaders=()=>({
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
 'Access-Control-Allow-Headers':'Content-Type, Authorization',
 'Access-Control-Allow-Credentials':'true',
 'Vary':'Origin',
})
const server = defineServer({
  rooms: { [ROOM_NAME]: defineRoom(TrainingRoom), solo: defineRoom(SoloRoom), ffa: defineRoom(OnlineRoom) },
  routes: createRouter({ auth:createEndpoint('/api/auth/**',{method:['GET','POST'],disableBody:true,requireRequest:true},async ctx=>handleAccountRequest(ctx.request)), arena:createEndpoint('/arena',{method:'GET'},async()=>arenaStatus()), leaderboard:createEndpoint('/leaderboard',{method:'GET'},async()=>(await accountService()).statistics.leaderboard()), health: createEndpoint('/health', { method: 'GET' }, async () => ({ status: 'ok', service: 'crossline-match' })) },{onRequest:requestGuard(config,process.env.MATCH_PROXY_SECRET)}),
  transport: new WebSocketTransport({ maxPayload: 1024, verifyClient: ({ origin: requestOrigin }: { origin: string }) => requestOrigin === origin || (!production && !requestOrigin) }),
  gracefullyShutdown: false,
  greet: false,
})
// Build cached navigation in small yielding batches before accepting any matches.
if(production)await (await accountService()).statistics.leaderboard()
await getNavigation(COMBAT_WORLD).precompute()
await server.listen(port, host)
if(server.transport.server){server.transport.server.requestTimeout=10000;server.transport.server.headersTimeout=5000;server.transport.server.maxRequestsPerSocket=100}
console.info(JSON.stringify({ event: 'match.listening', host, port }))
let stopping = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, async () => {
  if (stopping) return
  stopping = true
  await server.gracefullyShutdown(false)
  await closeAccountService()
  process.exit(0)
})
