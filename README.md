# Blender ⇄ Three.js Bakes

Static Three.js blocking editor plus Blender scripts for final Cycles renders from
original `.blend` assets.

## Run the editor

```sh
./scripts/serve.sh
```

Open `http://127.0.0.1:8091/editor/`.

`serve.sh` starts the editor in the background, writes a PID/log under `.run/`,
and replaces a stale listener on the same port. Useful commands:

```sh
./scripts/serve.sh status
./scripts/serve.sh wake
./scripts/serve.sh stop
```

The editor reads `assets/manifest.json`, lets you place and transform instances,
saves the current OrbitControls camera, stores lighting presets/sun/world intent,
and exports a `*.layout.json` file that the Blender renderer can consume.

## Generate GLB proxies

```sh
./scripts/blender.sh --background --python scripts/export_proxies.py -- \
  --source-dir /Users/boxer/asset-menagerie/blenderkit-live/model \
  --limit 12
```

This writes `assets/glb/*.glb` and refreshes `assets/manifest.json`.

## Render a layout

```sh
./scripts/blender.sh --background --python scripts/render_layout.py -- \
  layouts/example.layout.json
```

Output lands in `renders/<layout-name>.png` with a matching receipt JSON.

## Validate contracts

```sh
python3 scripts/bt.py validate layouts/live.layout.json
python3 scripts/bt.py validate assets/manifest.json --json
```

Validation errors use JSON-pointer-style paths such as
`/instances/3/quaternion: expected 4 numbers`.
