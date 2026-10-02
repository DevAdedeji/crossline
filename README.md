# Crossline

A browser shooter with locally runnable Training, Solo vs Bots and human-only Online Free-for-All modes: Nuxt 4 / Vue / Nuxt UI / Tailwind CSS 4, a client-only Babylon.js arena, a separate authoritative Colyseus Node.js match process, and a PostgreSQL / Drizzle schema.

## Run locally

Use Node 24 LTS and pnpm 11.10.0 (`corepack enable` if needed).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000**, choose **Training**, then **Start training**. Each session is personal: one player, three stationary targets and two slow patrol bots, with a three-minute clock. No account, database, environment file, API key or paid service is needed. WebGL and a desktop browser are required.

**WASD** moves, **mouse** looks through 360 degrees, **left click** fires, **right click** aims, **R** reloads and **Esc** pauses the entire session. The crosshair turns red over a living, unprotected target within range and clear of cover; a separate white hit marker and orange elimination flash confirm server hits. Targets hold assigned idle headings and patrols face their movement, without tracking the player. The CL-24 has 24 rounds and unlimited reserve ammunition. Targets respawn after three seconds with brief protection. Training targets never shoot; combat AI runs only in Solo vs Bots. The session ends with score, kills/deaths, accuracy and head hits; replay or return to the menu. The pause menu also allows an early finish or fresh restart. Sound can be muted in the menu.

The match process listens at `127.0.0.1:2567`; `/health` reports its status. The web origin is intentionally `127.0.0.1`, not `localhost`. Stop both with Ctrl-C. To run them separately: `pnpm dev:match` and `pnpm dev:web`.

The root screen is a game mode selector: **Solo vs Bots** starts a separate personal combat match; **Training** enters calm target practice. **Online Free-for-All** joins a shared local human-only room. Use arrow keys, the D-pad or left stick to move focus, then Enter or A / × to select.

## Controller controls

Connect a USB or Bluetooth controller, focus the browser and press a button for detection. Standard mappings support **left stick** move, **right stick** look, **A / × or RT / R2** fire, **LT / L2** aim, **X / □** reload, **right-stick click (R3)** toggle crouch, **A / ×** select and **Start / Options or B / ○** pause. Use the D-pad or left stick for menu selection. Both sticks have an 18% radial deadzone. Losing focus, controller disconnection or lost pointer lock pauses Training/Solo and opens a local menu in Online; keyboard/mouse remains available. Generic mappings are accepted. Use Controls → Assign fire trigger to bind an unusual button or analog axis; that choice is stored locally per controller. The same bottom face button selects menus and fires during play. Release it after Start/Resume before pressing to shoot; holding it then repeats at the weapon cadence. A stationary mouse cannot override controller menu selection.

Controller browser behavior is verified with simulated standard and generic mappings, analog triggers without a pressed flag, mouse-to-controller takeover, reconnect, and select/fire release gating. Physical controller compatibility still depends on the browser/device and has not been tested on hardware.

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

Buildings use selected CC0 Poly Haven apartment/factory modules with local 1K maps. The human character is Microsoft Rocketbox (MIT), the detailed AK rifle is by Lamoot (CC0), and the textured parked car is by rohezal (CC0). Quaternius CC0 combat animations are retargeted to the character. Sources, licenses and adaptations are recorded in `apps/web/public/models/ATTRIBUTION.md` and the in-game Credits page. Layout, signs and collision remain original game code. No paid assets or new services are used. Static geometry is batched or instanced; the shadow map is capped at 2048px and render resolution is capped relative to pixel density. Character clothing/skin and cars now use texture maps; the rifle uses detailed geometry with steel/walnut PBR materials. This is a focused free-asset art pass, not photorealistic Call of Duty fidelity. Browser behavior has been checked locally, not benchmarked across devices. Colliders are conservative shapes rather than a general rigid-body physics simulation.

## Solo vs Bots

Choose Solo vs Bots, then Start match. One human fights twelve armed bots for three minutes, with unlimited respawns, health packs, ammunition/reload, score and final standings. Bots acquire and pursue living, unprotected human players only. They never target or damage other bots; friendly bodies block shots without taking damage. Dead/protected targets and stale pursuit memories are discarded, and bots reacquire the player after respawn protection with a fresh reaction delay. The server owns every hit, death, score and respawn. Bots use line of sight, a field of view, reaction delay, imperfect burst aim, a short last-seen memory, nearby human gunfire cues, navigation around shared collision and nearby cover when hurt or reloading. They cannot shoot through walls or fire during spawn protection. Respawns prefer separation and occlusion from opponents. Pause freezes the entire match; restart/replay clears the session. Training uses a separate room rule and still never permits bot fire.

## Solo health and recovery

Solo starts at **100 HP** and shows a numeric value plus a health bar, turning orange/red at 30 HP. Human HP does not regenerate passively in Solo. Eleven green supply cases sit on the ground near cover across the nine districts. Walk within 1.15 metres on the same floor to receive **up to 35 HP**, capped at 100. No use button is required. Full-health players leave the case for later. A successful pickup removes the case for **25 seconds of match time**; its label and radar marker show availability. A short UI chime and `+N HP` message report the actual server-approved gain, respecting mute and browser audio unlock. Death does not reset pack cooldowns; restarting the personal match does.

The server checks life, damage, distance, elevation and wall occlusion, and consumes each case atomically. Clients cannot request a heal or choose a gain. Dead players, bots and players above/below a case cannot collect it. Training and Online keep their existing regeneration and have no health packs.

Solo bot shots deal **16 body / 24 head damage**, while the player's rifle retains **25 body / 50 head damage**. Bots react after **900–1250 ms**, fire two- or three-shot bursts at **420 ms** spacing, rest **1100–1500 ms** between bursts, and use wider imperfect aim. At most two bots can sustain fire at one human at once. The human gets **four seconds of protection** on initial entry and respawn, during which neither incoming damage nor outgoing fire is permitted. Zero HP still causes a three-second respawn. Cover, misses, headshots and multiple attackers affect survival; this is an initial tested balance, not a guarantee of a fixed number of shots in every encounter.

## Crouch and cover

**C toggles crouch**, **Ctrl holds crouch**, and **right-stick click (R3) toggles crouch** in every playable mode. A / × and RT / R2 remain fire controls. Stance transitions take about 180 ms: body height changes from 1.75 to 1.05 metres, eye/shot height from 1.6 to 0.9 metres, and movement falls to 55% speed (aiming slows it further). A server clearance check keeps the player crouched under low overhead geometry. Crouch changes shared collision, shot origins, hit regions and bot aim; the camera follows server stance and remote characters bend their legs with an additive pose over their normal animation. Cars and walls genuinely block appropriate rays, and crouching cannot pass through solid cars or walls.

Toggle stance survives menus; releasing a held Ctrl requests standing when play resumes if there is clearance. Death/respawn resets stance. Lost input stops motion while preserving a safe crouch. The HUD displays current stance. Physical controller/device testing remains outstanding; browser tests exercise standard mappings, mouse/keyboard and replicated online stance.

## Online Free-for-All (local)

Choose Online Free-for-All, optionally enter a callsign, deploy, then select Enter arena. Open a second browser context or tab and choose the same mode to join the shared room. There are no bots. Names receive a short session suffix; they are display labels, not authenticated accounts. A room holds up to **8 clients**, including lobby players and reserved reconnect seats; `FFA_MAX_CLIENTS` accepts 2–8. The ninth client joins another room. This cap is integration-tested, not a claim of internet-scale capacity.

The match runs continuously with no round clock or global restart. Scores last for the connected session, with unlimited respawns. Rifle movement, cover tests, hit damage, ammunition/reload, health, deaths, score and respawn protection are server-authoritative. Spawns prefer separated, covered positions; when possible they stay within 12–45 metres of another player to support encounters on the larger map. Late joiners receive current state.

Esc/Start opens your local menu and stops your input; the shared match continues and your character stays vulnerable. Returning to the main menu removes your actor. An unexpected connection drop reserves the same identity and score for 20 seconds, with a vulnerable stationary body. Automatic reconnect and a same-tab reload use an ephemeral sessionStorage reconnect token; it is not an account credential. Resume explicitly after reconnecting. After expiry or intentional departure, joining starts a new identity and score. Rooms disappear when empty; nothing is persisted.

The client renders the other players, names, radar, shot/hit/death feedback and menu standings. Controller A / × selects menus and fires in play, with release gates after Start/Resume and across menu transitions. Online shares Mercer Districts with Solo while Training remains isolated.

## Phone controls

Landscape touch play is available in Training, Solo and Online. Rotate a portrait phone before starting; tap Start/Enter arena to unlock sound and enter play. Use the left stick to move and swipe the right side to look. Hold FIRE, toggle AIM or CROUCH, tap RELOAD, and use PAUSE for the menu. Movement, looking and firing accept simultaneous fingers. Pointer cancellation, rotation to portrait, loss of focus and returning to the menu release held input; resuming requires a fresh tap. Online pause still leaves your character vulnerable.

The layout respects display safe areas, uses a reduced render resolution and a 1024px mobile shadow map, and does not require pointer lock or orientation permissions. Chrome touch emulation at 667×375 and 932×430 checks simultaneous controls, cancellation, portrait/landscape transitions, audio unlock, reload, crouch and menu exit. Physical Android/iPhone performance and Safari behavior have not yet been tested.

## Shared combat map

Solo and Online use **Mercer Districts: 156 × 156 metres (24,336 m²)**, nine times the playable area of the compact **52 × 52 metre Training** map. Nine named districts combine the original central block with outer shops, workshops, freight cover, a market, depot and motor court. There are 14 enterable buildings, 16 parked cars, connected crossing streets, loading cover, longer sightlines and distributed respawn locations. Two districts now have substantially larger authored landmarks. **North Ironworks**, straight north of the starting street, is a 34 × 26 metre factory with an 8-metre hall, wide loading doors, machinery, gantry crane, mezzanine, a second stair flight through a real roof opening, and a 16-metre chimney. **Foundry Operations** to the northeast has four accessible storeys and a 12.8-metre roof, connected by external switchback stairs and floor landings. Enter from the south or follow the signed stairs on the east side. Collision, shot occlusion, navigation and additional safe respawn positions use the same authored floors/stairs/roofs. Both landmarks appear in Solo and Online; Training is unchanged.

Buildings still share a modular art kit. The landmarks have playable interiors and vertical routes, but machinery and furnishings remain simple original geometry; this is not a finished photorealistic industrial city.

The shared `COMBAT_WORLD` configuration supplies both Solo and Online rendering, collision, cover and respawn positions. Training still uses its original five unarmed targets and compact layout.

Server movement uses a spatial broad phase. Navigation has collision-checked cached graph edges and A* routing across all districts. Graph edges are precomputed in yielding batches before the match server accepts rooms. Rendering reuses facade instances and texture maps, batches static geometry, keeps the 2048px shadow budget, and pauses/hides character presentation beyond 95 metres. The larger map uses the same bounded 80-metre rifle range. A 74-metre server-confirmed damage test checks that Solo rays use its own cover rather than the Training boundary.

Three deterministic full three-minute simulations completed with 12 bots, finite bounded positions, human-only bot targeting and no bot friendly-fire damage across player death/respawn. A nine-district 1440×900 Chrome render tour on this Apple M4 Pro measured approximately 60 fps with 17.3–17.7ms p95 frame intervals and no frame intervals over 50ms in the short samples. This was a local rendering tour with 12 animated bot presentations, not a cross-device benchmark; server simulation is tested separately. Moving initial navigation cache work before room acceptance reduced the recorded full-match maximum step from about 125–137ms to about 42ms in one local test; occasional frame/tick spikes still need profiling. Further district art differentiation, interior furnishing, playtesting of encounter density and lower-powered-device profiling remain useful follow-up work.

## Boundaries and next work

All three modes are locally playable. Training and Solo are personal three-minute sessions; Online is a continuous shared human-only session. One basic rifle is implemented. Authentication, progression, persisted results, jumping, sprinting, additional weapons, player prediction/reconciliation, network lag compensation and public hosting remain future work. This is a prototype, not a production competitive shooter.

Authentication is intentionally deferred; Creda/Calendza use Better Auth, which is the preferred pattern to evaluate for future accounts. No auth code, secrets, or business logic was copied. The local match process defaults to loopback and refuses `NODE_ENV=production` until access controls, join/message rate limits, room resource budgets, secure origins/TLS and observability are designed. An origin check is not authentication. Do not expose this prototype to the internet.

## Structure

```text
apps/web          Nuxt UI and client-only Babylon rendering
apps/match        Long-running authoritative Colyseus server
packages/shared   Movement/combat protocol, urban geometry, collision and ray hits
packages/db       Drizzle schema and SQL migration; not loaded by the demo
scripts/smoke.ts  Isolated real-server personal-session integration check
scripts/online-smoke.ts  Genuine-client FFA integration check
deploy/           Unactivated Railway configuration examples
```

The simulation stays out of Nuxt request handlers. Persistence stores durable identity/results, not per-frame positions. Bot agents and human input share the same authoritative movement and combat rules; future modes should own explicit rules and lifecycle. Weapon catalog and loadout selection should share server-owned weapon definitions when expanded.

## Verification

```sh
pnpm verify           # lint, all package typechecks, unit tests, builds, both network smokes
pnpm exec playwright install chromium  # one-time browser download, if unavailable
pnpm test:browser     # production web build + built match server; test ports 3001/2569 must be free
```

To reuse an installed Google Chrome instead of downloading Chromium: `PLAYWRIGHT_CHANNEL=chrome pnpm test:browser`. Tests use the normal browser renderer. Set `PLAYWRIGHT_SOFTWARE_RENDERING=1` only when a software fallback is needed; forced SwiftShader on this Mac runs near 6 fps and makes timing-sensitive acceptance unreliable.

`pnpm test:smoke` launches the built match process on port 2568 and stops it afterward. It verifies private room isolation, six actors, movement/input validation, stale input stopping and auto-pause, shots/ammo/reload, pause/resume, natural timer completion, replay and early finish. Only test processes can set `TRAINING_TEST_DURATION_MS` to shorten timer tests; clients cannot change session duration.

`pnpm test:online` uses a real match process on port 2570 and genuine SDK clients. It checks shared rooms, reciprocal damage, death/respawn, late joins, invalid input, local pause, identity-preserving reconnect, 20-second reservation expiry, eight-seat capacity/overflow, leave cleanup and Training isolation. Browser acceptance adds two actual browser contexts, rendering, controller fire/release, local menus, automatic transport reconnect and reload reconnect.

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

`deploy/railway-web.example.toml` and `deploy/railway-match.example.toml` are preparation-only examples for separate web and long-running match services. They are not connected to Railway and nothing is deployed. A future approved deployment must set the web client's public match URL, match host/origin, HTTPS/WSS routing and resource limits, and deliberately replace the production refusal after access controls and production readiness are addressed. `PORT` is accepted as a fallback to `MATCH_PORT`. PostgreSQL is optional until persistence is implemented. Do not disable the production guard merely to make these examples start.

## Verification record (2026-10-01)

Verification uses Node 24.14.1, pnpm 11.10.0 and installed Google Chrome. Verification passed lint, all TypeScript checks, 47 unit tests, both application builds, both real WebSocket smoke tests, and all fourteen production-browser acceptance tests. The live preview was separately exercised through movement, red target feedback, elimination, a changed respawn position, pause/resume, results, replay and exit with no browser errors. Six rendered hit/death/respawn cycles were also checked for intact skeleton poses. A real browser player walks into the factory, climbs its mezzanine and roof, and reaches the tower upper floors and roof while a second client checks replicated elevation. Screenshots from browser acceptance runs are saved in ignored `test-results/`. The Babylon client chunk has a bundle-size advisory and loads only for the play route. Live database migration testing is outside this local Training mode. No services are deployed.

API references: [Nuxt installation](https://nuxt.com/docs/4.x/getting-started/installation), [Colyseus server/router](https://docs.colyseus.io/server), [Colyseus state schema](https://docs.colyseus.io/state/schema).

Asset sources and adaptations are documented in [asset provenance](apps/web/public/models/ATTRIBUTION.md) and the in-game Credits page. Buildings use selected CC0 Poly Haven facade modules and 1K surface maps. Blender 4.5.3 was used to convert the replacement assets and retarget animation. It is not required to run the game. Offline conversion scripts are in `scripts/assets`; set `CROSSLINE_ASSET_SOURCES` to the downloaded source folder before running them through Blender.

Respawns select separated, collision-free locations while avoiding recent positions. The renderer resets animation, pose, recoil and hit state on each new life. Three practice targets remain stationary between respawns; two unarmed patrols walk slowly, stop to react to hits, then continue their routes.

## Current visual and audio limits

First-person hands are intentionally omitted at the user's request. The gun is framed closer/lower so its grip and trigger stay outside view; aiming and reload motion preserve that framing. Reload sound and weapon/magazine motion use authoritative reload progress, including pause/resume. A distance-scaled red splash and nine particles appear only on confirmed damaging actor contacts. Presentation resolves the visible character surface so the effect does not begin inside the hitbox, and fades over 0.65 seconds; wall impacts use dust. Close-range and normal 16-metre hits were checked; additional distance-rendering checks cover capped growth, expiration, protected-target, miss, wall and reset cleanup. Dedicated long-range aimed-view verification remains pending. Shot/reload recordings and adaptations are documented in [audio provenance](apps/web/public/audio/ATTRIBUTION.md).

The environment combines textured Poly Haven facades, original counter/shelf/ceiling fittings and simple shared collision geometry. Rocketbox clothing/skin uses local 1K color and normal maps; the Lamoot rifle preserves more mechanical detail and a separate animated magazine; the rohezal car uses its source UV texture and normal maps. Native idle/walk clips were retargeted across differing bind poses, with CC0 combat clips adapted for hit/death/armed/reload poses. Six rendered hit/death/respawn cycles passed pose checks. Assets and scripts are local and licensed; there is no external asset fetch during gameplay. Cars currently share one texture/paint scheme, interiors are still sparse, and this is not a finished photorealistic art set.

Browser inspection uses installed Google Chrome through Playwright; no in-app-browser tool was available. A 12-second 1440×900 local hardware-rendered movement/patrol sample on Apple M4 Pro measured 60.07 fps average, 17.7ms p95 frame interval and no intervals over 50ms. The replacement-art SwiftShader sample measured about 1.74 fps; acceptance uses the normal hardware renderer on this Mac. These short local samples are not a device benchmark. AK-47 shot and mechanism recordings replace synthesized gun/reload audio. Live-browser sample URLs and SHA-256 hashes were matched to the shipped WAVs; four automatic shots peaked at 0.463 without clipping, and reload resumed at its paused offset with no voices playing while paused. Recorded audio is verified by decoded waveforms and browser output meters; subjective speaker/headphone listening quality has not been independently auditioned.
