import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  openGuestDatabase,
  type GuestRepository,
  type GuestRow,
  type Leaders,
} from '@crossline/db/server'
export interface GuestSession {
  id: string
  displayName: string
  token: string
}
export function memoryGuestRepository(): GuestRepository {
  const rows = new Map<string, GuestRow>(),
    events = new Set<string>()
  return {
    async find(hash) {
      const row = [...rows.values()].find((r) => r.tokenHash === hash)
      return row ? { ...row } : undefined
    },
    async create(row) {
      if (rows.size >= 10000) throw new Error('Guest capacity reached')
      rows.set(row.id, { ...row })
    },
    async record(id, killer, victim) {
      if (events.has(id) || killer === victim) return false
      const a = rows.get(killer),
        b = rows.get(victim)
      if (!a || !b) throw new Error('Unknown guest')
      if (events.size >= 100000) throw new Error('Temporary stats capacity reached')
      events.add(id)
      a.kills++
      b.deaths++
      return true
    },
    async leaders() {
      const values = [...rows.values()].map(({ id, displayName, kills, deaths }) => ({
        id,
        displayName,
        kills,
        deaths,
      }))
      return {
        topKills: [...values]
          .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id.localeCompare(b.id))
          .slice(0, 10),
        topDeaths: [...values]
          .sort((a, b) => b.deaths - a.deaths || b.kills - a.kills || a.id.localeCompare(b.id))
          .slice(0, 10),
      }
    },
  }
}
export class GuestStore {
  private pending = new Map<string, { killer: string; victim: string }>()
  private flushing = false
  private failed = false
  constructor(
    readonly repository: GuestRepository,
    readonly durable = false,
  ) {}
  async identify(token: unknown, name: unknown): Promise<GuestSession> {
    const supplied = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : undefined
    const hash = (value: string) => createHash('sha256').update(value).digest('hex')
    const existing = supplied ? await this.repository.find(hash(supplied)) : undefined
    if (existing) return { id: existing.id, displayName: existing.displayName, token: supplied! }
    const id = randomUUID(),
      issued = randomBytes(32).toString('hex')
    const label =
      typeof name === 'string'
        ? name
            .replace(/[^a-zA-Z0-9 _-]/g, '')
            .trim()
            .slice(0, 16)
        : ''
    const displayName = `${label || 'OPERATOR'}-${id.slice(0, 4).toUpperCase()}`
    await this.repository.create({ id, tokenHash: hash(issued), displayName, kills: 0, deaths: 0 })
    return { id, displayName, token: issued }
  }
  enqueue(id: string, killer: string, victim: string) {
    if (killer === victim) return
    if (this.pending.size >= 1000) {
      this.failed = true
      console.warn('Leaderboard queue full; persistence requires attention')
      return
    }
    this.pending.set(id, { killer, victim })
    void this.flush()
  }
  async flush() {
    if (this.flushing) return
    this.flushing = true
    try {
      for (const [id, event] of this.pending) {
        await this.repository.record(id, event.killer, event.victim)
        this.pending.delete(id)
      }
      this.failed = false
    } catch {
      this.failed = true
      console.warn('Leaderboard write delayed; retry pending')
    } finally {
      this.flushing = false
    }
  }
  async leaderboard(): Promise<Leaders & { durable: boolean; delayed: boolean }> {
    const board = await this.repository.leaders()
    // Colyseus HTTP serialization treats shared object references as circular; each public row is independent.
    const rows = (values: Leaders['topKills']) =>
      values.map(({ id, displayName, kills, deaths }) => ({ id, displayName, kills, deaths }))
    return {
      topKills: rows(board.topKills),
      topDeaths: rows(board.topDeaths),
      durable: this.durable,
      delayed: this.failed || this.pending.size > 0,
    }
  }
}
let singleton: GuestStore | undefined, closeDatabase: (() => Promise<void>) | undefined
export function guestStore() {
  if (!singleton) {
    const url = process.env.DATABASE_URL
    if (url) {
      const database = openGuestDatabase(url)
      closeDatabase = database.close
      singleton = new GuestStore(database.repository, true)
    } else singleton = new GuestStore(memoryGuestRepository())
  }
  return singleton
}
export async function closeGuestStore() {
  await singleton?.flush()
  await closeDatabase?.()
}
