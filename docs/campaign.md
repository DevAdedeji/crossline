# Operation Breakwater

Twenty independently selectable missions, grouped into four acts. Progress stays on the device, with checkpoints after objectives and a best completion time per chapter. Existing opening-chapter saves remain compatible.

| Chapter | Mission | Arena | Main sequence |
| --- | --- | --- | --- |
| 01 | The last signal | Harbour Relay | Disable alarm, rescue Finch, escort to extraction |
| 02 | Dead freight | North Quay | Recover manifest, rig shipment, withdraw and detonate |
| 03 | Safe passage | Kite Ridge | Open evacuation channel, rescue Iris, escort to pickup |
| 04 | Blackout | Calder Substation | Clear control, isolate power, plant charge, defend uplink |
| 05 | Iron route | Ash Rail Yard | Clear dispatch, recover key, rescue Vale, protect upload |
| 06 | Cold water | Vesper Reservoir | Find diagram, disarm two timed charges, defend pumps |
| 07 | Ghost frequency | Pine Relay | Find key, clear antenna crew, intercept signal, sabotage relay |
| 08 | Broken wing | Kestrel Airfield | Clear radar, sabotage fuel and cargo, defend runway controls |
| 09 | Market fire | Saffron Quarter | Break blockade, find code, disarm device, defend broadcast |
| 10 | Deep cut | Redstone Quarry | Clear security, open channel, rescue Mara, hold machinery yard |
| 11 | Silent current | Tidal Listening Post | Collect codes, clear operators, intercept and disable communications |
| 12 | Burn line | Ember Fuel Depot | Clear checkpoint, disarm charges, secure the fuel network |
| 13 | Long watch | Alder Field Station | Recover data, clear attackers, hold against counterattacks |
| 14 | Dust trail | Dune Survey Camp | Clear camp, retrieve records, rescue Tariq, defend evacuation |
| 15 | Sealed cargo | East Container Terminal | Clear cargo routes, plant shipment charges, hold the exit |
| 16 | Hard reset | Civic Data Exchange | Clear security, recover intelligence, sabotage the exchange |
| 17 | Last approach | Morrow Landing Strip | Clear the strip, activate landing systems, defend the approach |
| 18 | White flag | Breakwater Aid Station | Clear hostiles, restore communications, rescue Sen, defend evacuation |
| 19 | Chain reaction | Forge Works | Read the shutdown sequence, disarm two devices, clear command, defend shutdown |
| 20 | Open horizon | Horizon Command Ridge | Defeat two squads, seize codes, sabotage stores, hold the final counterattack |

## Objective rules

- Walk into a circle and stay there to interact. No keyboard hold is required.
- Marked squads must be eliminated before their circle can complete; the waypoint tracks a surviving squad member.
- Defend zones pause progress when nearby enemies contest them. Leaving resets the hold. Triggered reinforcements advance toward the zone.
- Timed devices have a two-minute deadline. Failure ends the attempt; retry restores that objective with a fresh deadline.
- Rescued companions follow navigable routes, wait if more than 18 metres behind, and must join you at extraction.
- Extraction zones can be contested. Armed sabotage charges detonate after successful withdrawal.
- Pause freezes combat, grenades, escorts and deadlines. It resets the current interaction hold.

## Arenas and combat

The first three arenas retain their established objective sequences. North Quay now has 24 soldiers and seven port buildings, including larger freight and repair halls, customs desks, storage racks, loading cover and cargo trailers. The 17 later chapters each have 20 soldiers, including staged reinforcement squads; eliminated guards stay eliminated through checkpoints.

The later arenas use different route layouts, building dimensions and themed landmarks: rail cars and tracks, reservoir basins, signal arrays, wide hangars, a glazed control tower, runway lights and parked aircraft, market stalls, quarry fortifications, factory halls with machinery, conveyors, overhead pipes and chimneys, fuel tanks, field stations and container stacks. Common construction modules are shared to control asset size and rendering cost. These are combat arenas on level playable terrain; hills and harbour ships are background scenery, and vehicles are not drivable.

Enemy soldiers engage on sight and can throw grenades. The red ground ring indicates the blast area. Cover blocks blast damage; grenade throws are spaced apart. Mobile uses the existing landscape controls and compact mission HUD.

## Verification

`pnpm test` covers objective order, every mission's navigable spawn/objective routes, checkpoint restoration, timed failures, contested defenses, reinforcement activation and physical escort movement. `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test tests/browser/campaign*.spec.ts` checks selection, persistence, retry, desktop gameplay and mobile layouts. Against a running development server, `node scripts/campaign-render-audit.mjs` writes screenshots of all twenty arenas under `/tmp/crossline-campaign-audit` for visual inspection. Browser emulation does not certify physical-phone performance.
