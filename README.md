# Blender ⇄ Three.js Bakes

Static Three.js blocking editor plus Blender scripts for final Cycles renders from
original `.blend` assets.

For agent-facing operating notes, see [AGENTS.md](AGENTS.md).

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
python3 scripts/check_lighting_presets.py
```

Validation errors use JSON-pointer-style paths such as
`/instances/3/quaternion: expected 4 numbers`.
The lighting preset check compares the browser editor presets against the CLI
presets so calibration changes cannot silently drift.

## Author from the CLI

`scripts/bt.py` can build and render a layout without the browser:

```sh
python3 scripts/bt.py layout new cli_demo --layout layouts/cli_demo.layout.json
python3 scripts/bt.py assets
python3 scripts/bt.py place bone_broken --layout layouts/cli_demo.layout.json --at 0 0 0
python3 scripts/bt.py camera frame bone_broken_001 --layout layouts/cli_demo.layout.json
python3 scripts/bt.py light preset studio --layout layouts/cli_demo.layout.json
python3 scripts/bt.py validate layouts/cli_demo.layout.json
python3 scripts/bt.py inspect layouts/cli_demo.layout.json --json
python3 scripts/bt.py render layouts/cli_demo.layout.json --width 640 --height 360 --samples 32 --json
```

Most commands accept `--json`; contract errors exit 2 and render failures exit 3.

`bt place` uses the manifest/default drop scale when `--scale` is omitted; pass
`--scale` to override it.

For a small preset sanity pass without writing render artifacts, apply a preset
to a throwaway layout and inspect it:

```sh
python3 scripts/bt.py layout new preset_sanity --layout /tmp/preset_sanity.layout.json
python3 scripts/bt.py light preset golden_hour --layout /tmp/preset_sanity.layout.json
python3 scripts/bt.py inspect /tmp/preset_sanity.layout.json
```
