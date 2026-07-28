# Layout And Bake Foundation — Design

Date: 2026-06-25
Status: **Supported foundation** — the original prototype is implemented and
now lives alongside the Hair Material Bench and recorded-physics work. The
surfaces share selected serving, vendored Three.js, and offline replay/bake
infrastructure; the live hair app does not use layout JSON or Blender.

This document owns the reusable Three.js layout → JSON contract → Blender bake
pipeline. It is not a description of the repository's whole product surface.
See [README.md](README.md) for the current product map and
[docs/HAIR_MATERIAL_BENCH.md](docs/HAIR_MATERIAL_BENCH.md) for the active Hair
Material Bench contract.

## Goal

Block out a scene interactively in the browser (Three.js), then run a high-quality
Cycles **final render** in Blender of that exact composition.

Browser is where layout is cheap and tactile. Blender is where it's beautiful.
The two are connected by a small JSON contract, not by sharing geometry.

```
[.blend hero assets]
   │  (1) export → lightweight GLB proxies + assets manifest
   ▼
[Three.js layout editor]  ← you work here
   • load GLB proxies from manifest
   • TransformControls: move / rotate / scale each placed instance
   • OrbitControls + "Save Camera": frame the shot
   • duplicate / delete instances, matte preview, Y-up
   │  (2) Export Layout → layout.json
   ▼
[Blender render script]  (headless: Blender --background --python)
   • reads layout.json
   • appends each ORIGINAL .blend's collection (full geometry + materials)
   • applies the placed transform (Y-up → Z-up conversion baked in)
   • sets the camera from the saved view
   • Cycles render → hero PNG/EXR
```

The Hair Material Bench has its own static browser runtime. Its live loop does
not send every frame through this layout contract or Blender. The generic
recorded-motion path emits `motion-clip/1` for the editor and Blender; the hair
app instead replays its own quantized `hair-box3d-guide-clip/1` format in the
browser. That hair-specific clip is not the generic Blender bake contract.

## The core idea (read this first)

**GLB is a disposable proxy used only for positioning. The `.blend` is the real
bake source.** They are linked by a stable `asset_id`.

You never bake the GLB. The browser tells Blender "asset `mushroom` sits at this
transform, camera is here," and Blender re-imports the _good_ mushroom from its
original `.blend` and renders that. This keeps the browser fast and the render
full-fidelity, and avoids the lossy "export everything to glTF and hope materials
survive" trap.

## Repo file layout

```
blender-threejs-bakes/
├── README.md                     # current product map and quickstarts
├── DESIGN.md                     # this layout/bake foundation
├── assets/
│   ├── manifest.json             # stable asset ids and source/proxy metadata
│   ├── glb/                      # mostly generated proxies
│   └── source_blends/            # deliberately self-contained source exceptions
├── editor/                       # the Three.js layout editor (static, no build step)
│   ├── index.html
│   ├── main.js                   # bootstrap and composition
│   ├── scene.js                  # renderer, camera, lighting, resize
│   ├── instances.js              # placement and selection owner
│   ├── layout-io.js              # layout serialization and hydration
│   ├── manifest-loader.js
│   └── vendor/                   # pinned three.js + addons (OrbitControls, TransformControls, GLTFLoader)
├── physics/
│   ├── box3d_scene_runner.c      # generic recorded-motion runner
│   └── labs/                     # separate experimental models and receipts
├── layouts/                      # browser→Blender composition contracts
├── scenes/ + jobs/               # authored physics/render inputs
├── schemas/                      # machine-readable contracts
├── renders/                      # Blender output (gitignored)
└── scripts/
    ├── bt.py + btlib/            # non-interactive layout/bake control surface
    ├── export_proxies.py         # source .blend → GLB proxy + manifest
    ├── compile_*.py              # scene/job → recorded-motion inputs
    ├── render_layout.py          # layout.json → Blender render + receipt
    └── editor_server.py          # local static/API server
```

`Blender` binary (confirmed present): `/Applications/Blender.app/Contents/MacOS/Blender`

## Data contracts

The machine-readable JSON Schemas live in `schemas/`. Run
`python3 scripts/bt.py validate <path>` to validate a layout or manifest with
JSON-pointer-style errors.

`python3 scripts/bt.py` is also the text control surface for layout authoring
and baking. It writes the same schema-v2 Three.js Y-up layout contract as the
browser editor; schema 3 adds keyframe poses for shot packages.

### `assets/manifest.json` — produced by stage 1, consumed by the editor

```json
{
  "generated": "2026-06-25T...",
  "assets": [
    {
      "id": "mushroom",
      "name": "Mushroom",
      "glb": "glb/mushroom.glb",
      "source_blend": "/Users/boxer/asset-menagerie/blenderkit-live/model/mushroom_9d33...blend",
      "collection": "mushroom",          // collection/object to append at bake time
      "bbox": [x, y, z],                  // proxy bounds, for editor placement defaults
      "up_axis": "Z"                      // source up-axis, for the conversion below
    }
  ]
}
```

### `layouts/<name>.layout.json` — produced by the editor, consumed by stage 3

The contract. Transforms are expressed in **Three.js space (Y-up, meters)**; the
Blender script converts. One `instance` per placed object (an asset can appear
many times).

```json
{
  "name": "first_composition",
  "schema": 2,
  "space": "threejs_yup",
  "instances": [
    {
      "instance_id": "mushroom_001",
      "asset_id": "mushroom",
      "position": [x, y, z],
      "quaternion": [x, y, z, w],
      "scale": [sx, sy, sz]
    }
  ],
  "camera": {
    "position": [x, y, z],
    "target":   [x, y, z],
    "fov_deg":  45,
    "up":       [0, 1, 0]
  },
  "render": { "width": 1920, "height": 1080, "samples": 256 },
  "lighting": {
    "preset": "golden_hour",
    "sun": {
      "azimuth_deg": 120,
      "elevation_deg": 8,
      "color": [1.0, 0.86, 0.68],
      "strength": 2.4,
      "angle_deg": 2.6
    },
    "world": {
      "type": "sky",
      "strength": 0.45,
      "color": [0.055, 0.058, 0.065],
      "rotation_deg": 0
    },
    "exposure": 0.0
  }
}
```

Why quaternion not euler: avoids gimbal/order ambiguity across the two engines.

Schema 1 layouts without a `lighting` block are still accepted by the Blender renderer
and use the legacy soft area key. Schema 2 is what the editor writes.

## Coordinate conversion (the one piece of real math)

Three.js is **Y-up, right-handed**. Blender is **Z-up, right-handed**.
The mapping that preserves handedness:

```
blender = (x, -z, y)      # for a Three.js vector (x, y, z)
```

`render_layout.py` applies this once, as a basis-change matrix `C`, to each
instance matrix and to the camera position/target:

```
M_blender = C · M_threejs · C⁻¹     # for the rotation/scale basis
p_blender = C · p_threejs           # for points
```

Encapsulate `C` in one helper so it's defined in exactly one place. Most
round-trip bugs in this kind of tool come from converting in two places with
slightly different conventions.

## Stage 1 — `export_proxies.py` (Blender, headless)

For each selected hero `.blend`:

1. Open / append its main collection into an empty scene.
2. Export that collection to `assets/glb/<id>.glb`
   (`+Y up`, apply modifiers, draco off for simplicity, include normals).
3. Record `id`, `name`, `source_blend`, `collection`, `bbox` into `manifest.json`.

Notes:

- Decimate or cap proxy poly count if any asset is heavy (proxies just need
  silhouette + rough material — matte is fine, per the findings' "clay-model-room"
  preference). A `--max-tris` knob, default e.g. 50k.
- `id` = slug of the asset name (strip the BlenderKit UUID). Must be stable —
  it's the join key the whole pipeline depends on.

## Stage 2 — Three.js layout editor (`editor/`)

Static page, no build step. Pin three.js (e.g. r0.16x ESM from a vendored copy so
it works offline). Features, in priority order:

1. **Asset palette** from `manifest.json` — click to drop an instance at origin.
2. **TransformControls** — translate / rotate / scale the selected instance;
   keyboard `W/E/R` to switch mode (Blender-ish muscle memory is fine too).
3. **OrbitControls** for the working camera + **Save Camera** button that snaps
   the render camera to the current view (stores pos/target/fov).
4. **Instance list** — select, duplicate, delete, rename.
5. **Export Layout** → downloads `<name>.layout.json`. **Load Layout** → restores.
6. Lighting preset controls drive the preview directional/hemisphere lights and are
   serialized into the layout for Blender. Preview is predictive for direction, warmth,
   and rough intensity, not pixel-identical to Cycles.

Deliberately **not** in the editor: materials, final lighting, bloom. Those live
in the `.blend` assets and the render script. The editor is a blocking tool.

## Stage 3 — `render_layout.py` (Blender, headless)

```
Blender --background --python scripts/render_layout.py -- layouts/foo.layout.json
```

1. Start clean scene. Read layout.json + manifest.json.
2. For each instance: `bpy.ops.wm.append` the asset's collection from its
   `source_blend`; wrap in an empty; set the converted matrix.
   (Append = full copy, self-contained render. Link is an option later for
   memory, but append is simpler and avoids broken relative paths.)
3. Build camera from converted pos/target, set `lens`/`fov`, aim with track-to.
4. Engine = Cycles, samples from layout (default 256), set resolution, denoise on.
5. Lighting: schema-v2 layouts build a SUN lamp plus color/Nishita world and exposure.
   Schema-1 layouts use the legacy soft area key for back compatibility.
6. Render → `renders/<name>.png`. Write a small `renders/<name>.receipt.json`
   (inputs, sample count, asset list, timestamp) — receipts proved their worth
   in the prior run.

## Current Boundaries

- **Proxy appearance is approximate.** GLBs are placement aids, not proof of
  final Blender material parity.
- **Append remains the bake default.** Linking may be revisited for very large
  scenes, but it is not the supported contract today.
- **Starter scale is placement metadata.** Layouts retain explicit transforms;
  the helper only supplies a reasonable initial scale.
- **The editor is not a material or physics authority.** It authors layout and
  previews sampled motion. Blender owns final bake appearance, and Box3D owns
  the rigid-body integration that produced a motion clip.
- **Fresh-checkout proxy coverage remains a readiness concern.** Current
  manifest validation includes proxy-file availability, so a missing local
  proxy is reported as a validation failure. Do not interpret that result as a
  schema-only verdict.

The end-to-end coordinate round trip is already implemented. Changes to
parenting, transforms, camera conversion, or layout schemas must preserve it by
running `scripts/smoke_roundtrip.py`; screenshots alone do not prove this
foundation.
