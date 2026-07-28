# Conventions — the law for this repo

Set early, on purpose. These are cheap to follow now and expensive to retrofit later.
If a rule here ever fights a real need, change the rule in a PR — don't quietly break it.

## 0. The one architectural invariant

**Coordinate conversion happens in exactly one place: `scripts/render_layout.py`.**

- The editor lives entirely in Three.js space (Y-up). It never thinks about Blender.
- `layout.json` is always `"space": "threejs_yup"`.
- Only the Blender render script applies the Y-up→Z-up basis change, via the single
  `C` matrix defined at the top of that file.

Two conversion sites with slightly different conventions is the #1 way this class of
tool silently breaks. There is one site. Keep it that way. If you need the conversion
elsewhere, extract it to a shared module — do not copy the matrix.

## 1. The JSON contracts are versioned and sacred

`manifest.json` and `*.layout.json` are the API between the three stages.

- Every layout carries `"schema": <int>`. Bump it on any breaking change and handle
  old versions in `render_layout.py` (or reject them loudly).
- Current editor output is schema 2: camera + render + lighting. Schema 3 adds
  keyframe pose data for shot packages. Schema 1 layouts remain accepted by
  `render_layout.py` and use legacy lighting defaults.
- `asset_id` is the stable join key across GLB proxy ⇄ manifest ⇄ source `.blend`.
  Never reuse or rename an id casually.
- Schemas are documented in `DESIGN.md` and `schemas/`. Update both in the same
  change that alters them.

## 2. File size

- **Soft cap 350 lines per source file** (enforced as an ESLint `warn` for JS).
  Treat the warning as a prompt to inspect ownership, callers, and test seams.
- Do not split a file merely to satisfy a line count. Extract a module when it
  has a coherent owner and reduces the number of reasons the original file
  changes.
- Existing oversized Hair Material Bench modules are known consolidation debt,
  not a waiver for adding unrelated behavior to them.
- Functions should usually stay under 40 lines and have one job. Larger
  orchestration functions need named phases or a tested pure helper boundary.

## 3. Python (Blender scripts)

- Formatter + linter: **ruff** (`ruff format`, `ruff check`). Config in `pyproject.toml`.
  Run: `pipx run ruff format scripts && pipx run ruff check scripts` (no venv needed).
- Line length 100, double quotes, py3.11 target (matches Blender's bundled Python).
- Type hints on function signatures (`from __future__ import annotations` is already in use).
- **Separate pure logic from `bpy` side effects.** Coordinate math, slug rules, bbox
  math, and layout parsing should be pure functions with no `bpy`/`mathutils.ops` calls,
  so they can be reasoned about (and ideally tested) without launching Blender. The
  `bpy.ops.*` and `bpy.data.*` mutations stay in thin orchestration functions.
- No bare `bpy.ops.*` where a `bpy.data.*` call is clearer; ops depend on context state
  and are the usual source of headless-mode surprises.

## 4. JavaScript (browser apps and Node harnesses)

- The layout editor is static ESM with a vendored, pinned Three.js under
  `editor/vendor/`. `scripts/serve.sh` is the development server; do not add a
  bundler to the editor.
- The Hair Material Bench is also static ESM. Its supported Pages build copies
  the app and required vendor modules into `dist/`; it does not transpile or
  bundle runtime source.
- `package.json` owns JavaScript quality tooling and the Hair Pages packaging
  commands. A new application build system requires an explicit architecture
  decision rather than an incidental dependency.
- Formatter: **prettier**. Linter: **eslint** (flat config). `npm run lint` / `npm run format`.
- `editor/vendor/` is third-party — never linted, never hand-edited. Upgrade by replacing
  the whole vendored tree and noting the version in the commit.
- Browser code uses browser globals only. Node APIs belong in `scripts/*.mjs`,
  not in `editor/` or browser demo modules.

## 5. Provenance / receipts

Every Blender output writes a sidecar receipt (inputs, samples, asset list, timestamp).
`render_layout.py` already does this for renders — `export_proxies.py` should do the same
for the manifest (record source dir, blender version, per-asset source path + mtime).
Receipts proved their worth in the prior exploration; they're not optional polish.

## 5.1 Round-trip proof before polish

Any change to `scripts/render_layout.py`, transform parenting, camera conversion, or
layout schema must pass the Blender smoke round-trip:

```sh
./scripts/blender.sh --background --python scripts/smoke_roundtrip.py
```

That test exists specifically to catch the silent failure mode where the instance empty
has the right matrix but parented asset roots do not inherit it. Editor screenshots are
not proof of the Blender bake contract.

## 6. Front-end ownership

The layout editor split is implemented. Preserve these owners instead of
rebuilding a single controller:

```
editor/
  main.js          # bootstrap: wire DOM, load manifest, start loop
  scene.js         # renderer, camera, lights, grid/ground, resize, animate
  proxies.js       # loadProxy / cache / placeholder / tint
  instances.js     # add / select / duplicate / delete + the instances Map
  layout-io.js     # currentLayout / objectToInstance / export / restore
  ui.js            # asset palette + instance list rendering
  manifest-loader.js   # (exists)
```

Keep module-level mutable state (the `instances` Map, `selected`) in one owner module
and pass it, rather than scattering globals across files.

The Hair Material Bench has separate solver, rendering, replay, groom, and
contact modules under `physics/labs/hair_material/demo/`. New work should
extend the narrowest existing owner or extract a pure owner with direct tests.
`main.js` is still a mixed integration and presentation owner: it contains
bootstrap, query configuration, groom geometry, shaders, telemetry, and UI
orchestration. Treat those responsibilities as known extraction debt; do not
add another unrelated owner to the file for convenience.

## 7. Git hygiene

- Generated/heavy artifacts normally stay gitignored: `assets/glb/`,
  `renders/`, `__pycache__/`, `node_modules/`. Most source-of-truth `.blend`
  assets live outside this repo and are referenced by the manifest. A
  deliberately self-contained source/proxy pair may be committed under
  `assets/source_blends/` and `assets/glb/` only with provenance and a
  reviewable payload boundary.
- Commit the manifest and layouts (they're small and meaningful), not the binaries they point to.
