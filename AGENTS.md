# Agent Operating Guide

This is the front door for coding agents working in this repo. It documents the
current supported loop and the contracts that must stay stable. Broader
non-interactive authoring, diagnostics, and computer-use surfaces are tracked
below as pending work; do not assume they exist yet.

## Model

The browser editor uses lightweight GLB proxies only for positioning. The
original `.blend` assets are the bake source. `assets/manifest.json` joins those
worlds by stable `asset_id`, and `*.layout.json` is the browser-to-Blender
contract. Coordinate conversion happens in one place: `scripts/render_layout.py`.

## Current Commands

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

Lint/format the static editor:

```sh
npm run lint
npm run format
```

Python scripts follow the repo ruff settings:

```sh
pipx run ruff format scripts
pipx run ruff check scripts
```

Validate a layout or manifest contract:

```sh
python3 scripts/bt.py validate layouts/live.layout.json
python3 scripts/bt.py validate assets/manifest.json --json
```

## Architecture Invariants

- The editor is static ESM with vendored Three.js under `editor/vendor/`; there
  is no build step.
- Editor space is always Three.js Y-up. Layouts use `"space": "threejs_yup"`.
- The Y-up to Blender Z-up conversion lives only in `scripts/render_layout.py`.
  If another caller needs conversion, extract shared logic instead of copying the
  matrix.
- `manifest.json` and `*.layout.json` are API contracts. Breaking layout changes
  must bump `"schema"` and either preserve or loudly reject old versions.
- `asset_id` is the stable join key across GLB proxy, manifest entry, and source
  `.blend`; do not rename or reuse ids casually.
- Generated/heavy artifacts stay out of git: `assets/glb/`, `renders/`,
  `__pycache__/`, and `node_modules/`.
- Blender outputs write receipt JSON sidecars. Keep that provenance intact when
  touching render or proxy export paths.

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

`layouts/*.layout.json` currently accepts schema 1 or 2. The editor writes schema
2 layouts with:

- `name`
- `schema`
- `space`
- `instances`
- `camera`
- `render`
- `lighting`

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
- `POST /api/save-layout` accepts a layout JSON body, validates schema 1 or 2,
  writes a timestamped `layouts/*.layout.json`, updates
  `layouts/live.layout.json`, and returns paths.
- `POST /api/render-layout` accepts `{ "layout": "layouts/name.layout.json" }`
  or defaults to `layouts/live.layout.json`, runs Blender headlessly, and returns
  render metadata or an error payload.

Static files are also served from the repo root, including `/editor/`,
`/assets/...`, and `/renders/...`.

There is no stable `/api/screenshot` or full authoring CLI API yet.

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

## Current: Contract Validation

`python3 scripts/bt.py validate <path> [...]` validates layouts and manifests.
It exits 0 on success and 2 for contract errors. `--json` emits structured
results, and text errors use JSON-pointer-style paths such as
`/instances/3/quaternion: expected 4 numbers`.

## Pending: Broader `bt` CLI

Pending issue: #7, "bt CLI: a non-interactive control surface for the whole
loop".

Only `bt validate` exists today. Do not document or depend on `bt assets`,
`bt place`, `bt render`, or other authoring commands until #7 lands. For now,
use the shell commands above and the local HTTP endpoints.

## Pending: Inspect Diagnostics

Pending issue: #9, "bt inspect: text scene diagnostics for agents that can't
see".

There is no text scene-inspection command yet. Use layouts, receipts, and render
metadata as the current machine-readable evidence.

## Pending: Computer-Use Harness

Pending issue: #11, "Computer-use harness: legible/driveable GUI + live state &
screenshot endpoints".

This guide now documents the first stable selector and live-state slice. The HUD,
`/api/screenshot`, and committed Playwright example are still pending.
