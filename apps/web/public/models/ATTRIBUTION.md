# Crossline asset provenance

All models and textures are served locally. No third-party requests are made during play. Rocketbox is MIT licensed; other listed assets are CC0/public domain. License notices and credit are retained. No creator endorsement is implied.

| Local asset | Creator / source | Adaptation |
| --- | --- | --- |
| `rocketbox-soldier.glb` | Microsoft, [Rocketbox Military_Male_01](https://github.com/microsoft/Microsoft-Rocketbox), [MIT notice](ROCKETBOX-LICENSE.txt) | 1K color/normal maps, native idle/walk retargeted across bind poses, CC0 Quaternius combat clips adapted to the Rocketbox skeleton in Blender 4.5.3 |
| `lamoot-ak47.glb` | Lamoot, [High poly AK-47](https://opengameart.org/content/high-poly-ak-47), CC0 | One subdivision level, bounded decimation, steel/walnut PBR materials, separated animated magazine, normalized first-person/world scale |
| `rohezal-coupe.glb` | rohezal, [Car VW Corradon 2](https://opengameart.org/content/car-vw-corradon-2), CC0 | Removed source display floor, retained UV color/normal maps, normalized to shared static cover collider |
| `quaternius-swat.glb` | Quaternius, [SWAT](https://poly.pizza/m/Btfn3G5Xv4), [Ultimate Modular Men](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) | Retained as the source of CC0 hit/death/armed/reload animation clips; mesh is no longer loaded at runtime |
| `quaternius-rifle.glb` | Quaternius, [Assault Rifle](https://poly.pizza/m/fpLucho45C) | Previous prototype asset, retained for provenance; no longer loaded |
| `quaternius-sedan.glb` | Quaternius, [Car](https://poly.pizza/m/Cz6yDaUcM9) | Previous prototype asset, retained for provenance; no longer loaded |
| `polyhaven-apartment.glb` | Poly Haven, [Modular Urban Apartments Facade](https://polyhaven.com/a/modular_urban_apartments_facade) | Selected window, plaster wall and cornice modules; normalized origins; unused geometry/materials removed; embedded 1K textures, simplified geometry and compressed opaque maps |
| `polyhaven-factory.glb` | Poly Haven, [Modular Factory Facade](https://polyhaven.com/a/modular_factory_facade) | Selected window, brick wall and cornice modules; normalized origins; unused geometry/materials removed; embedded 1K textures, simplified geometry and compressed opaque maps |
| `../textures/brick-*.jpg` | Poly Haven, [Brick Wall 001](https://polyhaven.com/a/brick_wall_001) | 1K diffuse and OpenGL normal maps |
| `../textures/asphalt-*.jpg` | Poly Haven, [Asphalt 02](https://polyhaven.com/a/asphalt_02) | 1K diffuse and OpenGL normal maps |
| `../textures/concrete-*.jpg` | Poly Haven, [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006) | 1K diffuse and OpenGL normal maps |

Licenses: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), [Poly Haven license](https://polyhaven.com/license).

Downloaded 2026-10-01. Original Quaternius public GLB URLs:

- SWAT: https://static.poly.pizza/713f6535-f4f3-4367-a4c6-ced126ae0936.glb
- Rifle: https://static.poly.pizza/db2d564c-63b2-4316-a89e-0f7d7a2416c9.glb
- Sedan: https://static.poly.pizza/59a67a6c-490e-472e-bae6-5a4d2541f1c7.glb

Poly Haven source file manifests: `https://api.polyhaven.com/files/{asset_id}` using the asset IDs in the source links above. Facades use the `gltf/1k/gltf` distribution; maps use `Diffuse/1k/jpg` and `nor_gl/1k/jpg`. Only selected facade geometry and its required materials/maps are shipped.

Map layout, collision, signs and gameplay code are original Crossline work. The current character has textured clothing/skin, the rifle has detailed geometry and PBR materials, and cars use photographic-style texture maps; this is not photorealistic artwork or licensed Call of Duty content.

Recorded audio sources are documented separately in [audio attribution](../audio/ATTRIBUTION.md).

## Street-detail revision (2026-10-02)

- `polyhaven-street-tree.glb`: Rico Cilliers / Poly Haven, [Tree Small 02](https://polyhaven.com/a/tree_small_02), CC0. Source geometry reduced from 2,062,487 to 51,272 triangles with glTF Transform 4.5.1 / meshoptimizer (ratio .025, error .03); embedded 1K maps. The official leaf opacity map is combined into the color PNG and rendered with alpha testing, avoiding blended foliage sorting.
- `polyhaven-street-bench.glb`: Stuart Attenborrow / Poly Haven, [Modular Street Seating](https://polyhaven.com/a/modular_street_seating), CC0. Selected the complete backrest bench, removed spare connector/display pieces, centered at ground level, simplified geometry and embedded compressed 1K maps.
- `../textures/car-{blue,olive,sand}.jpg`: color variants derived from the existing CC0 rohezal coupe texture. Red body pixels recolored while neutral trim/glass pixels are retained. No new vehicle source or license.

Preparation uses official `https://api.polyhaven.com/files/{asset_id}` manifests and `dl.polyhaven.org` files. Source downloads are excluded from the app; only prepared GLBs and maps are shipped. glTF Transform / sharp were temporary offline preparation tools, not runtime dependencies. Façade module hierarchy is preserved because runtime batching selects panel, blank and trim parts. Each spatial batch owns its instance buffer; collidable walls and doors remain shared with the server.

Mobile variants (`rocketbox-soldier-mobile.glb` and `polyhaven-*-mobile.glb`)
retain the same geometry, animation, materials and licenses as their originals.
Embedded color, normal and material maps are resized to 512px with
`scripts/assets/mobile-textures.py` before delivery, reducing decoded texture
storage by 75%. Desktop continues to load the original models.
