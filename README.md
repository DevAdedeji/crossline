# Crossline

A browser shooter foundation: Nuxt 4 / Vue / Nuxt UI / Tailwind CSS 4, a client-only Babylon.js arena, a separate authoritative Colyseus Node.js match process, and a PostgreSQL / Drizzle schema.

## Run locally

Use Node 24 LTS and pnpm 11.10.0 (`corepack enable` if needed).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**. Enter training, click **Take control**, use **WASD** to move and the **mouse** to look. **Esc** releases the mouse. A second tab joins the same room and appears as a capsule. No account, database, environment file, API key, or paid service is needed. Desktop keyboard/mouse and WebGL are required.

The match process listens at `127.0.0.1:2567`; `/health` reports its status. The web origin is intentionally `127.0.0.1`, not `localhost`. Stop both with Ctrl-C. To run them separately: `pnpm dev:match` and `pnpm dev:web`.

## Implemented

- Landing page and first-person training arena, pointer lock, camera controls, visible remote players, connection/error states, and resource cleanup on exit.
- One training room, up to eight guest clients, 30 Hz server simulation and state patches. Clients send directional input; only the server computes positions. Input validation, diagonal normalization, arena bounds, payload limit, and a 250 ms stale-input timeout prevent obvious movement abuse.
- PostgreSQL schema and generated migration for player profiles, matches, and match participants, with foreign keys, uniqueness, timestamp and score checks.
- Unit, real WebSocket integration, and browser smoke checks.

## Boundaries and next work

This is a **movement prototype**, not a complete shooter. There are no weapons, damage, jumping, physics obstacles, bots, completed free-for-all rules, squad matchmaking, authentication, progression, or persisted results. Four-person squads and solo bots are roadmap modes; database enum values do not implement them. Future gunplay should prioritize responsive input, client prediction/reconciliation, interpolation, server-side hit validation and measured latency before adding content.

Authentication is intentionally deferred; Creda/Calendza use Better Auth, which is the preferred pattern to evaluate for future accounts. No auth code, secrets, or business logic was copied. The local match process defaults to loopback and refuses `NODE_ENV=production` until access controls, join/message rate limits, room resource budgets, secure origins/TLS, reconnect policy and observability are designed. An origin check is not authentication. Do not expose this prototype to the internet.

## Structure

```text
apps/web          Nuxt UI and client-only Babylon rendering
apps/match        Long-running authoritative Colyseus server
packages/shared   Movement protocol and deterministic movement rules
packages/db       Drizzle schema and SQL migration; not loaded by the demo
scripts/smoke.ts  Isolated real-server two-client integration check
```

The simulation stays out of Nuxt request handlers. Persistence stores durable identity/results, not per-frame positions. Future bot agents can supply validated inputs to the simulation; future modes should own explicit rules and lifecycle. Squad capacity and membership will need transactional enforcement when squad services are implemented.

## Verification

```sh
pnpm verify           # lint, all package typechecks, unit tests, builds, network smoke
pnpm exec playwright install chromium  # one-time browser download, if unavailable
pnpm test:browser     # production web build + built match server; ports 3000/2567 must be free
```

To reuse an installed Google Chrome instead of downloading Chromium: `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser`.

`pnpm test:smoke` launches the built match server on port 2568 and stops it afterward. It checks two-client join/state agreement, movement, invalid input rejection, stale-input stopping and leave cleanup. Browser verification checks navigation, WebGL canvas, connection, player count, pointer capture and WASD movement. Build before running either smoke command separately.

## Optional database

No database is contacted during normal development, build, or tests. For future persistence work, create your own local PostgreSQL database and put `DATABASE_URL` in `packages/db/.env` (see `.env.example`), then:

```sh
pnpm db:generate      # offline SQL generation after schema changes
pnpm db:migrate       # explicitly applies checked-in migration to your configured database
```

Review generated SQL before applying it. Applied migrations are immutable. The initial migration has not been applied to a live database as part of setup. Do not use production credentials for local development. Set connection pooling/timeouts when introducing a real repository layer.

## Configuration

`.env.example` documents optional variables. Nuxt reads `apps/web/.env`; database tooling reads `packages/db/.env`. Match variables are shell environment variables, e.g. `MATCH_PORT=2569 pnpm dev:match` with a matching `NUXT_PUBLIC_MATCH_URL` on the web client. Root `.env` is not automatically loaded. Keep real `.env` files out of Git.

No deployment is configured. Railway can be evaluated later with separately deployed web, long-running match, and PostgreSQL services after explicit deployment approval.

## Setup verification (2026-10-01)

Verified on Node 24.14.1 and pnpm 11.10.0: lint, all TypeScript checks (including verification scripts), three movement unit tests, both application builds, the real two-client WebSocket smoke test, and the Playwright browser flow using installed Google Chrome. Browser screenshots are in the ignored `test-results` folder after the browser test. The Babylon client chunk triggers a bundle-size warning; rendering loads only for the play route, and payload optimization remains future work. PostgreSQL migration generation passed; live database migration testing was intentionally not run. No services were deployed.

API references: [Nuxt installation](https://nuxt.com/docs/4.x/getting-started/installation), [Colyseus server/router](https://docs.colyseus.io/server), [Colyseus state schema](https://docs.colyseus.io/state/schema).
