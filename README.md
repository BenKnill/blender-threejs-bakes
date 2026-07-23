# Blender ⇄ Three.js Bakes

Static Three.js blocking editor plus Blender scripts for final Cycles renders from
original `.blend` assets.

For agent-facing operating notes, see [AGENTS.md](AGENTS.md).
For the stable physics/render boundary and deliberate non-claims, see
[the integration handoff](docs/INTEGRATION_HANDOFF.md).

Canonical Hair Material Bench:
[hair-material-bench.pages.dev](https://hair-material-bench.pages.dev/).

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

## Bake a Box3D motion clip

The first native-physics slice compiles a readable scene into Box3D, records and
replays the simulation, then uses Blender to render the sampled transforms. The
scene, simulation, and render cadence are separate JSON contracts; Blender does
not re-simulate the motion.

```sh
BOX3D_SOURCE_DIR=/Users/boxer/box3d bash scripts/build_basic_animation.sh
```

This produces a crate-drop MP4, a Blender render receipt, a sampled
`motion-clip/1`, and a native event receipt under gitignored `renders/` and
`physics/outputs/`. See [the Box3D animation guide](docs/BOX3D_ANIMATION.md)
for the exact boundary and deliberate first-pass limits.

For an articulated example, `just box3d-tree` compiles a six-body SeedThree
tree with five revolute joints, validates coincident world anchors and aligned
hinge axes, replay-validates the native simulation, and bakes the sampled motion.
The source tree payload is intentionally local and currently lives under
`/Users/boxer/blender-threejs-bakes/assets/`; see
[the tree assembly guide](docs/SEEDTHREE_TREE_ASSEMBLY.md) for its visual-only
deformation boundary. Override the Box3D checkout with `BOX3D_SOURCE_DIR`.

`just reduced-tree` runs the smaller three-coordinate sway/fall visual model.
Its receipt explicitly records that it is broad inspiration from
arXiv:2506.06494, not FEM, JGS2, material-aware local subspaces, or Cubature.
See [the reduced-tree note](docs/REDUCED_TREE_ELASTODYNAMICS.md).

`just chain-lab` runs the numerical "Globally Aware Tether Chain" experiment:
Jacobi, red-black Gauss-Seidel, finite-hop response, exact local Schur windows,
and a dense oracle on one idealized quadratic, plus a separate observational
Box3D distance-joint trace. It produces deterministic CSV, JSON, and SVG
artifacts without Blender. See [the chain-lab note](docs/JGS2_COMPLIANCE_LAB.md).

The bounded [Box3D contact-shell lab](docs/BOX3D_CONTACT_SHELL.md) isolates the
actual normal-clamp, softness, speculative-bias, and friction-projection algebra
from whole-world physics claims. It pairs exact-real HOL development claims with
public-API Box3D probes and deliberately does not modify the production solver.

Before opening a change, run the local review gate:

```sh
just lint
just test
git diff --check
```

## Place compute effect cards

The repo includes portable compute-effect placeholders for final Blender renders.
They are ordinary layout instances with `effect_id` instead of `asset_id`, so the
browser editor and CLI can move, rotate, scale, save, inspect, and validate them
without depending on a Windows-only CUDA shader source tree. Blender renders them
as transparent card geometry, so they still participate in scene depth instead of
being pasted on top of the final image.

```sh
python3 scripts/bt.py effects
python3 scripts/bt.py layout new cuda_demo --layout layouts/cuda_demo.layout.json
python3 scripts/bt.py place-effect cuda_flame \
  --layout layouts/cuda_demo.layout.json --at 0 0 1 --scale 2 2 2
python3 scripts/bt.py render layouts/cuda_demo.layout.json \
  --width 1280 --height 720 --samples 64
```

Use `bt animate-effects` when a layout contains animated effect cards. It renders
numbered PNG frames, writes per-frame receipts, encodes a high-quality
`preview.mp4` with ffmpeg/libx264, and also writes a small `preview.gif` for
quick inline checks when ImageMagick is available.

```sh
python3 scripts/bt.py animate-effects \
  layouts/starship_cuda_three_nozzle_flames.layout.json \
  --animation-id starship-plume-demo --frames 24 --fps 12 \
  --width 1280 --height 720 --samples 64 --json
```

`preview.mp4` is the preferred review artifact; use `--video-crf` and
`--video-preset` to tune ffmpeg quality/speed. The GIF is only a convenience
preview because GIF quantization throws away color and motion detail.

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
