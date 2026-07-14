# Dev tasks. Run `just` to list. Hooks (lefthook) run lint/format on commit automatically;
# these recipes are for running things by hand on the whole tree.

# ruff isn't required on PATH — fall back to `uvx ruff` (uv is available).
ruff := `command -v ruff >/dev/null 2>&1 && echo ruff || echo "uvx ruff"`

# List recipes
default:
    @just --list

# Lint everything (no changes) — JS + Python
lint:
    npx eslint editor physics/labs/contact_shell/demo/main.js physics/labs/hair_material/demo/*.js scripts/build_hair_pages.mjs scripts/export_hair_box3d_clip.mjs scripts/qa_hair_canary.mjs scripts/test_hair_pages_build.mjs scripts/test_hair_material_solver.mjs scripts/run_hair_operator_ab.mjs scripts/run_hair_comb_benchmark.mjs scripts/run_hair_comb_cycle.mjs scripts/run_hair_contact_discovery_ab.mjs scripts/run_hair_contact_churn.mjs scripts/run_hair_face_clear_ab.mjs scripts/run_hair_spatial_friction_ab.mjs scripts/run_hair_rod_reference.mjs scripts/run_hair_spatial_step_benchmark.mjs scripts/run_hair_root_field_ab.mjs scripts/run_hair_section_lift_ab.mjs scripts/run_hair_section_pose_ab.mjs
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
    node scripts/test_hair_pages_build.mjs
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

# Reduced hair-guide swatch with capsule links, spherical springs, and rotating drag.
hair-box3d-swatch:
    bash scripts/build_hair_box3d_swatch.sh

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

# Build the self-contained static Cloudflare Pages payload.
hair-pages-build:
    npm run build:hair-pages

# Deploy the current checkout to the canonical Pages project.
hair-pages-deploy:
    npm run deploy:hair-pages

# Start and print the autonomous narrow-preview rotating-wind showcase.
hair-wind-showcase:
    ./scripts/serve.sh start
    @echo "http://127.0.0.1:8091/physics/labs/hair_material/demo/?replay=1&showcase=1&comb=1&cycle=1&guides=256&iterations=6&wetness=0.85&product=0.2&wind=0.32&gust=0.48&windRotation=0.62&orbit=0.22&scenario=rotating-wind-two-pass"

# Compare free, scalp-normal, and styled roots through the same cut/comb replay.
hair-root-field-ab:
    node scripts/run_hair_root_field_ab.mjs

# Compare the styled groom with and without the bounded front face-clear projection.
hair-face-clear-ab:
    node scripts/run_hair_face_clear_ab.mjs

# Start and print the dense styled-root narrow-preview showcase.
hair-styled-showcase:
    ./scripts/serve.sh start
    @echo "http://127.0.0.1:8091/physics/labs/hair_material/demo/?replay=1&showcase=1&comb=1&cycle=1&cut=diagonal&cutAt=2.8&cutDuration=1.2&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&wind=0.28&gust=0.38&windRotation=0.58&orbit=0.18&hairRender=fatline&fibers=15&groomSections=1&rootField=styled-side-part&rootStrength=0.22&renderReceipt=1&scenario=styled-side-part-cut-comb"

# Start and print the three-parent volume-fill variant of the styled showcase.
hair-volume-showcase:
    ./scripts/serve.sh start
    @echo "http://127.0.0.1:8091/physics/labs/hair_material/demo/?replay=1&showcase=1&comb=1&cycle=1&cut=diagonal&cutAt=5.5&cutDuration=1.2&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&wind=0.28&gust=0.38&windRotation=0.58&orbit=0.18&hairRender=fatline&fibers=15&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&renderReceipt=1&scenario=three-parent-volume-comb-then-cut"

# Start the styled three-parent lift-hold-release showcase.
hair-lift-showcase:
    ./scripts/serve.sh start
    @echo "http://127.0.0.1:8091/physics/labs/hair_material/demo/?replay=1&showcase=1&comb=1&cycle=1&liftCycle=1&liftPeak=0.24&cut=diagonal&cutAt=5.5&cutDuration=1.2&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&wind=0.28&gust=0.38&windRotation=0.58&orbit=0.18&hairRender=fatline&fibers=15&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&renderReceipt=1&scenario=section-lift-hold-release"

# Run the fixed 256-guide lift-cycle acceptance gate.
hair-section-lift-ab:
    node scripts/run_hair_section_lift_ab.mjs

# Start the first artist-directed section pose showcase.
hair-section-pose-showcase:
    ./scripts/serve.sh start
    @echo "http://127.0.0.1:8091/physics/labs/hair_material/demo/?replay=1&showcase=1&comb=1&cycle=1&poseCycle=1&poseSection=7&poseLift=0.32&poseSweep=0.34&cut=diagonal&cutAt=5.5&cutDuration=1.2&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&wind=0.28&gust=0.38&windRotation=0.58&orbit=0.18&hairRender=fatline&fibers=15&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&renderReceipt=1&scenario=section-pose-hold-release"

# Start the transient authoring-tube-to-hydrated-hair presentation.
hair-control-tube-showcase:
    PORT=8199 ./scripts/serve.sh start
    @echo "http://127.0.0.1:8199/physics/labs/hair_material/demo/?replay=1&showcase=1&presentationLoop=1&poseCycle=1&poseSection=7&poseLift=0.32&poseSweep=0.34&controlTube=1&cut=diagonal&cutAt=5.5&cutDuration=1.2&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&windProgram=strong-then-moderate-orbits&strongWind=4&moderateWind=1.5&hairRender=fatline&hairShade=fiber&fibers=21&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&mannequin=realistic&reel=control&renderReceipt=1&scenario=fiber-shaded-looping-hydration"

# Start the globally separated physics-cage-to-dense-hair hydration showcase.
hair-groom-hydration-showcase:
    PORT=8199 ./scripts/serve.sh start
    @echo "http://127.0.0.1:8199/physics/labs/hair_material/demo/?scene=rig-becomes-hair"

# Start the uninterrupted realistic-head beauty orbit for capture or live preview.
hair-reel-beauty:
    PORT=8199 ./scripts/serve.sh start
    @echo "http://127.0.0.1:8199/physics/labs/hair_material/demo/?replay=1&showcase=1&presentationLoop=1&poseCycle=1&poseSection=7&poseLift=0.32&poseSweep=0.34&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&windProgram=strong-then-moderate-orbits&strongWind=4&moderateWind=1.5&hairRender=fatline&hairShade=fiber&fibers=21&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&mannequin=realistic&reel=beauty&renderReceipt=1&scenario=hero-beauty-orbit"

# Start the semi-transparent authoring control-volume shot before hair hydration.
hair-reel-control:
    PORT=8199 ./scripts/serve.sh start
    @echo "http://127.0.0.1:8199/physics/labs/hair_material/demo/?replay=1&showcase=1&presentationLoop=1&poseCycle=1&poseSection=7&poseLift=0.32&poseSweep=0.34&groomHydration=1&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&windProgram=strong-then-moderate-orbits&strongWind=4&moderateWind=1.5&hairRender=fatline&hairShade=fiber&fibers=21&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&mannequin=realistic&reel=control&renderReceipt=1&scenario=hero-physics-cage-hydration"

# Start the hands-off cut-and-relaxation shot with the deterministic reel camera.
hair-reel-cut:
    PORT=8199 ./scripts/serve.sh start
    @echo "http://127.0.0.1:8199/physics/labs/hair_material/demo/?replay=1&showcase=1&presentationLoop=1&poseCycle=1&poseSection=7&poseLift=0.32&poseSweep=0.34&comb=1&cycle=1&cut=diagonal&cutAt=5.5&cutDuration=1.2&guides=256&iterations=6&preset=wavy&wetness=0.35&product=0.45&windProgram=strong-then-moderate-orbits&strongWind=4&moderateWind=1.5&hairRender=fatline&hairShade=fiber&fibers=21&groomVolume=1&rootField=styled-side-part&rootStrength=0.22&mannequin=realistic&reel=cut&renderReceipt=1&scenario=hero-cut-relaxation"

# Run the fixed 256-guide section-pose acceptance gate.
hair-section-pose-ab:
    node scripts/run_hair_section_pose_ab.mjs

# Package hair frames, then prune source frames and non-selected scenario clips.
hair-phase-videos output_root:
    bash scripts/package_hair_phase_space_videos.sh {{output_root}}

# Replay the exact operator ON/OFF scenario and print stable state digests.
hair-replay:
    node scripts/run_hair_operator_ab.mjs

# Run the deterministic 256-guide dry/wet comb-through instrument.
hair-comb-benchmark:
    node scripts/run_hair_comb_benchmark.mjs

# Run the visible wet outward/return comb cycle and hysteresis trace.
hair-comb-cycle:
    node scripts/run_hair_comb_cycle.mjs

# Compare deterministic spatial broadphase candidates with the fixed root graph.
hair-contact-discovery:
    node scripts/run_hair_contact_discovery_ab.mjs

# Measure sparse frame-to-frame churn in the closest-ranked spatial contact set.
hair-contact-churn:
    node scripts/run_hair_contact_churn.mjs

# A/B one closest spatial anisotropic-friction contact per segment.
hair-spatial-friction-ab:
    node scripts/run_hair_spatial_friction_ab.mjs

# Small deterministic guide and pair-operator calibration fixture.
hair-rod-reference:
    node scripts/run_hair_rod_reference.mjs

# Per-step refresh/steady timing and exact digest stream for spatial friction.
hair-spatial-step-benchmark:
    node scripts/run_hair_spatial_step_benchmark.mjs

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
