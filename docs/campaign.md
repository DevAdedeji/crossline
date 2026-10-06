# Operation Breakwater

Twenty independently selectable missions, grouped into four acts. Progress stays on the device, with checkpoints after objectives and a best completion time per chapter. Existing opening-chapter saves remain compatible. Arena preview cards show only the image and mission name; selecting a card opens a small briefing. Acknowledging it enters play immediately, including checkpoint continuation. Escape, backdrop or the close button returns to the gallery.

| Chapter | Mission         | Arena                   | Main sequence                                                                  |
| ------- | --------------- | ----------------------- | ------------------------------------------------------------------------------ |
| 01      | The last signal | Harbour Relay           | Disable alarm, rescue Finch, escort to extraction                              |
| 02      | Dead freight    | North Quay              | Recover manifest, rig shipment, withdraw and detonate                          |
| 03      | Safe passage    | Kite Ridge              | Open evacuation channel, rescue Iris, escort to pickup                         |
| 04      | Blackout        | Calder Substation       | Clear control, isolate power, plant charge, defend uplink                      |
| 05      | Iron route      | Ash Rail Yard           | Clear dispatch, recover key, rescue Vale, protect upload                       |
| 06      | Cold water      | Vesper Reservoir        | Find diagram, disarm two timed charges, defend pumps                           |
| 07      | Ghost frequency | Pine Logging Town       | Find key, clear antenna crew, intercept signal, sabotage relay                 |
| 08      | Broken wing     | Kestrel Civil Airport   | Retake terminal, sabotage fuel and cargo, defend runway controls               |
| 09      | Market fire     | Saffron Quarter         | Break blockade, find code, disarm device, defend broadcast                     |
| 10      | Deep cut        | Redstone Quarry         | Clear security, open channel, rescue Mara, hold machinery yard                 |
| 11      | Silent current  | Tidal Old Town          | Collect codes, clear operators, intercept and disable communications           |
| 12      | Burn line       | Ember Fuel Depot        | Clear checkpoint, disarm charges, secure the fuel network                      |
| 13      | Long watch      | Alder Neighbourhood     | Recover data, clear attackers, hold against counterattacks                     |
| 14      | Dust trail      | Dune Caravan Town       | Clear camp, retrieve records, rescue Tariq, defend evacuation                  |
| 15      | Sealed cargo    | East Container Terminal | Clear cargo routes, plant shipment charges, hold the exit                      |
| 16      | Hard reset      | Civic Data Exchange     | Clear security, recover intelligence, sabotage the exchange                    |
| 17      | Last approach   | Morrow Landing Strip    | Clear the strip, activate landing systems, defend the approach                 |
| 18      | White flag      | Breakwater Hospital     | Clear hostiles, restore communications, rescue Sen, defend evacuation          |
| 19      | Chain reaction  | Forge Works             | Read the shutdown sequence, disarm two devices, clear command, defend shutdown |
| 20      | Open horizon    | Horizon Old Town        | Defeat two squads, seize codes, sabotage stores, hold the final counterattack  |

## Objective rules

- Walk into a circle and stay there to interact. No keyboard hold is required.
- Marked squads must be eliminated before their circle can complete; the waypoint tracks a surviving squad member.
- Defend zones pause progress when nearby enemies contest them. Leaving resets the hold. Triggered reinforcements advance toward the zone.
- Timed devices have a two-minute deadline. Failure ends the attempt; retry restores that objective with a fresh deadline.
- Rescued companions follow navigable routes, wait if more than 18 metres behind, and must join you at extraction.
- Extraction zones can be contested. Armed sabotage charges detonate after successful withdrawal.
- Entry and checkpoint retry grant four seconds of protection while getting oriented. Firing or throwing a grenade ends that protection immediately; players can fire on the first input tick.
- Pause freezes combat, grenades, escorts and deadlines. It resets the current interaction hold.

## Arenas and combat

The first three arenas retain their established objective sequences. North Quay now has 24 soldiers and seven port buildings, including larger freight and repair halls, customs desks, storage racks, loading cover and cargo trailers. The 17 later chapters each have 20 soldiers, including staged reinforcement squads; eliminated guards stay eliminated through checkpoints.

Each chapter now has an authored street plan rather than the same grid with different colours. Civilian areas mix 7–10 metre sheds and cottages, family homes, shops and larger shared buildings. Gardens, parked cars, squares and bounded roads create different approaches. The original Kite Ridge village also gains seven small homes and a corner bakery.

| Setting                 | Examples                                       | Spatial character                                                                                 |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Civilian neighbourhoods | Safe passage, Market fire, White flag          | Small homes and gardens, market lanes, a library square or a hospital district                    |
| Abandoned communities   | Ghost frequency, Long watch, Silent current    | Vacant cottages, boarded shops, exposed roof timbers, broken roof sections and overgrown yards    |
| City centre             | Hard reset                                     | Taller apartments, actual upper floors and stairs, an arcade and a civic plaza                    |
| Civil airport           | Broken wing                                    | Glazed arrivals and departure wings, airport hotel, control tower, apron, cargo hangar and runway |
| Remote airstrip         | Last approach                                  | Curved-roof maintenance hangar, flight office, service buildings and a separate runway            |
| Industry                | Blackout, Burn line, Chain reaction            | Workers’ terraces, production halls, machinery aisles, conveyors, tanks and chimneys              |
| Transport and works     | Iron route, Dead freight, Cold water, Deep cut | A railway station, harbour warehouses, reservoir buildings or quarry works                        |

Building entrances, furniture, stairs, cover and parked cars participate in shared collision and navigation. Apartment stairs support enemy pursuit. Daylight, haze and overcast lighting vary by setting; the radar and mission gallery use the revised layouts. Common construction modules are shared to control asset size and rendering cost. The playable terrain remains level, with hills and harbour ships as background scenery; vehicles are still scenery and cover, not drivable.

Enemy soldiers engage on sight and can throw grenades. The red ground ring indicates the blast area. Cover blocks blast damage; grenade throws are spaced apart. Players also carry two grenades per life, thrown with G, RB/R1 or the touch grenade button. Both sides use olive fragmentation shells with fuse caps, safety levers and pull rings. Player projectiles bounce against physical walls and ceilings. Mobile uses the landscape controls and compact mission HUD.

## Verification

`pnpm test` covers objective order, every mission's navigable spawn/objective routes, clear building entrances, physically traversable apartment stairs and enemy routes to rooftops, checkpoint restoration, timed failures, contested defenses, reinforcement activation and physical escort movement. `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test tests/browser/campaign*.spec.ts` checks selection, persistence, retry, desktop gameplay and mobile layouts. Against a running development server, `node scripts/campaign-render-audit.mjs` writes screenshots of all twenty arenas under `/tmp/crossline-campaign-audit` for visual inspection. Browser emulation does not certify physical-phone performance.

To refresh the committed gallery images from the actual game renderer, run `WRITE_CAMPAIGN_PREVIEWS=1 node scripts/campaign-render-audit.mjs` against the development server. Images are included in the explicit offline download.
