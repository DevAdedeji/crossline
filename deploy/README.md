# Hosting configuration

Crossline has a Vercel Hobby frontend at https://crossline-three.vercel.app, a dedicated Neon Free project (`lucky-wildflower-20999788`) in the separate Crossline organization, and a private Railway project (`53c80f78-e308-480f-bd26-6ea7d96cb3d7`). The Neon schema migrations have been applied with verified TLS. The match endpoint is https://crosslinematch-production.up.railway.app, and production configuration is complete. Live Chrome checks passed Practice movement over WSS, immediate signup and Online admission, login, session persistence, secure cookies and logout. Public health and the Nuxt arena gateway returned HTTP 200; unsigned direct auth and untrusted-origin requests returned HTTP 403. Existing projects and the Railway spending cap remain unchanged.

## Topology

Vercel serves Nuxt (`apps/web` with shared workspace packages included). Railway runs one long-lived match process. PostgreSQL stores accounts and transactional score records. Keep one match replica: room budgets, admission counters, replay detection and the single 100-seat arena are process-local. Restarts reset live matches; committed account totals remain in PostgreSQL.

The browser sends auth and matchmaking HTTP requests to the same-origin Nuxt gateway. Gameplay uses WSS directly. Nuxt signs each forwarded request using a server-only secret, binding method, path/query, body, cookie, verified client IP, timestamp and nonce. Railway rejects unsigned/tampered/expired/replayed requests before allocating rooms. The Vercel gateway trusts only the platform-overwritten `x-vercel-forwarded-for` header when `VERCEL=1`; arbitrary hosting proxies require a separately reviewed adapter. Do not manually set `VERCEL=1` on another host. Raw forwarding headers never decide the match server's auth rate-limit bucket.

## Configuration

Web service:

- `NUXT_PUBLIC_MATCH_URL=wss://crosslinematch-production.up.railway.app` (public, never a secret).
- `NUXT_WEB_ORIGIN=https://crossline-three.vercel.app` (exact origin, no trailing slash).
- `NUXT_MATCH_PROXY_SECRET` (server-only; same value as match secret below).

Match service:

- `NODE_ENV=production`, `MATCH_HOST=0.0.0.0`, platform `PORT` (omit local `MATCH_PORT`).
- `WEB_ORIGIN=https://crossline-three.vercel.app` exactly matching the web configuration. CORS and browser WebSocket origins are restricted to it.
- `DATABASE_URL`. Remote TLS always verifies certificates using Node’s trusted CA store (including Neon). For providers with a private CA, set `DATABASE_CA_FILE` to a securely supplied certificate file. No insecure bypass is offered.
- `BETTER_AUTH_SECRET` and a distinct `MATCH_PROXY_SECRET`, each at least 32 strong random characters. Actual values are excluded from source control and entered through the provider dashboards.
- `DB_POOL_MAX=3` (allowed 1–5); `FFA_MAX_CLIENTS=100` (allowed 2–100).

Signup requires username, email and password and establishes a session immediately. Login requires email/password. No email-provider login, domain verification, sender credentials, SMTP or Resend dependency remains. New addresses stay `emailVerified=false`; account access is not proof of email ownership. Password reset, account linking and email changes are deferred, and the verification/reset HTTP routes are not exposed.

The production configuration rejects local auth, local database/load fixtures, insecure origins and missing/equal secrets. Startup queries the account tables before exposing the listener. Migration execution remains separate: after explicit authorization and target verification, `pnpm db:migrate` reads exported variables or `packages/db/.env` and applies the checked-in migrations using the same PostgreSQL TLS/CA/pool helper as runtime. Never put credentials in source, screenshots, reports or logs.

## Limits and failure behavior

Guest Solo/Practice share four rooms, two per verified client IP. Reservations count toward the global budget; normal disposal reclaims it. Paused/menu rooms expire after two minutes; all guest rooms expire after 30 minutes. Join attempts are limited to 30 per IP per minute. Rate-limit and signature-nonce maps have bounded sizes and fail closed when full. HTTP request headers/body timeouts and WebSocket payload limits constrain individual connections. These limits are not a substitute for platform DDoS controls.

Better Auth retains persisted per-endpoint rate limits, secure HttpOnly SameSite cookies, account-bound one-time admission tickets, and reconnect/logout checks. The gateway preserves session cookies. Guest play remains available without account creation.

Online commits each elimination to an idempotent transactional ledger before publishing score state and kill events. A database failure pauses simulation and retries the same IDs; no confirmed score relies on an in-memory retry queue. This trades availability/latency for durable confirmation. A crash can lose an unconfirmed tick or post-commit notification, and there is no live match-state recovery. Measure hosted DB latency before launch. Earlier local capacity measurements predate this change and do not certify hosted throughput.

`AUTH_DEV_LOCAL=1` is for nonproduction loopback only. It stores local accounts under ignored `.crossline-local/`; automated tests use synthetic addresses. Local-only tests do not demonstrate hosted integration or physical-phone performance. The hosted Chrome smoke check now covers Vercel header delivery and Railway WSS; physical-phone performance and production reconnect/load behavior still need separate validation. The configured 100-seat cap still requires staged load validation; previous measurements covered only 8/16/32 local clients before commit-before-confirmation changes.

Sources: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Aiven TLS certificates](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).

## Neon idle behavior

Neon Free includes 100 compute-unit hours per project each month and suspends idle compute after five minutes. The persistent arena skips leaderboard and session database polling when it has no clients. Health and arena status use memory; the PostgreSQL pool closes idle connections after 20 seconds. Pending score commits still retry until durable, even after players disconnect. Active players, explicit leaderboard requests and account operations legitimately wake the database. A connected player can keep it active; the free allowance is not a 24/7 database guarantee.

## PWA release behavior

The Nuxt build emits `/manifest.webmanifest`, `/sw.js`, local install icons and an offline reconnect page. Vercel serves the worker and manifest with revalidation headers. The worker exposes the deployed Git commit through its `GET_RELEASE` message for smoke checks; it contains no secret configuration. Builds use `VERCEL_GIT_COMMIT_SHA` when available.

The client owns registration and prompts. There is no automatic `skipWaiting` or active-match reload; a waiting worker checks all open window URLs before accepting a menu update. API requests pass straight to the network. Browser integration tests exercise real worker installation, offline fallback, cache eviction and two worker revisions on a local HTTP fixture.
