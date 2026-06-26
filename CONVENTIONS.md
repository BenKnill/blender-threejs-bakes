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
- `asset_id` is the stable join key across GLB proxy ⇄ manifest ⇄ source `.blend`.
  Never reuse or rename an id casually.
- Schemas are documented in `DESIGN.md`. Update it in the same change that alters them.

## 2. File size

- **Soft cap 350 lines per source file** (enforced as an ESLint `warn` for JS).
  `editor/editor.js` is already at ~399 — it should be split *before* it grows further.
  See §6 for the target module layout.
- Hard ceiling 500. A file past that is a design smell, not a style nit.
- Functions: prefer < 40 lines. One job each.

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

## 4. JavaScript (editor)

- **No build step, ever.** The editor is static ESM with a vendored, pinned Three.js
  under `editor/vendor/`. `python3 -m http.server` (or `scripts/serve.sh`) is the whole
  dev server. `package.json` exists for lint/format tooling only — never for a bundler.
- Formatter: **prettier**. Linter: **eslint** (flat config). `npm run lint` / `npm run format`.
- `editor/vendor/` is third-party — never linted, never hand-edited. Upgrade by replacing
  the whole vendored tree and noting the version in the commit.
- Browser globals only; no Node APIs in editor code.

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

## 6. Target front-end module split (do this at the next editor change)

`editor.js` is one 399-line file. Split along seams that already exist in it:

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

## 7. Git hygiene

- Generated/heavy artifacts stay gitignored: `assets/glb/`, `renders/`, `__pycache__/`,
  `node_modules/`. Source-of-truth `.blend` files live outside this repo
  (`/Users/boxer/asset-menagerie/...`) and are referenced by absolute path in the manifest.
- Commit the manifest and layouts (they're small and meaningful), not the binaries they point to.
