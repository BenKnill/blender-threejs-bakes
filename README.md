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

Fresh checkouts intentionally do not commit most browser proxy GLBs. To rebuild
the missing proxies from the manifest's `source_blend` paths:

```sh
./scripts/blender.sh --background --python scripts/export_proxies.py -- \
  --manifest assets/manifest.json --missing-only
```

Use `--dry-run` first to see which proxies would be exported and whether any
source `.blend` path is unavailable locally.

To create a new manifest from a source directory instead:

```sh
./scripts/blender.sh --background --python scripts/export_proxies.py -- \
  --source-dir /Users/boxer/asset-menagerie/blenderkit-live/model \
  --limit 12
```

Both flows write `assets/glb/*.glb` and refresh `assets/manifest.json` plus
`assets/manifest.receipt.json`.

## Render a layout

```sh
./scripts/blender.sh --background --python scripts/render_layout.py -- \
  layouts/example.layout.json
```

Output lands in `renders/<layout-name>.png` with a matching receipt JSON.

## Bake a composition preset

Composition presets live in `presets/*.preset.json`. Each preset is a reusable
creative recipe with metadata, a required asset list, and an embedded schema-v2
layout skeleton. The CLI checks those required assets against
`assets/manifest.json` before writing a layout.

```sh
python3 scripts/bt.py preset list
python3 scripts/bt.py preset show starship_shrine_spaceport
python3 scripts/bt.py preset copy starship_shrine_spaceport \
  --layout layouts/starship_shrine_spaceport.layout.json
python3 scripts/bt.py validate layouts/starship_shrine_spaceport.layout.json
python3 scripts/bt.py render layouts/starship_shrine_spaceport.layout.json \
  --width 1280 --height 720 --samples 64
```

Use `preset load <id> --layout layouts/live.layout.json --force` when you want
to replace the editor's live layout with a preset. Render outputs and thumbnails
are intentionally not committed. Preset `thumbnail` fields are currently `null`;
thumbnail generation is deferred to a later slice.

## Render a shot package

`bt render --shot <shot_id>` writes stable AI-video handoff frames under
`renders/shots/<shot_id>/`. Plain layouts produce `first.png`; schema-v3 layouts
with keyframes produce `first.png` from pose A and `last.png` from pose B.

```sh
python3 scripts/bt.py render layouts/starship_shrine_spaceport.layout.json \
  --shot shrine_push_in --width 640 --height 360 --samples 32 \
  --prompt "A slow push-in on a shrine-like starship launch pad" \
  --negative "low quality, flicker" --duration-s 5 --model-hint seedance
python3 scripts/bt.py validate renders/shots/shrine_push_in/shot.json
```

The package contract is versioned in `schemas/shot.schema.json`. `shot.json`
contains prompt, negative prompt, duration, target FPS, model hint, optional
subject/motion/seed fields, source layout paths, frame paths, and the Blender
render receipts folded into `render_metadata`.

## Validate contracts

```sh
python3 scripts/bt.py validate layouts/live.layout.json
python3 scripts/bt.py validate assets/manifest.json --json
python3 scripts/bt.py validate assets/manifest.json --check-proxies --json
python3 scripts/check_lighting_presets.py
```

Validation errors use JSON-pointer-style paths such as
`/instances/3/quaternion: expected 4 numbers`.
The lighting preset check compares the browser editor presets against the CLI
presets so calibration changes cannot silently drift.
Default manifest validation checks the contract only. Add `--check-proxies` when
you specifically want preview-readiness to fail on missing browser GLBs; rebuild
missing proxies with the manifest bootstrap command above.

## Author from the CLI

`scripts/bt.py` can build and render a layout without the browser:

```sh
python3 scripts/bt.py layout new cli_demo --layout layouts/cli_demo.layout.json
python3 scripts/bt.py assets
python3 scripts/bt.py place bone_broken --layout layouts/cli_demo.layout.json --at 0 0 0
python3 scripts/bt.py camera frame bone_broken_001 --layout layouts/cli_demo.layout.json
python3 scripts/bt.py light preset studio --layout layouts/cli_demo.layout.json
python3 scripts/bt.py preset list
python3 scripts/bt.py preset copy cave_octopus_relic --layout layouts/cave_octopus_relic.layout.json
python3 scripts/bt.py validate layouts/cli_demo.layout.json
python3 scripts/bt.py inspect layouts/cli_demo.layout.json --json
python3 scripts/bt.py render layouts/cli_demo.layout.json --width 640 --height 360 --samples 32 --json
```

Most commands accept `--json`; contract errors exit 2 and render failures exit 3.
`bt assets --json` includes agent-readable `category`, `size_class`,
`starter_scale`, and `health_labels` fields derived from manifest metadata when
explicit labels are absent. The editor exposes the same labels in asset rows and
stable `data-asset-*` attributes for automation.

`bt place` uses the manifest/default drop scale when `--scale` is omitted; pass
`--scale` to override it.

For a small preset sanity pass without writing render artifacts, apply a preset
to a throwaway layout and inspect it:

```sh
python3 scripts/bt.py layout new preset_sanity --layout /tmp/preset_sanity.layout.json
python3 scripts/bt.py light preset golden_hour --layout /tmp/preset_sanity.layout.json
python3 scripts/bt.py inspect /tmp/preset_sanity.layout.json
```

## Diagnose missing source textures

Material image links live inside the source `.blend` files, so texture diagnostics
run through Blender:

```sh
python3 scripts/bt.py textures --asset medieval_prop_crate --json
python3 scripts/bt.py textures --asset medieval_prop_crate --relink --json
```

By default the relink search uses existing repo texture folders and
`~/asset-menagerie` when present. Add `--texture-root /path/to/textures` or set
`BT_TEXTURE_ROOTS` with path-separated roots for other source packs. `--relink`
rewrites missing image paths in memory for diagnostics/export/render; add
`--save` only when you intentionally want to update the source `.blend` files.
Proxy export and render receipts include missing/relinked texture counts.
