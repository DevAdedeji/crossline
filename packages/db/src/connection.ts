import { readFileSync } from 'node:fs'
/** Shared by runtime and migrations: verify certificates, including provider CAs. */
export function databaseOptions(url: string, env: NodeJS.ProcessEnv = process.env) {
  const parsed = new URL(url),
    max = Number(env.DB_POOL_MAX ?? 3)
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol))
    throw new Error('DATABASE_URL must be a PostgreSQL URL')
  if (!Number.isInteger(max) || max < 1 || max > 5) throw new Error('DB_POOL_MAX must be 1–5')
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)
  if (env.NODE_ENV === 'production' && local)
    throw new Error('Production requires a hosted PostgreSQL database')
  const ca = env.DATABASE_CA_FILE ? readFileSync(env.DATABASE_CA_FILE, 'utf8') : undefined
  return {
    max,
    idle_timeout: 20,
    connect_timeout: 5,
    max_lifetime: 1800,
    ssl: local ? (false as const) : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connection: { statement_timeout: 5000 },
  }
}
