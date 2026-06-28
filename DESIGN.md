# Blender ⇄ Three.js Bake Workflow — Design

Date: 2026-06-25
Status: **Implemented prototype** — schema-v2 layouts carry camera, render, and lighting intent.

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

## The core idea (read this first)

**GLB is a disposable proxy used only for positioning. The `.blend` is the real
bake source.** They are linked by a stable `asset_id`.

You never bake the GLB. The browser tells Blender "asset `mushroom` sits at this
transform, camera is here," and Blender re-imports the *good* mushroom from its
original `.blend` and renders that. This keeps the browser fast and the render
full-fidelity, and avoids the lossy "export everything to glTF and hope materials
survive" trap.

## Repo file layout

```
blender-threejs-bakes/
├── DESIGN.md                     # this file
├── README.md                     # quickstart once code lands
├── assets/
│   ├── manifest.json             # [{id, name, glb, source_blend, collection, bbox}]
│   └── glb/                      # generated GLB proxies (gitignored, regenerable)
├── editor/                       # the Three.js layout editor (static, no build step)
│   ├── index.html
│   ├── editor.js                 # scene, controls, instance list, save/load
│   ├── manifest-loader.js
│   └── vendor/                   # pinned three.js + addons (OrbitControls, TransformControls, GLTFLoader)
├── layouts/                      # saved compositions
│   └── *.layout.json             # the browser→blender contract
├── renders/                      # Blender output (gitignored)
└── scripts/
    ├── export_proxies.py         # Blender: .blend hero assets → assets/glb/*.glb + manifest.json
    ├── render_layout.py          # Blender: layout.json → renders/<name>.png
    ├── blender.sh                # thin wrapper over /Applications/Blender.app/.../Blender
    └── serve.sh                  # `python3 -m http.server` for the editor (avoids file:// CORS)
```

`Blender` binary (confirmed present): `/Applications/Blender.app/Contents/MacOS/Blender`

## Data contracts

The machine-readable JSON Schemas live in `schemas/`. Run
`python3 scripts/bt.py validate <path>` to validate a layout or manifest with
JSON-pointer-style errors.

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
      "elevation_deg": 10,
      "color": [1.0, 0.78, 0.48],
      "strength": 4.0,
      "angle_deg": 1.8
    },
    "world": {
      "type": "sky",
      "strength": 0.8,
      "color": [0.05, 0.055, 0.06],
      "rotation_deg": 0
    },
    "exposure": 0.35
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

For each hero `.blend` (start with the 12 in
`/Users/boxer/asset-menagerie/blenderkit-live/model/`):

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

## Open questions to resolve before/at implementation

1. **Material parity in the proxy.** GLB proxies will look matte/approximate vs.
   the final Blender materials. Acceptable for blocking? (Findings say yes — clay
   preview is preferred.) If you later want closer preview, we can bake a small
   albedo into the GLB.
2. **Lighting authoring.** v1 = single world HDRI. Do you want light placement in
   the browser too (a later "lights are just another asset type" extension), or
   keep lighting purely Blender-side via a named rig?
3. **Append vs link** for the bake. Default append (self-contained). Revisit only
   if scenes get heavy.
4. **Asset scale normalization.** BlenderKit assets have wildly different real
   scales. Do we trust source scale, or normalize each proxy to a unit bbox in
   the editor and carry a per-asset scale factor? (Leaning: keep true scale,
   surface a bbox readout so mismatches are visible.)

## Build milestones (when code is greenlit)

- **M1** `export_proxies.py` + `manifest.json` for 2–3 assets; eyeball the GLBs.
- **M2** Editor loads manifest, drops/transforms instances, saves `layout.json`.
- **M3** `render_layout.py` round-trips one hand-written layout → correct render
  (proves the coordinate conversion before the editor is even pretty).
- **M4** Full loop: place in browser → export → render, on the 12 hero assets.
- **M5** Save Camera, instance list polish, receipts, lighting hook.

The critical de-risking step is **M3 before M2's polish** — get the
browser→Blender coordinate round-trip provably correct on one asset, because
that's where this class of tool usually breaks.
```
