# Crossline

A browser shooter with a complete local Training mode: Nuxt 4 / Vue / Nuxt UI / Tailwind CSS 4, a client-only Babylon.js arena, a separate authoritative Colyseus Node.js match process, and a PostgreSQL / Drizzle schema.

## Run locally

Use Node 24 LTS and pnpm 11.10.0 (`corepack enable` if needed).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**, choose **Training**, then **Start training**. Each session is personal: one player, three stationary targets and two slow patrol bots, with a three-minute clock. No account, database, environment file, API key or paid service is needed. WebGL and a desktop browser are required.

**WASD** moves, **mouse** looks through 360 degrees, **left click** fires, **right click** aims, **R** reloads and **Esc** pauses the entire session. The crosshair turns red over a living, unprotected target within range and clear of cover; a separate white hit marker and orange elimination flash confirm server hits. Targets hold assigned idle headings and patrols face their movement, without tracking the player. The CL-24 has 24 rounds and unlimited reserve ammunition. Targets respawn after three seconds with brief protection. Training targets never shoot; combat AI is reserved for a later mode. The session ends with score, kills/deaths, accuracy and head hits; replay or return to the menu. The pause menu also allows an early finish or fresh restart. Sound can be muted in the menu.

The match process listens at `127.0.0.1:2567`; `/health` reports its status. The web origin is intentionally `127.0.0.1`, not `localhost`. Stop both with Ctrl-C. To run them separately: `pnpm dev:match` and `pnpm dev:web`.

The root screen is a game mode selector: **Solo vs Bots** and **Online Free-for-All** are marked in development; **Training** enters the playable prototype. Use arrow keys, the D-pad or left stick to move focus, then Enter or A / × to select. Future modes show their status and do not start a fake match.

## Controller controls

Connect a USB or Bluetooth controller, focus the browser and press a button for detection. Standard mappings support **left stick** move, **right stick** look, **RT / R2** fire, **LT / L2** aim, **X / □** reload, **A / ×** select and **Start / Options or B / ○** pause. Use the D-pad or left stick for menu selection. Both sticks have an 18% radial deadzone. Losing focus, controller disconnection or lost pointer lock pauses the whole simulation; keyboard/mouse remains available. Unsupported mappings are explicitly labeled.

Controller browser behavior is verified with a simulated standard controller. Physical controller compatibility still depends on the browser/device and has not been tested on hardware.

## Implemented Training mode

- Licensed human soldier, carbine and sedan GLB models, skeletal movement/idle/death animation, aimed/hip fire, recoil, muzzle flash, shot tracers, hit and elimination feedback, small blood particles only on confirmed damaging bot hits, separate world impact dust, visible hit flinches, persistent death animations before respawn, damage vignette and CC0 recorded rifle shots and reload handling with limiting, stereo direction and distance attenuation.
- Server-authoritative ray hits against actors and world cover, head/body damage, fire cadence, ammo, reload, health, regeneration, elimination, protected respawn and scoring. Clients cannot submit damage or target IDs.
- Three stationary human targets hold their current spawn position and do not attack. Two unarmed patrols follow predictable routes around map collision. Hits stop their movement for a flinch, then they resume their route. No target attacks the player or other targets. All targets respawn indefinitely within the session.
- Personal private rooms, 30 Hz simulation, ready/play/pause/finish/replay lifecycle and a three-minute practice clock. Every new tab creates its own practice room.
- Radar, health/ammo/time/score HUD, kill feed, respawn countdown, results and controller-operable menus.
- **Mercer Block:** three enterable buildings, crossing streets and alleys, parked-car cover, loading crates, street furniture and a cafe rooftop reached by the west ramp.
- Shared geometry drives client rendering, authoritative collision, gravity and shot occlusion. Input validation, bounded movement, per-client message cap, 250 ms stale-input stop and 1.2-second missing-input pause.
- PostgreSQL/Drizzle schema foundation for future profiles, matches and participants. Training results currently last only for the session.

Horizontal look is local and unrestricted through repeated full rotations; pitch is bounded to about 83 degrees. Network position/elevation patches preserve your view. Mouse capture rejection offers a retry. Leaving disposes the scene, audio, room, input listeners and timers.

## Mercer Block map

Spawn at the south end of Mercer Street. Follow the road north to the intersection, enter the signed building doorways, or take the west alley to the marked **ROOF ACCESS** ramp behind the cafe. The ramp ends on a landing with a clear route onto the cafe roof. Ground-level movement cannot pass through parked cars, solid walls, windows, counters or crates; windows are decorative glazed panels. Falling is supported, but jumping, player-to-player collision and fall damage are not implemented. Parked cars are static cover, not drivable vehicles.

Buildings use selected CC0 Poly Haven apartment/factory modules with local 1K maps. Human SWAT characters, rifles and sedans are free Quaternius assets. Sources, licenses and adaptations are recorded in `apps/web/public/models/ATTRIBUTION.md` and the in-game Credits page. Layout, signs and collision remain original game code. No paid assets or new services are used. Static geometry is batched or instanced; the shadow map is capped at 2048px and render resolution is capped relative to pixel density. Characters and cars are stylized low-polygon assets alongside textured architectural surfaces, not photorealistic Call of Duty fidelity. Browser behavior has been checked locally, not benchmarked across devices. Colliders are conservative shapes rather than a general rigid-body physics simulation.

## Boundaries and next work

The Training gameplay loop is implemented; its art remains a prototype. The separate **Solo vs Bots** and **Online Free-for-All** modes remain unavailable roadmap modes. Online play is planned as a shared arena with unlimited respawns. Training already supports unlimited respawns during the session. One basic rifle is implemented; more weapons and selection are future work. Grenades and monetization remain ideas, with no payments or paid features implemented. Authentication, progression, persisted results, jumping, sprinting, weapon selection, matchmaking, player prediction/reconciliation, network lag compensation and production hosting are future work. Patrol targets use a compact waypoint graph; this is an original practice mode, not a production competitive shooter.

Authentication is intentionally deferred; Creda/Calendza use Better Auth, which is the preferred pattern to evaluate for future accounts. No auth code, secrets, or business logic was copied. The local match process defaults to loopback and refuses `NODE_ENV=production` until access controls, join/message rate limits, room resource budgets, secure origins/TLS, reconnect policy and observability are designed. An origin check is not authentication. Do not expose this prototype to the internet.

## Structure

```text
apps/web          Nuxt UI and client-only Babylon rendering
apps/match        Long-running authoritative Colyseus server
packages/shared   Movement/combat protocol, urban geometry, collision and ray hits
packages/db       Drizzle schema and SQL migration; not loaded by the demo
scripts/smoke.ts  Isolated real-server personal-session integration check
```

The simulation stays out of Nuxt request handlers. Persistence stores durable identity/results, not per-frame positions. Bot agents and human input share the same authoritative movement and combat rules; future modes should own explicit rules and lifecycle. Weapon catalog and loadout selection should share server-owned weapon definitions when expanded.

## Verification

```sh
pnpm verify           # lint, all package typechecks, unit tests, builds, network smoke
pnpm exec playwright install chromium  # one-time browser download, if unavailable
pnpm test:browser     # production web build + built match server; test ports 3001/2569 must be free
```

To reuse an installed Google Chrome instead of downloading Chromium: `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser`.

`pnpm test:smoke` launches the built match process on port 2568 and stops it afterward. It verifies private room isolation, six actors, movement/input validation, stale input stopping and auto-pause, shots/ammo/reload, pause/resume, natural timer completion, replay and early finish. Only test processes can set `TRAINING_TEST_DURATION_MS` to shorten timer tests; clients cannot change session duration.

Unit tests exercise ray occlusion (including ramp/doors), head damage, cadence, ammo/reload, protection, death/respawn, non-attacking target behavior and hit recovery, lifecycle, navigation and movement/map/camera regressions. Browser tests use the real production client and match server, actual pointer lock and synthesized standard Gamepad API inputs. Build before running either smoke command separately.

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

## Training verification (2026-10-01)

Verification uses Node 24.14.1, pnpm 11.10.0 and installed Google Chrome. Verification passed lint, all TypeScript checks, 25 unit tests, both application builds, the real WebSocket smoke test, and all five production-browser acceptance tests. The live preview was separately exercised through movement, red target feedback, elimination, a changed respawn position, pause/resume, results, replay and exit with no browser errors. Six rendered hit/death/respawn cycles were also checked for intact skeleton poses. Screenshots from browser acceptance runs are saved in ignored `test-results/`. The Babylon client chunk has a bundle-size advisory and loads only for the play route. Live database migration testing is outside this local Training mode. No services are deployed.

API references: [Nuxt installation](https://nuxt.com/docs/4.x/getting-started/installation), [Colyseus server/router](https://docs.colyseus.io/server), [Colyseus state schema](https://docs.colyseus.io/state/schema).

Asset sources and adaptations are documented in [asset provenance](apps/web/public/models/ATTRIBUTION.md) and the in-game Credits page. Buildings use selected CC0 Poly Haven facade modules and 1K surface maps. Characters and vehicles remain stylized; Blender is not required to run or edit this version.

Respawns select separated, collision-free locations while avoiding recent positions. The renderer resets animation, pose, recoil and hit state on each new life. Three practice targets remain stationary between respawns; two unarmed patrols walk slowly, stop to react to hits, then continue their routes.

## Current visual and audio limits

First-person hands are intentionally omitted at the user's request. The gun is framed closer/lower so its grip and trigger stay outside view; aiming and reload motion preserve that framing. Reload sound and weapon/magazine motion use authoritative reload progress, including pause/resume. Small blood particles appear only at confirmed damaging bot contacts; wall impacts use dust. Shot/reload recordings and adaptations are documented in [audio provenance](apps/web/public/audio/ATTRIBUTION.md).

The environment combines textured Poly Haven facade modules with simple collision/interior geometry. The Quaternius human, rifle and sedan meshes remain visibly stylized and do not meet a photorealistic art target. Blender has not been installed: the current mesh selection, rig fixes and magazine separation were completed directly in the GLB/Babylon pipeline. Replacing those low-poly assets with a coherent realistic set remains art work, not a completed feature.

Browser inspection uses installed Google Chrome through Playwright; no in-app-browser tool was available. A 12-second 1440×900 local hardware-rendered movement/patrol sample on Apple M4 Pro measured 60.07 fps average, 17.7ms p95 frame interval and no intervals over 50ms. The software SwiftShader test renderer measured 6.24 fps and is used for functional acceptance, not as a claim of smooth performance. These short local samples are not a device benchmark. AK-47 shot and mechanism recordings replace synthesized gun/reload audio. Live-browser sample URLs and SHA-256 hashes were matched to the shipped WAVs; four automatic shots peaked at 0.463 without clipping, and reload resumed at its paused offset with no voices playing while paused. Recorded audio is verified by decoded waveforms and browser output meters; subjective speaker/headphone listening quality has not been independently auditioned.
