# Crossline

A locally runnable first-person browser shooter built with Nuxt 4 / Vue / Nuxt UI, Babylon.js, an authoritative Colyseus Node.js server, and an optional PostgreSQL / Drizzle persistence layer. Solo and Practice need no account, external database, API key or paid service. Online requires an account.

## Run

Use Node 24 and pnpm 11.10.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**. Enter an optional Solo/Practice nickname and select a mode to launch directly. Online opens a compact login/signup form when signed out. There is no Deploy step. The menu gesture prepares sound and mouse capture before assets load; browsers that decline capture offer a retry in the arena. Direct `/play` links still offer a Start button. Phones require landscape orientation. Stop both processes with Ctrl-C; separate commands are `pnpm dev:web` and `pnpm dev:match`.

- **Solo vs Bots:** five minutes against twelve bots, quick respawns, health packs, results with kills/deaths/accuracy and a personal-best score stored on this device. Play Again starts immediately. Bots target humans only; they never damage other bots. Patrols stay near the active player's district, but aiming/firing still requires real sight and cover checks.
- **Online Free-for-All:** one continuous account-based, human-only arena, join/leave anytime, unlimited respawns, health packs and general top-kills/top-deaths leaderboards in a standalone button/view (also accessible from the main screen). The single process admits up to 100 clients, including reserved reconnect seats. A full arena offers a waiting/retry message; it never intentionally creates a second public arena. The configured cap is 100; simultaneous 100-player performance is not yet measured. Smaller test fixtures verify full-room rejection and singleton behavior.
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

Solo and Online share **Mercer Districts, 300 × 300m (90,000m²)**, compared with **52 × 52m** Practice. Twenty-five districts contain 45 enterable buildings, 46 cars, connected roads, cover and 27 distributed supply pickups. This is 3.70 times the previous combat area; Practice and the five-minute Solo duration remain unchanged.

- **Outer city:** 16 new districts, 32 halls/supply buildings, interior switchback stairs and accessible roofs. Civic Heights reaches six floors / 19.2m; Archive Quarter reaches four.
- **North Ironworks:** 34 × 26m factory, 8m hall, loading bays, machinery, crane, mezzanine, roof stairs/opening and 16m chimney.
- **Foundry Operations:** four accessible storeys and a 12.8m roof, connected by switchback stairs. Landing geometry supports slow analog movement as well as full-speed walking.
- **Mercer General Hospital:** 30 × 26m, three storeys, connected central corridors/wards, beds/lockers, emergency canopy, external stairs and a 9.6m accessible roof.

Collision, navigation and shot occlusion share authored geometry. Navigation uses spatially indexed neighbors, cached collision-checked edges and heap-based A*. Static rendering batches by material and 32m spatial cell; character presentation pauses beyond 95m. Crossing asphalt is split to avoid near-coplanar overlap. The reference images were inspected privately for street scale, atmosphere and restrained UI; no reference images or copied story/UI text are shipped.

Online names are small billboards, limited to 32m and hidden behind authoritative cover or for dead/nonparticipating actors. The radar and server-confirmed combat feedback remain separate. Assets are local: see [model provenance](apps/web/public/models/ATTRIBUTION.md) and [audio provenance](apps/web/public/audio/ATTRIBUTION.md). First-person hands are intentionally omitted. Recorded shot/reload sounds follow authoritative timing and mute/pause state.

## Accounts and statistics

Signup asks for username, email and password; login asks for email and password. A successful login continues directly into Online. Sessions survive a page refresh, and the main menu provides logout. Password reset is intentionally deferred. Controller D-pad moves between fields/buttons, A / × activates buttons, and B / ○ closes the form; typing uses the device keyboard. Landscape forms scroll within the screen.

Better Auth 1.7.7 uses its own password hashing and session handling with the Drizzle PostgreSQL adapter. Usernames are required, normalized to lowercase, immutable and unique (3–16 letters/numbers/underscores). Signup asks for username, email and password, immediately signs the player in, and enters Online. Login uses email/password. No verification email or email provider is required. New emails remain `emailVerified=false`: signing in proves control of the game account, not ownership of the mailbox. Password reset and account linking remain disabled. Public names and leaderboards use only username/account ID/kill/death fields, never email, password hashes or session tokens. Existing anonymous guest tables are retained as historical data and are not silently merged into accounts.

`pnpm dev` enables a local account database. Signup works immediately with a valid email address; no email is sent. Local account/session/stat data persists under ignored `.crossline-local/accounts` in the project root. Tests use synthetic addresses and disposable embedded PostgreSQL databases. Local auth refuses production mode or a non-loopback host/origin.

The browser retains an HttpOnly, SameSite=Lax session cookie. Secure cookies are required for nonlocal configuration. A short-lived, single-use Better Auth token authorizes a Colyseus join; it is not kept in localStorage. The server rejects client-chosen identities and duplicate active account seats. Reconnect must confirm the same account **and session** with a fresh token before input is accepted. Session expiry stops input, and database session checks revoke logged-out/invalid sessions within approximately two seconds. Failure to reauthorize a reconnect closes it after five seconds. Database errors fail closed.

Authentication endpoints have persisted rate limits and bounded request bodies, trusted-origin checks and generic errors. Production auth and matchmaking pass through the same-origin Nuxt gateway with HMAC-signed client IP, request body, cookies, path, timestamp and single-use nonce. Only the Vercel platform IP header is trusted there; the match service rejects unsigned requests and removes arbitrary forwarding headers. Local loopback fixtures intentionally share a local bucket. Password reset, account editing/linking and token-verification HTTP endpoints are not publicly routed. The match process consumes join tokens internally.

Server-confirmed elimination IDs update account kill/death totals atomically and idempotently. Online publishes score state and elimination events only after the transactional ledger commit succeeds; a failed commit pauses simulation and retries the same event IDs. Unconfirmed ticks and post-commit notifications are not recovered after a crash. Embedded PostgreSQL tests cover restart, rollback, duplicates and ownership. Hosted PostgreSQL remains untested.

For future approved hosting, the match service requires PostgreSQL, verified provider CA, distinct auth/proxy secrets, and an exact HTTPS origin. No email-provider account, API key, sender domain or verification step is needed. Startup validates production configuration and queries the account schema before listening. No real provider, credentials, migration or deployment has been created. See [hosting preparation](deploy/README.md) for the inactive configuration checklist.

The match process accepts exported variables or its ignored `apps/match/.env`; exported variables take precedence. Migration tooling alone reads `packages/db/.env`. Never put real credentials in Git. For an explicitly approved database:

```sh
pnpm db:generate  # offline generation after schema changes
pnpm db:migrate   # explicitly applies migrations to the configured database
```

See [.env.example](.env.example) and [hosting preparation](deploy/README.md). The local development database automatically applies the checked-in migrations; hosted databases never do.

## Structure and verification

```text
apps/web           Nuxt UI, client-only Babylon scene, same-origin auth/leaderboard gateway
apps/match         Long-running Colyseus server, Better Auth and account statistics
packages/shared    Movement/combat protocol, geometry, collision, name visibility
packages/db        Drizzle schema, SQL migrations and bounded optional server repository
scripts/           Real-server WebSocket smoke checks and offline asset conversion
```

```sh
pnpm verify
PLAYWRIGHT_CHANNEL=chrome pnpm test:browser
```

`verify` runs lint, all TypeScript checks, units, both builds and all three genuine-client network checks. The auth smoke test checks the real default 100-seat room; overflow/reconnect fixtures deliberately use eight seats to stay small. Browser tests use the production build on ports 3001/2569 and the installed Chrome renderer. `pnpm exec playwright install chromium` is an alternative one-time browser install. Tests explicitly disable external database configuration. The network checks use isolated ports 2568/2570/2571 and terminate their own children.

Coverage includes five-minute deterministic Solo simulations, human-only bot targeting, collision/stair routes, crouch clearance, pickup contention/protection, authenticated account identity, session revocation, transactional persistence/restart/deduplication, remote combat, reconnect reservations, singleton capacity, touch cancellation/orientation, mouse/controller fire/reload and real browser landmark walks with a second client's replicated elevation. Screenshots are saved under ignored `test-results/`.

## Checkpoint verification (2026-10-02)

- Verification passed lint, all TypeScript checks, 64 unit tests, web/match builds and three real-server network smoke checks. The final server-only respawn optimization was rechecked with all units and all three network checks.
- Full Chrome browser suite: 20 passed, including six-floor Civic Heights, the corrected hospital stair/door approach, factory/tower routes, accounts, two-client reconnect, mobile controls, health supplies and crouch. Final affected Online and survival checks also passed (three tests) after the respawn optimization.
- Civic Heights, hospital, tower and factory routes were traversed through normal browser movement with a second authenticated client observing replicated elevation. Embedded PostgreSQL tests cover immediate signup, unverified email ownership, hashing, normalization, unique usernames, CSRF, rate limits, expiry, concurrent ticket redemption, cookie flags, first-run creation and transaction/reopen behavior. No hosted database or real email service was contacted.
- Short scene-only M4 Pro / Chrome samples at 1440×900 and emulated 844×390 touch viewports averaged about 60 FPS with 16.7–16.8ms p95 frame intervals and no browser errors. All six stationary screenshot pairs matched. These scene samples exclude combat/network load and do not establish physical-phone or 100-player performance.

- Bounded single-arena load windows completed at 8, 16 and 32 authenticated clients after caching spawn-safety scores. At 32 during movement/fire, the worst one-second simulation p95 was 14.72ms, maximum tick 15.22ms and aggregate outbound payload about 1,300 KiB/s. Configured admission is now 100, separately from these historical measurements; [full measurements and limitations](docs/capacity-assessment.md).

Implementation references: [Better Auth Nuxt integration](https://better-auth.com/docs/integrations/nuxt), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [one-time session tokens](https://better-auth.com/docs/plugins/one-time-token).

## Current limits

This remains a prototype with sparse interiors and a modular art kit, not finished photorealistic COD art. Physical-phone performance, Safari, hostile public traffic, player prediction/reconciliation, lag compensation and hosted database integration remain unverified. Short local M4 Pro / Chrome measurements are not cross-device benchmarks. Dedicated long-range aimed-view blood-effect inspection is still pending; server hit range/occlusion is tested.

The configured 100-player shared-arena limit is not a 100-player performance certification. Online signup/login is implemented and requires separate approved production database and secret configuration. Solo and Practice remain guest-accessible; password reset is deferred.

Normal admission defaults to 100 seats, with `FFA_MAX_CLIENTS` restricted to integers 2–100. `pnpm test:capacity` starts isolated loopback-only, in-memory servers for bounded 8/16/32-client experiments; it does not connect to the live preview. It requires the match build first, creates synthetic accounts, respects auth limits, and stops on resource thresholds. See [capacity assessment](docs/capacity-assessment.md) for measurements and limitations. Validating 100 needs interest management, serialization/bandwidth work and staged real-client load tests.

There is no shop, progression, extra weapon catalog, bombs, squads or public deployment. Production startup fails closed unless its required secure configuration is supplied. Hosted integration, monitoring and provider limits still need review before an authorized launch. The Vercel/Railway files are inactive preparation only; no service, credentials or spending limits were created or changed.

## Resource and persistence safeguards

Solo and Practice share a four-room process budget, with two connected guest rooms per verified IP. Unclaimed reservations expire through Colyseus; leaving disposes the room and releases its budget. Rooms paused/ready/finished for two minutes disconnect, and every guest room has a 30-minute lifetime. Online defaults to 100 seats in the same shared room. Join attempts are limited to 30 per IP per minute with bounded bookkeeping; authentication has its separate persisted endpoint limits. Shared household IPs share these limits.

Online elimination IDs enter the transactional PostgreSQL ledger before score state and kill events are published. A failed write freezes the shared arena and retries the same IDs every two seconds, so a database outage affects play rather than silently discarding confirmed scores. A crash can still lose an unconfirmed in-memory tick or its notification; this is not durable whole-match recovery. Database round-trip latency and hosted reconnect behavior still require deployment-environment testing. Earlier capacity measurements predate this commit-before-confirmation behavior.

`pnpm db:migrate` now uses the same verified TLS/CA and pool configuration as runtime. It is an explicit operation and is never run against a hosted database by ordinary startup or the test suite.

## Signup and capacity update (2026-10-02)

Signup now creates a session and enters Online immediately, with no email verification/provider dependency. New emails retain an unverified ownership flag. Normal shared-room admission defaults to 100, and the menu reads the server's configured capacity. The room still rejects overflow instead of creating another public arena.

Validation: 75 unit/integration tests, lint, workspace typechecks, both builds, Training/Online/auth network smoke checks, and eight affected Chrome browser scenarios passed. The auth smoke check confirms a real room uses the 100-seat default; overflow/browser fixtures explicitly use eight seats. The live local menu and `/arena` endpoint also report 100. No 100-client performance or hosted deployment claim is made.
