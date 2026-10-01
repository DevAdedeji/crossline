import { Room, type Client } from '@colyseus/core'
import { schema, t, type SchemaType } from '@colyseus/schema'
import { INPUT_TIMEOUT_MS, TICK_MS, move, parseInput, type MoveInput, SPAWNS } from '@crossline/shared'

const Player = schema({ x: t.number(), y: t.number(), z: t.number() }, 'Player')
export const TrainingState = schema({ players: t.map(Player) }, 'TrainingState')
export type TrainingState = SchemaType<typeof TrainingState>

export class TrainingRoom extends Room<{ state: TrainingState }> {
  maxClients = 8
  private movementInputs = new Map<string, { value: MoveInput; receivedAt: number }>()
  onCreate() {
    this.setState(new TrainingState())
    this.setPatchRate(TICK_MS)
    this.onMessage('input', (client, value: unknown) => {
      const input = parseInput(value)
      if (input) this.movementInputs.set(client.sessionId, { value: input, receivedAt: this.clock.elapsedTime })
    })
    this.setSimulationInterval(() => {
      for (const [id, player] of this.state.players) {
        const input = this.movementInputs.get(id)
        const movement = input && this.clock.elapsedTime - input.receivedAt <= INPUT_TIMEOUT_MS ? input.value : { x: 0, z: 0 }
        Object.assign(player, move(player, movement, TICK_MS))
      }
    }, TICK_MS)
  }
  onJoin(client: Client) {
    const player = new Player()
    Object.assign(player, SPAWNS[this.state.players.size % SPAWNS.length])
    this.state.players.set(client.sessionId, player)
  }
  onLeave(client: Client) {
    this.movementInputs.delete(client.sessionId)
    this.state.players.delete(client.sessionId)
  }
}
