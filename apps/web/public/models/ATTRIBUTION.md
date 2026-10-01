# Crossline asset provenance

All models and textures are served locally. No third-party requests are made during play. These assets are CC0/public domain; credit is retained for traceability. No creator endorsement is implied.

| Local asset | Creator / source | Adaptation |
| --- | --- | --- |
| `quaternius-swat.glb` | Quaternius, [SWAT](https://poly.pizza/m/Btfn3G5Xv4), [Ultimate Modular Men](https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ) | Male human model, scale, olive uniform, animation selection/blending; Training targets are unarmed |
| `quaternius-rifle.glb` | Quaternius, [Assault Rifle](https://poly.pizza/m/fpLucho45C) | Scale/orientation, first-person framing and recoil; magazine geometry separated for timed reload motion |
| `quaternius-sedan.glb` | Quaternius, [Car](https://poly.pizza/m/Cz6yDaUcM9) | Collider fit, paint, roughness and street reflections |
| `polyhaven-apartment.glb` | Poly Haven, [Modular Urban Apartments Facade](https://polyhaven.com/a/modular_urban_apartments_facade) | Selected window, plaster wall and cornice modules; normalized origins; unused geometry/materials removed; embedded 1K textures |
| `polyhaven-factory.glb` | Poly Haven, [Modular Factory Facade](https://polyhaven.com/a/modular_factory_facade) | Selected window, brick wall and cornice modules; normalized origins; unused geometry/materials removed; embedded 1K textures |
| `../textures/brick-*.jpg` | Poly Haven, [Brick Wall 001](https://polyhaven.com/a/brick_wall_001) | 1K diffuse and OpenGL normal maps |
| `../textures/asphalt-*.jpg` | Poly Haven, [Asphalt 02](https://polyhaven.com/a/asphalt_02) | 1K diffuse and OpenGL normal maps |
| `../textures/concrete-*.jpg` | Poly Haven, [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006) | 1K diffuse and OpenGL normal maps |

Licenses: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), [Poly Haven license](https://polyhaven.com/license).

Downloaded 2026-10-01. Original Quaternius public GLB URLs:

- SWAT: https://static.poly.pizza/713f6535-f4f3-4367-a4c6-ced126ae0936.glb
- Rifle: https://static.poly.pizza/db2d564c-63b2-4316-a89e-0f7d7a2416c9.glb
- Sedan: https://static.poly.pizza/59a67a6c-490e-472e-bae6-5a4d2541f1c7.glb

Poly Haven source file manifests: `https://api.polyhaven.com/files/{asset_id}` using the asset IDs in the source links above. Facades use the `gltf/1k/gltf` distribution; maps use `Diffuse/1k/jpg` and `nor_gl/1k/jpg`. Only selected facade geometry and its required materials/maps are shipped.

Map layout, collision, signs and gameplay code are original Crossline work. Characters, rifles and sedans are stylized low-polygon assets alongside textured architectural modules; this is not photorealistic artwork or licensed Call of Duty content.

Recorded audio sources are documented separately in [audio attribution](../audio/ATTRIBUTION.md).
