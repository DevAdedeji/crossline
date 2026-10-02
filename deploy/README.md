# Hosting preparation — not activated

No service, credentials, email domain, database or deployment has been provisioned. Provider account access, plan eligibility, quotas and the existing Railway spending limit still need verification. These files do not authorize deployment or paid upgrades.

## Intended topology

Vercel serves Nuxt (`apps/web` with shared workspace packages included). Railway runs one long-lived match process. PostgreSQL stores verified accounts and transactional score records. Keep one match replica: room budgets, admission counters, replay detection and the eight-seat arena are process-local. Restarts reset live matches; committed account totals remain in PostgreSQL.

The browser sends auth and matchmaking HTTP requests to the same-origin Nuxt gateway. Gameplay uses WSS directly. Nuxt signs each forwarded request using a server-only secret, binding method, path/query, body, cookie, verified client IP, timestamp and nonce. Railway rejects unsigned/tampered/expired/replayed requests before allocating rooms. The Vercel gateway trusts only the platform-overwritten `x-vercel-forwarded-for` header when `VERCEL=1`; arbitrary hosting proxies require a separately reviewed adapter. Do not manually set `VERCEL=1` on another host. Raw forwarding headers never decide the match server's auth rate-limit bucket.

## Inactive configuration

Web service:

- `NUXT_PUBLIC_MATCH_URL=wss://<match-host>` (public, never a secret).
- `NUXT_WEB_ORIGIN=https://<web-host>` (exact origin, no trailing slash).
- `NUXT_MATCH_PROXY_SECRET` (server-only; same value as match secret below).

Match service:

- `NODE_ENV=production`, `MATCH_HOST=0.0.0.0`, platform `PORT` (omit local `MATCH_PORT`).
- `WEB_ORIGIN=https://<web-host>` exactly matching the web configuration. CORS and browser WebSocket origins are restricted to it.
- `DATABASE_URL` and `DATABASE_CA_FILE` pointing to the provider CA certificate supplied securely at runtime. Remote TLS verifies certificates; no insecure bypass is offered.
- `BETTER_AUTH_SECRET` and a distinct `MATCH_PROXY_SECRET`, each at least 32 strong random characters. No actual secrets are included or generated here.
- `AUTH_EMAIL_ENABLED=1`, `AUTH_EMAIL_FROM` and `AUTH_EMAIL_PROVIDER=resend` with server-only `RESEND_API_KEY`; alternatively provider `smtp` with `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `SMTP_PASSWORD`.
- `DB_POOL_MAX=3` (allowed 1–5); `FFA_MAX_CLIENTS=8` (allowed 2–8).

Resend uses only its fixed HTTPS endpoint with a 10-second timeout, no redirects and redacted errors. SMTP requires verified TLS/STARTTLS and bounded timeouts. There is no ambiguous automatic email retry. Railway Hobby SMTP restrictions make HTTPS the intended option; verify current plan terms before setup. Sender-domain verification and API keys remain external setup tasks. Nothing in the local verification suite sends real email.

The production configuration rejects local auth, local database/load fixtures, insecure origins, missing CA and missing/equal secrets. Startup queries the account tables before exposing the listener. Migration execution remains separate: after explicit authorization and target verification, `pnpm db:migrate` reads exported variables or `packages/db/.env` and applies the checked-in migrations using the same PostgreSQL TLS/CA/pool helper as runtime. Never put credentials in source, screenshots, reports or logs.

## Limits and failure behavior

Guest Solo/Practice share four rooms, two per verified client IP. Reservations count toward the global budget; normal disposal reclaims it. Paused/menu rooms expire after two minutes; all guest rooms expire after 30 minutes. Join attempts are limited to 30 per IP per minute. Rate-limit and signature-nonce maps have bounded sizes and fail closed when full. HTTP request headers/body timeouts and WebSocket payload limits constrain individual connections. These limits are not a substitute for platform DDoS controls.

Better Auth retains persisted per-endpoint rate limits, verified email, secure HttpOnly SameSite cookies, account-bound one-time admission tickets, and reconnect/logout checks. The gateway preserves verification redirects and all Set-Cookie headers. Guest play remains available without account creation.

Online commits each elimination to an idempotent transactional ledger before publishing score state and kill events. A database failure pauses simulation and retries the same IDs; no confirmed score relies on an in-memory retry queue. This trades availability/latency for durable confirmation. A crash can lose an unconfirmed tick or post-commit notification, and there is no live match-state recovery. Measure hosted DB latency before launch. Earlier local capacity measurements predate this change and do not certify hosted throughput.

`AUTH_DEV_LOCAL=1` is for nonproduction loopback only. It uses synthetic `@example.test` accounts and captured verification messages under ignored `.crossline-local/`. Local and browser tests do not demonstrate actual provider mail delivery, Aiven TLS connectivity, Vercel header delivery, Railway WSS or physical-phone performance. Those integrations, account quotas, spending protection, monitoring and deployment approval remain outstanding.

Sources: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Railway outbound networking](https://docs.railway.com/networking/outbound-networking), [Aiven TLS certificates](https://aiven.io/docs/platform/concepts/tls-ssl-certificates), [Resend on Railway](https://resend.com/docs/send-with-railway).
