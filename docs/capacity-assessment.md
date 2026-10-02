# Local single-arena capacity assessment

The user-selected 100-player limit is now the normal configured admission ceiling in one shared room, but **100 simultaneous players are not performance-verified**. The measurements below were taken before the immediate-signup and durable-confirmation changes. The experimental limit cannot exceed 32 and requires `NODE_ENV=test`, an explicit load flag, a loopback listener, synthetic local auth and an in-memory database. No public deployment or hosted load test has been performed.

## Measured results (2026-10-02)

Apple M4 Pro, 24 GiB RAM, macOS 26.5.2, Node v24.14.1, one local match process with synthetic SDK clients on the same Mac. All six windows completed without client loss or a resource-stop condition. Each window contains about 750 simulation ticks. The 30 Hz simulation budget is 33.33 ms.

The tick and loop p95 columns report the **worst one-second p95** within the window, not a pooled 25-second percentile. CPU is the mean server-process percentage, where 100% equals one core. RSS is peak server-process resident memory. TX/RX are aggregate application payload rates across all clients.

| Players in one arena | Scenario | Tick p95 ms | Max tick ms | Loop p95 ms | RSS MiB | CPU mean | TX KiB/s | RX KiB/s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | idle-connected | 0.22 | 0.29 | 11.56 | 759 | 2.9% | 7.0 | 10.7 |
| 8 | movement-and-fire | 1.45 | 2.24 | 11.56 | 651 | 2.9% | 87.3 | 14.4 |
| 16 | idle-connected | 0.30 | 0.30 | 11.57 | 1079 | 4.3% | 16.5 | 21.4 |
| 16 | movement-and-fire | 1.19 | 6.53 | 11.74 | 585 | 4.4% | 333.8 | 28.9 |
| 32 | idle-connected | 0.43 | 0.50 | 11.67 | 998 | 5.0% | 33.1 | 42.9 |
| 32 | movement-and-fire | 14.72 | 15.22 | 11.58 | 675 | 8.2% | 1299.7 | 57.8 |

Raw one-second samples: [capacity-results.json](capacity-results.json). This verifies only the bounded workloads above; normal admission now defaults to 100, and 100 remains untested. During movement/fire, aggregate payload rose from 333.8 KiB/s at 16 clients to 1,299.7 KiB/s at 32. Full-state fan-out and all-player event broadcasts still grow with audience size, so these samples do not establish a safe larger public cap.

## Optimization and preserved stop evidence

The first run completed both eight-client windows and the sixteen-client idle window. During sixteen-client movement/fire, the unchanged safety guard stopped the test at a worst one-second simulation p95 of 25.11 ms; the partial window contained a 42.91 ms maximum tick. It did not attempt 32 clients. See [the preserved initial run](capacity-before-respawn-cache.json).

Inspection found repeated spawn-visibility scoring inside the sort comparator: a deterministic sixteen-player fixture made 5,100 visibility queries for one respawn. Scores are now computed once per candidate, retaining stable ordering and the same chosen safe spawn. A regression test bounds visibility work to candidate count × opponent count and verifies the captured original spawn. The repeat uses the same 25 ms safety threshold. Workloads use normal random spawns, so before/after load samples are observational rather than a controlled timing comparison.

## Reproduce

Run from the repository root, after `pnpm build`:

```sh
pnpm test:capacity /tmp/crossline-capacity.json
```

The harness starts its own match server on 127.0.0.1:2574, tests 8, 16 and 32 distinct synthetic accounts through the normal HTTP auth and Colyseus admission paths, and checks that every client remains in the same arena. It never targets the live preview or an external server. It respects the normal auth rate limits, including a 61-second pause when preparing 32 accounts. Account creation is excluded from the measured windows.

Each level has two 25-second measurement windows, each preceded by five seconds of warm-up: connected stationary players and players moving, aiming, firing and reloading at 25 input messages per second. Spawns and damage use normal server rules. The clients are SDK clients without rendering; movement is synthetic and does not represent a coordinated dense firefight. This is a short capacity sample, not a soak test or an internet latency test.

Each stage has a 180-second deadline and bounded cleanup. The harness stops on client loss, server RSS above 1,200 MiB, a one-second simulation p95 above 25 ms, event-loop p95 above 100 ms, or server CPU above 150% of one core. Process limits are conservative local stop conditions, not evidence of system-wide thermal or memory-pressure monitoring.

The simulation timer includes movement, shots, state synchronization and event broadcasts. Patch serialization and async account/database work also consume CPU and event-loop time but are outside that timer. Network counters measure application payload passed to the WebSocket transport, including state patches and room messages, excluding WebSocket/TCP/TLS framing. They are not internet egress measurements.

## Rendering is measured separately

With the local development preview running at port 3000:

```sh
node scripts/render-profile.mjs > /tmp/crossline-render-profile.json
```

This samples three static city views for four seconds each in desktop Chrome (1440×900) and mobile-emulated Chrome (844×390, DPR 2). It loads the real Babylon scene and assets, but no combatants. Mobile emulation uses the Mac GPU, so it does not establish physical-phone performance. Two stationary screenshots per view are compared for frame stability; this does not replace moving-camera inspection.

The six map-only views averaged 60.2–60.3 FPS, with p95 frame intervals of 16.7–16.8 ms. There were 0 frames over 50 ms and no page errors. 6/6 stationary screenshot pairs were identical. Raw measurements and renderer strings: [render-results.json](render-results.json).

## Remaining work before claiming 100-player performance

- Add and measure spatial interest management for state and combat events while retaining one authoritative arena. All actors currently replicate to all clients.
- Profile patch serialization, actor visibility/labels and concurrent account checks at higher controlled loads.
- Test dense firefights, reconnect/admission bursts, slower devices, real latency/loss, long sessions and a separately approved hosted PostgreSQL environment.
- Establish memory, bandwidth, abuse/admission and deployment budgets before raising normal admission.

A short 32-client sample cannot be extrapolated into a 100-player readiness claim. No room splitting, deployment, production credentials, services or spending changes are part of this work.
