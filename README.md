# Crossline

A locally runnable first-person browser shooter built with Nuxt 4 / Vue / Nuxt UI, Babylon.js, an authoritative Colyseus Node.js server, and an optional PostgreSQL / Drizzle persistence layer. No account, database, API key or paid service is required for the local game.

## Run

Use Node 24 and pnpm 11.10.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**. Enter an optional guest nickname and select a mode to launch directly. There is no Deploy step. The menu gesture prepares sound and mouse capture before assets load; browsers that decline capture offer a retry in the arena. Direct `/play` links still offer a Start button. Phones require landscape orientation. Stop both processes with Ctrl-C; separate commands are `pnpm dev:web` and `pnpm dev:match`.

- **Solo vs Bots:** five minutes against twelve bots, quick respawns, health packs, results with kills/deaths/accuracy and a personal-best score stored on this device. Play Again starts immediately. Bots target humans only; they never damage other bots. Patrols stay near the active player's district, but aiming/firing still requires real sight and cover checks.
- **Online Free-for-All:** one continuous human-only arena, join/leave anytime, unlimited respawns, health packs and general top-kills/top-deaths leaderboards in a standalone button/view (also accessible from the main screen). The single process admits up to eight clients, including reserved reconnect seats. A full arena offers a waiting/retry message; it never intentionally creates a second public arena. The cap is integration-tested, not a claim of internet-scale capacity.
- **Practice:** the smaller menu option opens a personal three-minute Training session with three stationary targets and two slow unarmed patrols. They never attack.

The match server defaults to `127.0.0.1:2567`. `/health` reports liveness, `/arena` reports public seat availability, and `/leaderboard` exposes only public totals. The web origin is deliberately `127.0.0.1`, not `localhost`.

## Controls

| Action | Keyboard / mouse | Standard controller | Landscape phone |
|---|---|---|---|
| Move / look | WASD / mouse | Left / right stick | Left stick / right-side swipe |
| Fire | Left click | A / × or RT / R2 | Hold FIRE |
| Aim | Right click | LT / L2 | Toggle AIM |
| Reload | R | X / □ | RELOAD |
| Crouch | C toggle / Ctrl hold | R3 toggle | CROUCH |
| Pause / menu | Esc | Start / Options or B / ○ | Pause button |
| Online leaderboard / back | Tab / Esc | View or Share / B or ○ | Leaderboard / Back |

A / × selects menus and fires in play. Release it after selecting or resuming before pressing to shoot. Controller axes have an 18% radial deadzone; Controls → Assign fire trigger supports generic layouts. Losing focus, disconnecting the active controller, or losing mouse capture releases input. Practice/Solo pause the whole simulation; Online only pauses your controls and leaves your character vulnerable.

Touch movement, look and fire support simultaneous fingers. Pointer cancellation, backgrounding and rotation to portrait release held input. Rotation back requires Resume. Safe-area layout, a reduced render resolution and 1024px shadows are used on touch devices. Chrome touch emulation checks 667×375 and 932×430; physical Android/iPhone and Safari behavior remain unverified.

## Combat and recovery

One CL-24 rifle is implemented: 24 rounds, unlimited reserve, 140ms shot interval, 1.6-second reload, 80m range, 25 body / 50 head damage. Movement, stance, ray hits, cover, ammunition, health, elimination and respawn belong to the server. Clients cannot submit damage, health, score or target IDs. Crouch changes speed, camera height, pose, shot origin and hit region; blocked headroom prevents standing into a ceiling.

Solo and Online start at 100 HP, use a visible health bar and have no passive human regeneration. Eleven ground supply cases heal up to 35 HP within 1.15m on the same floor, capped at 100, then cool down for 25 seconds of simulation time. Collection checks life, participation, spawn protection and line of sight; simultaneous claims have one winner. A short chime and `+N HP` cue report the actual gain. Practice retains regeneration and no packs.

Solo bots deal 16 body / 24 head damage, react after 900–1250ms, fire short bursts at 420ms spacing and rest between bursts. At most two bots sustain fire on one human simultaneously. Solo human protection lasts four seconds on entry/respawn. Zero HP causes a three-second respawn. This is an initial playtested balance, not a fixed survival guarantee.

Online drop/reload reconnect reserves the same session and vulnerable body for 20 seconds. Intentional departure removes the actor. Reconnect does not heal or reset the session score. Expired reservations free their seat; the ongoing room remains alive when empty until the process restarts.

## Map and presentation

Solo and Online share **Mercer Districts, 156 × 156m (24,336m²)**, compared with **52 × 52m** Practice. Nine districts contain 13 enterable buildings, 14 cars, connected roads, cover and distributed supplies/spawns. The larger Solo expansion is pending.

- **North Ironworks:** 34 × 26m factory, 8m hall, loading bays, machinery, crane, mezzanine, roof stairs/opening and 16m chimney.
- **Foundry Operations:** four accessible storeys and a 12.8m roof, connected by switchback stairs. Landing geometry supports slow analog movement as well as full-speed walking.
- **Mercer General Hospital:** 30 × 26m, three storeys, connected central corridors/wards, beds/lockers, emergency canopy, external stairs and a 9.6m accessible roof.

Collision, navigation and shot occlusion share authored geometry. Navigation uses spatially indexed neighbors, cached collision-checked edges and heap-based A*. Static rendering batches by material and 32m spatial cell; character presentation pauses beyond 95m. Crossing asphalt is split to avoid near-coplanar overlap. The reference images were inspected privately for street scale, atmosphere and restrained UI; no reference images or copied story/UI text are shipped.

Online names are small billboards, limited to 32m and hidden behind authoritative cover or for dead/nonparticipating actors. The radar and server-confirmed combat feedback remain separate. Assets are local: see [model provenance](apps/web/public/models/ATTRIBUTION.md) and [audio provenance](apps/web/public/audio/ATTRIBUTION.md). First-person hands are intentionally omitted. Recorded shot/reload sounds follow authoritative timing and mute/pause state.

## Guest identity and optional persistence

Nicknames are not identity. The server issues a random guest capability; the browser stores it locally and the database stores only its SHA-256 hash. A short stable suffix distinguishes duplicate nicknames. A forged/unknown capability creates a different guest; clients cannot choose a player ID or submit statistics. Clearing browser storage loses access to the old guest identity; recovery and accounts are not implemented.

Without `DATABASE_URL`, leaderboards are explicitly labeled **temporary server totals** and reset when the process restarts. With an approved PostgreSQL connection and migrations applied, server-confirmed elimination IDs update kill/death totals in one idempotent transaction. Reconnects and duplicate event retries do not add another kill. SQL migrations and persistence across reopen are tested with embedded PostgreSQL (PGlite); a hosted PostgreSQL/Aiven connection has not been exercised.

The server pool defaults to three connections (allowed 1–5), has bounded connection/query timeouts and verifies remote TLS. A bounded in-process retry queue shows delayed saving during failures; uncommitted events can be lost on a process crash. This is not a crash-proof event pipeline. Database failure never silently switches configured persistent totals to temporary totals.

The match process reads exported environment variables. Migration tooling alone reads `packages/db/.env`. No real `.env` or credentials belong in Git. For an explicitly chosen local database:

```sh
pnpm db:generate  # offline migration generation after schema changes
pnpm db:migrate   # applies migrations to the deliberately configured database
```

No hosted database is provisioned or migrated by this setup. See [.env.example](.env.example) and [hosting preparation](deploy/README.md) for safe configuration boundaries.

## Structure and verification

```text
apps/web           Nuxt UI, client-only Babylon scene, read-only leaderboard/arena proxy
apps/match         Long-running authoritative Colyseus server and guest stats service
packages/shared    Movement/combat protocol, geometry, collision, name visibility
packages/db        Drizzle schema, SQL migrations and bounded optional server repository
scripts/           Real-server WebSocket smoke checks and offline asset conversion
```

```sh
pnpm verify
PLAYWRIGHT_CHANNEL=chrome pnpm test:browser
```

`verify` runs lint, all TypeScript checks, units, both builds and both genuine-client network checks. Browser tests use the production build on ports 3001/2569 and the installed Chrome renderer. `pnpm exec playwright install chromium` is an alternative one-time browser install. Tests explicitly disable external database configuration. The network checks use isolated ports 2568/2570 and terminate their own children.

Coverage includes five-minute deterministic Solo simulations, human-only bot targeting, collision/stair routes, crouch clearance, pickup contention/protection, guest identity, transactional persistence/restart/deduplication, remote combat, reconnect reservations, singleton capacity, touch cancellation/orientation, mouse/controller fire/reload and real browser landmark walks with a second client's replicated elevation. Screenshots are saved under ignored `test-results/`.

## Checkpoint verification (2026-10-02)

- `pnpm verify`: passed lint (one non-failing `no-this-alias` warning), all TypeScript checks, 52 unit tests, web/match builds and both real-server network smoke checks.
- Full Chrome browser suite: 16 passed. After the final standalone leaderboard change, all five affected desktop/controller/mobile tests passed again, including Tab access during mouse capture and touch/controller Back.
- Hospital, tower and factory routes were traversed through normal browser movement with a second client observing replicated elevation. Embedded PostgreSQL transaction/reopen tests passed; no hosted database was contacted.
- Short scene-only M4 Pro / Chrome samples at 1440×900 and emulated 844×390 touch viewports averaged about 60 FPS with 16.7–16.8ms p95 frame intervals and no browser errors. These exclude combat/network load and do not establish physical-phone or 500-player performance.

## Current limits

This remains a prototype with sparse interiors and a modular art kit, not finished photorealistic COD art. Physical-phone performance, Safari, hostile public traffic, player prediction/reconciliation, lag compensation and hosted database integration remain unverified. Short local M4 Pro / Chrome measurements are not cross-device benchmarks. Dedicated long-range aimed-view blood-effect inspection is still pending; server hit range/occlusion is tested.

The latest requested follow-ups are a larger Solo map, a 500-player shared-arena target, and an Online account gate with compact username/email/password signup and email/password login. Solo and Practice will remain guest-accessible. Account authentication is not implemented in this checkpoint; password reset is deferred, and production database, auth and email configuration require separate setup.

The map and capacity expansions are also pending. They are not delivered by this checkpoint: the current map remains 156m square and admission remains the verified eight seats. Reaching 500 needs interest management, serialization/bandwidth work and staged real-client load tests.

There is no shop, progression, extra weapon catalog, bombs, squads, mandatory signup or public deployment. The server deliberately refuses `NODE_ENV=production` until public admission/resource limits, secure origins, observability and deployment readiness are reviewed. The Vercel/Railway files are inactive preparation only; no service, credentials or spending limits were created or changed.
