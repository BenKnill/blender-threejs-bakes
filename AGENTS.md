# Agent Operating Guide

## Machine Workbench Authority

HOL Light Workbench is Ubuntu-only. On this MacBook, every Workbench, HOL,
OCaml, CRIU, Dune, syntax-check, inspection, and test process must run inside
the local OrbStack Ubuntu guest. The authoritative guest checkout is
`/home/boxer/src/hol-light-workbench`.

Project proof sources may stay in this repository through the guest filesystem
mount. From a Mac shell, use `orb -m dev` only to enter Ubuntu, then run the
checkout-relative guest clients:

```sh
orb -m dev
cd /home/boxer/src/hol-light-workbench
hol-workbench/bin/smoke
hol-workbench/bin/prove /absolute/path/to/source.ml --run-root /tmp/proof-runs
hol-workbench/bin/inspect /tmp/proof-runs
```

Never invoke `/Users/boxer/.local/share/hol-light-workbench/bin`; that retired
installation is refusal-only. Do not fall back to native macOS, WSL, an old
installed client, a cold load, or a profile rebuild.

This is the front door for coding agents working in this repo. It documents the
current supported loop and the contracts that must stay stable. Treat only the
surfaces documented here as stable; do not assume unlisted editor APIs or browser
automation hooks exist.

Use [docs/README.md](docs/README.md) to route into product, foundation, and
research documentation before editing a specialized lane.

## Product And Architecture Model

The repository has four distinct ownership layers:

1. **Current product:** the Hair Material Bench under
   `physics/labs/hair_material/demo/`, packaged for the canonical Pages site by
   `scripts/build_hair_pages.mjs`.
2. **Supported foundation:** the static Three.js layout editor, `bt` CLI,
   versioned JSON contracts, and Blender bake scripts.
3. **Recorded motion integration:** authored scene/job contracts compile to
   Box3D, which records `motion-clip/1`; browser and Blender consumers replay
   those samples without running a second rigid-body solver.
4. **Research lanes:** the other `physics/labs/*` experiments keep separate
   models, receipts, and non-claims. Do not flatten them into one generic
   production physics API.

In the layout/bake foundation, lightweight GLBs are positioning proxies only.
Original `.blend` assets are the bake source. `assets/manifest.json` joins those
worlds by stable `asset_id`, and `*.layout.json` is the browser-to-Blender
contract. Coordinate conversion happens in one place:
`scripts/render_layout.py`.

## Current Commands

### Hair Material Bench

Start the canonical curated scene locally:

```sh
just hair-groom-hydration-showcase
```

Start the editable laboratory:

```sh
just hair-material
```

Build the self-contained public payload without deploying it:

```sh
just hair-pages-build
```

The deployed scenes are presentation and research artifacts, not calibrated
hair prediction or proof that every visible fiber is simulated. Preserve the
claim boundaries and deterministic receipts in
`docs/HAIR_MATERIAL_BENCH.md`.

### Layout And Bake Foundation

Serve the editor:

```sh
./scripts/serve.sh
./scripts/serve.sh status
./scripts/serve.sh wake
./scripts/serve.sh stop
```

`npm run serve` is an alias for `./scripts/serve.sh`. The service defaults to
`http://127.0.0.1:8091/editor/`, writes PID/log files under `.run/`, and replaces
stale listeners on the same port.

Render a saved layout:

```sh
./scripts/blender.sh --background --python scripts/render_layout.py -- \
  layouts/example.layout.json
```

Smoke-test the Blender round trip:

```sh
./scripts/blender.sh --background --python scripts/smoke_roundtrip.py
```

Lint/format the JavaScript browser and Node surfaces:

```sh
npm run lint
npm run format
```

Python scripts follow the repo Ruff settings. `just lint` uses `ruff` when
installed and otherwise runs the same checks through `uvx`:

```sh
uvx ruff format scripts
uvx ruff check scripts
```

Run the dependency-light Box3D scene/physics compiler contracts:

```sh
just test
```

Wrap expensive Blender/ffmpeg stages with `scripts/bake_telemetry.py` when bake
cost matters. It records wall time, sampled peak process-tree RSS, exit status,
and declared artifact sizes without hiding child output. See
`docs/BAKE_TELEMETRY.md`.

The local `just lint` and `just test` commands are the source of truth for
JavaScript lint/format, Python lint, and dependency-light contract checks. See
[the integration handoff](docs/INTEGRATION_HANDOFF.md) for the stable boundary
and deliberate non-claims.

### Recorded Physics And Research Lanes

Run the complete native Box3D → Blender proof (requires a local Box3D checkout
and Blender):

```sh
BOX3D_SOURCE_DIR=/Users/boxer/box3d bash scripts/build_basic_animation.sh
```

Run the small native-Box3D soft-ribbon fixture and its optional neon replay:

```sh
just soft-ribbon
just soft-ribbon-video
```

The first command produces a deterministic motion clip, structural/performance
receipts, and a lightweight SVG preview. The second renders the recorded Box3D
motion in Blender; Blender does not resimulate it.

The wind-wave follow-up uses the same recorded-motion boundary:

```sh
just wind-garden
just wind-garden-video
```

The real-asset follow-up maps those guides onto the SeedThree canopy and a
dense visual groom while measuring the Blender and video stages separately:

```sh
just seedthree-wind
just mannequin-haircut
just hair-material
```

Validate a layout or manifest contract:

```sh
python3 scripts/bt.py validate layouts/live.layout.json
python3 scripts/bt.py validate assets/manifest.json --json
python3 scripts/bt.py validate assets/manifest.json --check-proxies --json
python3 scripts/check_lighting_presets.py
```

Bootstrap missing browser proxy GLBs from the manifest:

```sh
./scripts/blender.sh --background --python scripts/export_proxies.py -- \
  --manifest assets/manifest.json --missing-only --dry-run
./scripts/blender.sh --background --python scripts/export_proxies.py -- \
  --manifest assets/manifest.json --missing-only
```

Author and render a layout without the browser:

```sh
python3 scripts/bt.py layout new cli_demo --layout layouts/cli_demo.layout.json
python3 scripts/bt.py assets --json
python3 scripts/bt.py place bone_broken --layout layouts/cli_demo.layout.json --at 0 0 0
python3 scripts/bt.py move bone_broken_001 --layout layouts/cli_demo.layout.json --by 0 1 0
python3 scripts/bt.py camera frame bone_broken_001 --layout layouts/cli_demo.layout.json
python3 scripts/bt.py light preset studio --layout layouts/cli_demo.layout.json
python3 scripts/bt.py inspect layouts/cli_demo.layout.json --json
python3 scripts/bt.py render layouts/cli_demo.layout.json --width 640 --height 360 --samples 32 --json
```

CLI exit codes: 0 means success, 2 means invalid input or contract failure, and
3 means Blender render failure.

Lighting preset calibration changes should also run:

```sh
python3 scripts/bt.py layout new preset_sanity --layout /tmp/preset_sanity.layout.json
python3 scripts/bt.py light preset golden_hour --layout /tmp/preset_sanity.layout.json
python3 scripts/bt.py inspect /tmp/preset_sanity.layout.json
```

## Architecture Invariants

- The Hair Material Bench is the current product surface. The layout editor is
  supported infrastructure, and sibling physics labs remain separate research
  lanes with their own claim boundaries.
- The editor is static ESM with vendored Three.js under `editor/vendor/`; there
  is no build step.
- The Hair Material Bench has a packaging step, not an application bundler:
  `scripts/build_hair_pages.mjs` copies the self-contained browser app and
  required vendored modules into `dist/`.
- Editor space is always Three.js Y-up. Layouts use `"space": "threejs_yup"`.
- The Y-up to Blender Z-up conversion lives only in `scripts/render_layout.py`.
  If another caller needs conversion, extract shared logic instead of copying the
  matrix.
- `manifest.json` and `*.layout.json` are API contracts. Breaking layout changes
  must bump `"schema"` and either preserve or loudly reject old versions.
- `asset_id` is the stable join key across GLB proxy, manifest entry, and source
  `.blend`; do not rename or reuse ids casually.
- Generated/heavy artifacts normally stay out of git: `assets/glb/`,
  `renders/`, `__pycache__/`, and `node_modules/`. A deliberately
  self-contained source/proxy pair may be tracked under
  `assets/source_blends/` and `assets/glb/` with provenance and a reviewable
  payload boundary.
- Blender outputs write receipt JSON sidecars. Keep that provenance intact when
  touching render or proxy export paths.
- The first physics bridge keeps authored and simulated state in Three.js Y-up
  MKS space. Box3D is the sole rigid-body integrator; Blender consumes the
  sampled motion clip and performs the existing Y-up → Z-up conversion only at
  the render boundary.
- The generic scene compiler supports static and dynamic bbox-collider bodies.
  It explicitly rejects kinematic bodies and generic joint authoring.
  Specialized tree and hair paths do not widen that stable generic contract.

## Current Data Contracts

`assets/manifest.json` contains a top-level `assets` array. Each asset points to
its proxy and source bake asset, for example:

```json
{
  "id": "mushroom",
  "name": "Mushroom",
  "glb": "glb/mushroom.glb",
  "source_blend": "/absolute/path/to/source.blend",
  "collection": "mushroom",
  "bbox": [1.0, 1.0, 1.0]
}
```

`layouts/*.layout.json` currently accepts schemas 1, 2, and 3. The editor writes
schema 2 layouts with:

- `name`
- `schema`
- `space`
- `instances`
- `camera`
- `render`
- `lighting`

Schema 3 adds a `keyframes` block with A/B pose overrides. The `bt keyframes`
commands create and clear schema-3 keyframe data for shot packages.

`renders/shots/<shot_id>/shot.json` uses shot schema 1. It records prompt/video
handoff fields, source layouts, stable `frames.first`/`frames.last` paths, and
the Blender render receipts folded into `render_metadata`.

See `schemas/layout.schema.json`, `schemas/manifest.schema.json`, `DESIGN.md`,
and `CONVENTIONS.md` for the fuller contract.

## Current API Endpoints

The local server is `scripts/editor_server.py`, normally reached through
`./scripts/serve.sh`.

- `GET /api/health` returns `{ "ok": true, "service": "editor_server" }`.
- `GET /api/renders` returns `{ "renders": [...] }` for PNG files under
  `renders/`.
- `GET /api/state` returns the current `layouts/live.layout.json` layout object.
  If no live layout has been saved, it returns HTTP 404 with
  `{ "ok": false, "error": "live layout not found", "layout": "layouts/live.layout.json" }`.
- `POST /api/save-layout` accepts a layout JSON body, validates schema 1, 2, or 3,
  writes a timestamped `layouts/*.layout.json`, updates
  `layouts/live.layout.json`, and returns paths.
- `POST /api/render-layout` accepts `{ "layout": "layouts/name.layout.json" }`
  or defaults to `layouts/live.layout.json`, runs Blender headlessly, and returns
  render metadata or a structured error payload. A render that exceeds 900
  seconds returns HTTP 504 with `error` and `timeout_seconds` fields.

Static files are also served from the repo root, including `/editor/`,
`/assets/...`, and `/renders/...`.

## Driving The Editor As An Agent

The editor exposes stable `data-testid` hooks for control targeting. Use these
selectors rather than button text or visual position.

- Transform modes: `mode-translate`, `mode-rotate`, `mode-scale`. The active
  mode also has `aria-pressed="true"`.
- Layout controls: `layout-name`, `save-camera`, `export-layout`,
  `save-for-bake`, `bake-layout`, `load-layout`.
- Render fields: `render-width`, `render-height`, `render-samples`,
  `refresh-renders`, `render-status`.
- Lighting fields: `lighting-preset`, `sun-azimuth`, `sun-elevation`,
  `sun-color`, `sun-strength`, `sun-angle`, `world-type`, `world-strength`,
  `world-color`, `exposure`.
- Lists: `asset-palette`, `asset-row:<asset_id>`, `instance-list`,
  `instance-row:<instance_id>`, `render-gallery`, `render-tile:<filename>`.
- Status/HUD: `manifest-status`, `viewport`, `viewport-hud`, `hud-mode`,
  `hud-selection`.

Basic verify loop: target controls by `data-testid`, use `POST /api/save-layout`
or the `save-for-bake` control to update `layouts/live.layout.json`, then poll
`GET /api/state` and compare the returned layout fields.

Issue #11 is closed; do not treat it as pending work. The stable selector and
live-state readback slice described above landed from that line of work. There
is still no stable `/api/screenshot` endpoint in `scripts/editor_server.py`; if
an agent needs screenshot automation, open or follow a focused current issue for
that endpoint instead of citing closed #11.

## Current: Contract Validation

`python3 scripts/bt.py validate <path> [...]` validates layouts, manifests,
presets, and shot packages. It exits 0 on success and 2 for contract errors.
`--json` emits structured results, and text errors use JSON-pointer-style paths
such as `/instances/3/quaternion: expected 4 numbers`.

Manifest validation is structural by default so fresh checkouts can pass even
when ignored `assets/glb/*.glb` proxies are missing. Add `--check-proxies` when
you specifically need editor preview-readiness to fail on missing browser GLBs,
then rebuild them with `scripts/export_proxies.py --manifest assets/manifest.json
--missing-only`.

## Current: `bt` CLI

`python3 scripts/bt.py` is the non-interactive control surface for layout
authoring and baking. It supports these stable commands:

- `bt assets`
- `bt layout new <name>` and `bt layout show`
- `bt place <asset_id>`
- `bt move|rotate|scale <instance_id>`
- `bt remove <instance_id>`
- `bt camera set` and `bt camera frame <instance_id>`
- `bt light preset <name>` and `bt light sun`
- `bt preset list|show|copy|load`
- `bt validate`
- `bt inspect`
- `bt keyframes camera-move|clear`
- `bt render` and `bt render --shot <shot_id>`
- `bt textures`

Use `--json` when machine-readable output matters. The CLI edits schema-valid
Three.js Y-up layouts only; Blender conversion remains confined to
`scripts/render_layout.py`.

## Current: Inspect Diagnostics

`python3 scripts/bt.py inspect [layout]` emits a Blender-free geometry report for
agents that cannot see the scene. It reports per-instance Three.js and Blender
positions, bbox times scale size, scale sanity against the shared manifest/default
drop scale, approximate camera framing/clip edges/coverage/distance, sun direction
relative to the camera, rough bbox overlaps, and grounded/floating/sunken state.
Use `--json` for stable machine-readable diagnostics.

## Unsupported: Screenshot Endpoint

`GET /api/screenshot` is not implemented. Use the in-browser automation surface,
browser screenshots, or Blender render outputs for visual receipts until a
focused screenshot-endpoint issue lands.
