# Dev tasks. Run `just` to list. Hooks (lefthook) run lint/format on commit automatically;
# these recipes are for running things by hand on the whole tree.

# ruff isn't required on PATH — fall back to `uvx ruff` (uv is available).
ruff := `command -v ruff >/dev/null 2>&1 && echo ruff || echo "uvx ruff"`

# List recipes
default:
    @just --list

# Lint everything (no changes) — JS + Python
lint:
    npx eslint editor physics/labs/contact_shell/demo/main.js physics/labs/hair_material/demo/*.js scripts/test_hair_material_solver.mjs scripts/run_hair_operator_ab.mjs scripts/run_hair_comb_benchmark.mjs
    npx prettier --check 'editor/**/*.{js,css,html}' 'physics/labs/contact_shell/demo/**/*.{js,css,html,json}' 'physics/labs/hair_material/demo/**/*.{js,css,html}'
    {{ruff}} check scripts

# Dependency-light compiler contracts for the Box3D scene bridge.
test:
    python3 scripts/test_scene_compile.py
    python3 scripts/test_compile_physics.py
    python3 scripts/test_compile_tree_assembly.py
    python3 scripts/test_bake_telemetry.py
    python3 scripts/test_wind_canopy_math.py
    python3 scripts/test_haircut_math.py
    node scripts/test_hair_material_solver.mjs
    python3 scripts/test_contact_shell_demo.py

# Native Box3D crate proof: compile, replay-validate, and bake 97 frames.
box3d-basic:
    bash scripts/build_basic_animation.sh

# Articulated SeedThree tree: validate joint frames, simulate, and bake.
box3d-tree:
    bash scripts/build_tree_assembly_animation.sh

# Broadly paper-inspired visual reduced coordinates; explicitly not FEM/JGS2.
reduced-tree:
    bash scripts/build_reduced_tree_animation.sh

# Compare local/colored/compliance-aware updates on a stiff axial chain.
chain-lab:
    bash scripts/build_chain_lab.sh

# Small native-Box3D spring lattice with twist, gravity, and floor contact.
soft-ribbon:
    bash scripts/build_soft_ribbon.sh

# Render the soft-ribbon motion as a neon Eevee animation.
soft-ribbon-video: soft-ribbon
    bash scripts/render_soft_ribbon_animation.sh

# Prove and probe the bounded Box3D contact-update shell.
contact-shell:
    bash scripts/build_contact_shell.sh

# Branching and hanging-fiber proxies in a traveling Box3D wind field.
wind-garden:
    bash scripts/build_wind_garden.sh

# Render the recorded wind-garden trajectory in Eevee.
wind-garden-video: wind-garden
    bash scripts/render_wind_garden_animation.sh

# Real SeedThree canopy plus a 127-fiber groom driven by Box3D wind guides.
seedthree-wind: wind-garden
    bash scripts/build_seedthree_wind_canopy.sh

# Dense mannequin groom and a primitive shoulder-length-to-bob cut.
mannequin-haircut: wind-garden
    bash scripts/build_mannequin_haircut.sh

# Start the editor server and print the interactive hair-material lab URL.
hair-material:
    ./scripts/serve.sh start
    @echo "http://127.0.0.1:8091/physics/labs/hair_material/demo/"

# Package hair frames, then prune source frames and non-selected scenario clips.
hair-phase-videos output_root:
    bash scripts/package_hair_phase_space_videos.sh {{output_root}}

# Replay the exact operator ON/OFF scenario and print stable state digests.
hair-replay:
    node scripts/run_hair_operator_ab.mjs

# Run the deterministic 256-guide dry/wet comb-through instrument.
hair-comb-benchmark:
    node scripts/run_hair_comb_benchmark.mjs

# Format everything in place — JS + Python
format:
    npx prettier --write 'editor/**/*.{js,css,html}' 'physics/labs/contact_shell/demo/**/*.{js,css,html,json}' 'physics/labs/hair_material/demo/**/*.{js,css,html}'
    {{ruff}} format scripts

# Install / refresh git hooks
hooks:
    lefthook install

# Editor server (launchd-managed on :8091): start | stop | restart | status
serve action="start":
    ./scripts/serve.sh {{action}}

# Blender round-trip smoke test — proves the bake contract (CONVENTIONS 5.1)
smoke:
    ./scripts/blender.sh --background --python scripts/smoke_roundtrip.py

# Render a layout in Blender: `just render layouts/live.layout.json`
render layout:
    ./scripts/blender.sh --background --python scripts/render_layout.py -- {{layout}}

# Non-interactive control surface: `just bt validate layouts/live.layout.json`
bt *args:
    python3 scripts/bt.py {{args}}
