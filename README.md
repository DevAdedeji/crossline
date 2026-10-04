# Crossline

A locally runnable first-person browser shooter built with Nuxt 4 / Vue / Nuxt UI, Babylon.js, an authoritative Colyseus Node.js server, and an optional PostgreSQL / Drizzle persistence layer. Campaign, Solo and Practice run entirely in a device-local worker and need no match server, account, external database, API key or paid service. Online requires an account.

## Run

Use Node 24 and pnpm 11.10.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**. Enter an optional Solo/Practice nickname and select a mode to launch directly. Online opens a compact login/signup form when signed out. There is no Deploy step. The menu gesture prepares sound and mouse capture before assets load; browsers that decline capture offer a retry in the arena. Direct `/play` links still offer a Start button. Phones require landscape orientation. Stop both processes with Ctrl-C; separate commands are `pnpm dev:web` and `pnpm dev:match`.

- **Campaign — The last signal:** the first Operation Breakwater chapter. Infiltrate the Harbour Relay depot, disable its alarm terminal, rescue Finch, and escort them to the southwest extraction zone. Step into an objective circle to interact automatically; remain inside until its progress completes. Directional waypoints point to Finch and switch to extraction after rescue. Finch waits if you get more than 18m ahead; regroup to resume. Checkpoints after the relay and rescue preserve cleared guards and elapsed time on this device. Death ends the attempt and offers a checkpoint retry; guards do not respawn. Both you and Finch must remain in the extraction zone for five seconds. Completion and best mission time are local. The 168 × 168 m depot includes workshops, warehouses, container lanes and a reinforced rescue compound. Sixteen guards engage on sight and alert nearby squadmates, including seven stationed around Finch. Vehicles are parked scenery.
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
| Campaign interact | Enter objective circle | Enter objective circle | Enter objective circle |
| Crouch | C toggle / Ctrl hold | R3 toggle | CROUCH |
| Pause / menu | Esc | Start / Options or B / ○ | Pause button |
| Online leaderboard / back | Tab / Esc | View or Share / B or ○ | Leaderboard / Back |

A / × selects menus and fires in play. Release it after selecting or resuming before pressing to shoot. Controller axes have an 18% radial deadzone; Controls → Assign fire trigger supports generic layouts. Losing focus, disconnecting the active controller, or losing mouse capture releases input. Campaign/Practice/Solo pause the whole simulation; Online only pauses your controls and leaves your character vulnerable.

Touch movement, look and fire support simultaneous fingers. Pointer cancellation, backgrounding and rotation to portrait release held input. Rotation back dismisses the blocker and resizes the renderer automatically, then requires Resume. The arena observes visual-viewport/orientation/foreground changes with bounded settling checks for installed WebKit viewports; no refresh or reinstall is required. Safe-area layout, a reduced render resolution and 1024px shadows are used on touch devices. Chrome touch emulation checks 667×375 and 932×430; physical Android/iPhone and Safari behavior remain unverified.

## Combat and recovery

One CL-24 rifle is implemented: 24 rounds, unlimited reserve, 140ms shot interval, 1.6-second reload, 80m range, 25 body / 50 head damage. Online movement, stance, ray hits, cover, ammunition, health, elimination and respawn belong to the server. Practice and Solo use the same deterministic simulation locally; their scores remain device-only and are never submitted as competitive results. Clients cannot submit damage, health, score or target IDs. Crouch changes speed, camera height, pose, shot origin and hit region; blocked headroom prevents standing into a ceiling.

Solo and Online start at 100 HP, use a visible health bar and have no passive human regeneration. Eleven ground supply cases heal up to 35 HP within 1.15m on the same floor, capped at 100, then cool down for 25 seconds of simulation time. Collection checks life, participation, spawn protection and line of sight; simultaneous claims have one winner. A short chime and `+N HP` cue report the actual gain. Practice retains regeneration and no packs.

Solo bots deal 10 body / 15 head damage, react after 1400–1900ms, fire two-shot bursts at 600ms spacing and rest 1800–2400ms between bursts. A 450ms damage grace period prevents overlapping bot hits from draining health instantly. At most two bots sustain fire on one human simultaneously. Solo human protection lasts four seconds on entry/respawn. Zero HP causes a three-second respawn. This is an initial playtested balance, not a fixed survival guarantee.

Online drop/reload reconnect reserves the same session and vulnerable body for 20 seconds. Intentional departure removes the actor. Reconnect does not heal or reset the session score. Expired reservations free their seat; the ongoing room remains alive when empty until the process restarts.

## Map and presentation

Solo and Online share **Mercer Districts, 520 × 520m (270,400m²)**, compared with **52 × 52m** Practice. Eighty-one districts contain connected roads, enterable buildings, cover and 83 distributed supply pickups. Low-rise outer blocks expand the previous 300 × 300m combat map to approximately three times its area. Practice and the five-minute Solo duration remain unchanged. Solo ends with personal results; ranked standings and public leaderboards belong to Online.

Solo bots keep stable paths, turn into corners and hold an engagement position instead of repeatedly strafing or backtracking to old waypoints. Both combat modes share charcoal uniforms, two-handed rifle poses with barrel-origin shot effects, smooth camera movement over stair risers, and stair/landing surfaces rendered without duplicate overlapping tops. Collision and Online hit validation still use the authoritative geometry.

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

Server-confirmed elimination IDs update account kill/death totals atomically and idempotently. Online publishes score state and elimination events only after the transactional ledger commit succeeds; a failed commit pauses simulation and retries the same event IDs. Unconfirmed ticks and post-commit notifications are not recovered after a crash. Embedded PostgreSQL tests cover restart, rollback, duplicates and ownership. Hosted account persistence is verified; elimination-ledger behavior under production latency and failure still needs validation.

For hosting, the match service requires PostgreSQL with verified TLS, distinct auth/proxy secrets, and an exact HTTPS origin. No email-provider account, API key, sender domain or verification step is needed. Startup validates production configuration and queries the account schema before listening. The public app is live at https://crossline-three.vercel.app, backed by the Railway match server and a separate migrated Neon Free database. Production signup, login, session persistence, Practice movement and authenticated Online admission have passed live browser checks; see [hosting configuration](deploy/README.md).

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

This remains a prototype with sparse interiors and a modular art kit, not finished photorealistic COD art. Physical-phone performance, Safari, hostile public traffic, prediction under severe packet loss, lag compensation and hosted database behavior under load remain unverified. Short local M4 Pro / Chrome measurements are not cross-device benchmarks. Dedicated long-range aimed-view blood-effect inspection is still pending; server hit range/occlusion is tested.

The configured 100-player shared-arena limit is not a 100-player performance certification. Online signup/login uses the configured production database and server-only secrets. Solo and Practice remain guest-accessible; password reset is deferred.

Normal admission defaults to 100 seats, with `FFA_MAX_CLIENTS` restricted to integers 2–100. `pnpm test:capacity` starts isolated loopback-only, in-memory servers for bounded 8/16/32-client experiments; it does not connect to the live preview. It requires the match build first, creates synthetic accounts, respects auth limits, and stops on resource thresholds. See [capacity assessment](docs/capacity-assessment.md) for measurements and limitations. Validating 100 needs interest management, serialization/bandwidth work and staged real-client load tests.

There is no shop, progression, extra weapon catalog, bombs or squads. Production is deployed on Vercel and Railway with PostgreSQL on a separate Neon Free organization. Production startup fails closed unless its required secure configuration is supplied. Railway retains its existing spending cap. Hosted load testing and ongoing monitoring remain future work; the deployment example files document configuration and do not provision services automatically.

## Resource and persistence safeguards

Solo and Practice share a four-room process budget, with two connected guest rooms per verified IP. Unclaimed reservations expire through Colyseus; leaving disposes the room and releases its budget. Rooms paused/ready/finished for two minutes disconnect, and every guest room has a 30-minute lifetime. Online defaults to 100 seats in the same shared room. Join attempts are limited to 30 per IP per minute with bounded bookkeeping; authentication has its separate persisted endpoint limits. Shared household IPs share these limits.

Online elimination IDs enter the transactional PostgreSQL ledger before score state and kill events are published. A failed write freezes the shared arena and retries the same IDs every two seconds, so a database outage affects play rather than silently discarding confirmed scores. A crash can still lose an unconfirmed in-memory tick or its notification; this is not durable whole-match recovery. Database round-trip latency and hosted reconnect behavior still require deployment-environment testing. Earlier capacity measurements predate this commit-before-confirmation behavior.

`pnpm db:migrate` now uses the same verified TLS/CA and pool configuration as runtime. It is an explicit operation and is never run against a hosted database by ordinary startup or the test suite.

## Signup and capacity update (2026-10-02)

Signup now creates a session and enters Online immediately, with no email verification/provider dependency. New emails retain an unverified ownership flag. Normal shared-room admission defaults to 100, and the menu reads the server's configured capacity. The room still rejects overflow instead of creating another public arena.

Validation: 75 unit/integration tests, lint, workspace typechecks, both builds, Training/Online/auth network smoke checks, and eight affected Chrome browser scenarios passed. The auth smoke check confirms a real room uses the 100-seat default; overflow/browser fixtures explicitly use eight seats. The live local menu and `/arena` endpoint also report 100. These local checks do not certify 100-client performance. See the live deployment checkpoint below.

## Live deployment checkpoint (2026-10-02)

- Web: https://crossline-three.vercel.app (Vercel Hobby). Match health: https://crosslinematch-production.up.railway.app/health (Railway, one replica).
- Neon PostgreSQL is isolated in the Crossline Free organization; existing paid projects and Creda were not changed. Migrations and remote TLS verification succeeded.
- A clean Chrome browser passed live Practice rendering/movement over WSS, immediate signup into Online, email/password login, session persistence after reload, Secure/HttpOnly cookies and logout, with no page exceptions. Synthetic test accounts remain under reserved `example.test` addresses; no email was sent.
- Both public health and the same-origin arena gateway returned HTTP 200. Direct unsigned auth and untrusted-origin gateway requests returned HTTP 403. Arena status reports the configured 100-seat cap; this is not a 100-player load result.
- Railway's initial Docker registry manifest HTTP 502 cleared on one retry. The runtime listened successfully on its assigned port. Live checks used application commit `f4c9f94`.

## Responsiveness and phone clarity

Local movement prediction uses the authoritative collision/stance step and replays bounded unacknowledged inputs after server snapshots. Small corrections settle smoothly; death/respawn clears prediction. Health, ammo, hits and scores remain authoritative. Muzzle flash and firing audio respond locally with bounded cadence/ammo feedback; hit effects remain confirmed. The barrel effect uses two short directional sheets and a three-wisp smoke pool, attached to the imported barrel tip.

Phone rendering now uses up to 1.5 render pixels per CSS pixel instead of inversely reducing resolution on high-density displays; Mac scaling is unchanged. A DPR-3 844×390 viewport changed from 351×162 to 1266×585. On the available Mac, the original live scene ran near 60 FPS but movement waited 296–352 ms for authority. A browser test with 300 ms delayed input measured local movement/muzzle response at 13.5 ms and authority at 379 ms. Emulation is not physical-phone performance certification; server latency and authoritative hit confirmation still depend on network distance.

Live release verification: both providers deployed `9f4abb5`. Clean Chrome measured 18.6 ms local movement/firing response versus 299.5 ms authority, with zero settled position error. Desktop and emulated DPR-3 phone views stayed near 60 FPS; the phone buffer was 1266×585. A first cold shot showed a one-off stall, so muzzle/smoke shaders are now explicitly compiled during scene loading. The focused delayed-input and phone checks passed again after that warmup change.

## Street detail and rendering

The street-detail revision uses textured cutout-leaf trees, assembled wooden benches, shared car-paint variants, and imported window/cornice modules on the outer city buildings. Bench bounds are authoritative; the west rooftop route stays clear. Asset provenance is in `apps/web/public/models/ATTRIBUTION.md`.

Façades use spatially grouped thin instances rather than cloning complete kits per window. Opaque façade maps are compressed; particles and tracers use bounded reusable pools and their shaders warm before play. The gameplay HUD has text shadows instead of full-width dark gradients; pause uses a light tint without backdrop blur. Incoming damage remains a brief red edge cue.

A map-only Chrome profile on an Apple M4 Pro reduced active meshes from 745/2119/2008 to 406/783/850 across street/interior/roof views. Both desktop and phone emulation stayed near 60 FPS with p95 frame intervals about 16.7–16.8 ms. This excludes animated players, production network latency, and physical-phone hardware. Run `CROSSLINE_PREVIEW_URL=http://127.0.0.1:3000 node scripts/render-profile.mjs` against a Nuxt development server to repeat the scene-only check.

## Install Crossline

Open https://crossline-three.vercel.app and choose **Install app**, or use your browser's install menu. On iPhone/iPad, open the site in Safari and choose **Share → Add to Home Screen**. The installed app uses a standalone window, its own icon and the existing landscape controls/safe-area layout. Desktop and mobile browser support varies; an OS-level installation on a physical phone has not been verified.

**Download offline play** on the menu saves a versioned game pack with visible size/progress. When **Offline play ready** appears, Practice and Solo can reload, move, aim, shoot and simulate bots with networking disabled. Online always requires internet and an account. An interrupted download is not marked ready; retry reuses verified files. **Remove offline files** frees the pack when no match/download is open. Browsers may evict local storage; check readiness before leaving connectivity.

The automatic precache remains small. The opt-in pack contains a build-time anonymous SPA shell, matching JS/CSS, the local simulation worker, models, textures, audio and menu art. SHA-256 and byte-size checks reject mixed releases. Limits are 64 MiB total, 8 MiB per file and 96 files; incomplete downloads cannot launch offline. A completed pack pins shell/code/art together. Activating a new release removes the old pack and requires an explicit new download. Auth/account/leaderboard/matchmaking APIs, session HTML and game state are never cached. The separate ordinary code cache remains bounded at 32 files / 3 MiB each / seven days; normal HTTP caching is separate.

Updates wait in the background. **Update app** appears on the menu; activation is refused while any same-origin Crossline tab is on `/play`, including pause/reconnect. After all matches are left, the requested update reloads the menu. An active match is never automatically reloaded. Closing all app tabs also lets the normal service-worker lifecycle activate a waiting release.

PWA/offline browser checks cover manifest/icons, app-specific install eligibility, cache bounds, interrupted downloads, real network-disabled reload/gameplay on desktop and phone emulation, API exclusion and cross-tab update blocking. Run `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test tests/browser/pwa.spec.ts`. The worker is disabled during `pnpm dev`; use a production build for PWA checks.


## Weak connections and Solo pacing

Practice and Solo never open a WebSocket. A worker runs their fixed-step simulation independently of rendering. Online predicts movement and muzzle feedback immediately, with server-confirmed hits, ammo, health and scores. Acknowledgment delay above 250ms or silence above 350ms shows a warning. After one second without acknowledgment (or an 8 KiB socket backlog), controls pause visibly; held inputs clear, prediction resets, and recovery requires Resume. Input history stays bounded. The server ignores new-client input based on a server timestamp more than 1.2 seconds old. Shared multiplayer cannot continue offline.

Solo incoming bot damage is now 5 body / 7 head (previously 10 / 15). Initial reaction is 2.0–2.7 seconds, two-shot bursts are spaced 1.25 seconds apart, and the rest between bursts is 2.8–3.6 seconds. A 1.2-second incoming-hit recovery window is shared across every attacking bot, so staggered crossfire cannot drain health at the old rate. Player weapon damage and Online damage remain 25 body / 50 head; health supplies, spawn protection and bot count are unchanged.

Reproduce with `pnpm exec tsx scripts/solo-balance.ts`. Twelve deterministic seeds per scenario place a stationary unprotected player in the open, with nearby bots and no shooting or health supplies. Median time to defeat:

| Nearby bots | Previous balance | Gentler balance |
| --- | ---: | ---: |
| 1 | 13.1 s | 53.9 s |
| 2 | 13.2 s | 44.0 s |
| 4 | 8.7 s | 43.4 s |
| 8 | 8.3 s | 32.3 s |

At ten seconds, median remaining health with eight bots increased from 0 to 75. Three one-bot runs and one two-bot run survived the 90-second measurement window; medians include those censored survivors, rather than dropping them. All four/eight-bot runs still ended in defeat under sustained exposure. Bots can move, lose sight or obstruct each other's shots, so counts are not a linear damage multiplier. These controlled scenarios are regression measurements, not a promise for every encounter. No Online balance values changed.


## Furnished interiors and viewport recovery

The café, garage and supply store now have detailed counters, equipment, drawers and labelled stock. Existing office desks/cabinets, hospital furniture and factory controls receive small procedural details. Other district rooms intentionally stay empty. Furniture keeps its authoritative collision footprints and the stair/loading routes; these original procedural meshes and tiny generated textures add no external art downloads. Geometry is batched by material and spatial cell.

Five map-only desktop and phone-emulated Chrome views on an Apple M4 Pro remained near 60 FPS after the detail pass, with no browser exceptions. Active meshes increased (desktop café: 353 to 446; phone café: 431 to 543), so physical-phone performance still needs checking. These short stationary samples exclude players and networking.

Touch layout follows the visual viewport through rotation and foreground resume, including delayed mobile browser size updates. Portrait pauses play and clears held inputs; returning to landscape restores the canvas and controls without reloading, then requires Resume. The regression repeats three rotations with deliberately stale window dimensions and checks the same page/game survives. Physical iPhone standalone behavior remains unverified.

Hosted offline verification on release `3a00043`: clean desktop and DPR-3 phone-emulated Chrome profiles downloaded the production pack, disabled networking and the ordinary HTTP cache, reloaded both local modes, moved/fired, then reconnected successfully. No game sockets or page exceptions occurred. Offline startup was 1.0–1.8 seconds in these short samples. The automation browser needed a temporary resolver mapping to the hosting IP after DNS/navigation stalls; no device or application DNS settings were changed.
