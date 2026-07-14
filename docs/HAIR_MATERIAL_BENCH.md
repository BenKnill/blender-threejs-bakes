# Interactive hair material bench

Issues: [#79](https://github.com/BenKnill/blender-threejs-bakes/issues/79),
[#86](https://github.com/BenKnill/blender-threejs-bakes/issues/86),
[#130](https://github.com/BenKnill/blender-threejs-bakes/issues/130),
[#132](https://github.com/BenKnill/blender-threejs-bakes/issues/132),
[#175](https://github.com/BenKnill/blender-threejs-bakes/issues/175)

This laboratory is the first interactive step beyond the rendered mannequin
cut. Its editable mode runs hundreds of 3D mechanical guides in the browser.
The canonical hands-off reel now plays a recorded 256-guide native Box3D scalp
fixture and hydrates those mechanics into the same dense browser material.

The canonical refreshable front door is
[hair-material-bench.pages.dev](https://hair-material-bench.pages.dev/). With
no query string it enters the current hands-off rod-to-hydrated-hair loop. Use
`?lab=1` to keep the full control panel instead. The exact deployed commit is
reported by [`/build.json`](https://hair-material-bench.pages.dev/build.json).

```sh
just hair-material
```

Then open:

```text
http://127.0.0.1:8091/physics/labs/hair_material/demo/
```

The localhost server is only a development surface. The production payload is
self-contained and can be rebuilt and direct-uploaded with:

```sh
just hair-pages-build
just hair-pages-deploy
```

The packager copies only the demo, its realistic-head asset, and the three
required vendored Three.js modules. Repository-scoped Cloudflare credentials
are not configured in GitHub, so this is currently an authenticated local
direct upload rather than an automatic deployment workflow.

The browser-solver lab default uses 512 guides, 12 segments per guide, five constraint
iterations, and 4,608 visible fibers. Controls expose four deterministic rest-
shape/material families, guide count, solver iterations, wetness, product,
section elevation, and wind. The scissors brush cuts strands under the pointer;
the guide-line button applies a reproducible horizontal cut.

## Mechanics

`solver.js` uses Verlet integration followed by:

1. pairwise distance projection;
2. rest-second-difference projection as a compact curvature approximation;
3. a temporary section-elevation constraint;
4. ellipsoidal scalp collision;
5. root pinning;
6. anisotropic relative-velocity friction over a deterministic three-neighbor
   root graph;
7. capture/release hysteresis for persistent clump bonds;
8. capped equal-and-opposite cohesion for bonded particles;
9. equal-and-opposite crowd pressure below a minimum pore gap;
10. final distance passes so telemetry describes the rendered state.

## Scalp root fields

The root constraint has three explicit identities: `free`, `scalp_normal`, and
`styled_side_part`. All modes use the deterministic `face_hairline_ellipsoid_v1`
root layout: its central frontal polar reach is shallower than the old uniform
73-degree cap, while side and rear coverage remains deeper. Roots sit 45 mm
outside the analytic collision ellipsoid so they are visible on the realistic
mannequin instead of emerging through it. The styled field divides the scalp
azimuth into eight sections, separates a narrow left side part, sends crown
roots backward, and sends frontal roots laterally while preserving positive
outward growth.

Use `rootField=styled-side-part` in a demo URL or select **Styled side part +
sweep** in the panel. The legacy `rootDirector=1` query still resolves to
`scalp_normal`. Receipts identify the exact field, section count, part location,
target outward dot, target tangential magnitude, actual normal alignment, and
actual field alignment.

Styled mode also enables `front_midshaft_rest_projection_v1`. It constrains 64
front-center guides outside a 0.58 m cheek half-width and behind the analytic
`z=0.24 m` face plane over 22-68% of their length. `faceClear=0` is the explicit
A/B opt-out. This is an authored face-volume proxy, not mesh collision.

`just hair-root-field-ab` runs free, scalp-normal, and styled modes through one
330-step cut/comb/rotating-wind replay. `just hair-styled-showcase` prints the
dense 256-guide × 15-fiber hands-off narrow-preview URL.

## Dense groom interpolation

The **Hair display** selector exposes mechanical lines, dense radial copies,
the established section-local two-parent interpolation, and an opt-in
three-parent volume mode. URL fixtures use `groomSections=1` for two parents or
`groomVolume=1` for three parents. Both modes bake immutable bindings from the
rest roots and include their binding digest in `hair-render/1` receipts.

The volume mode chooses two distinct nearby secondary guides, keeps all weights
convex, and fades the third parent's influence in from 45% to 90% of strand
length. This keeps the styled root part driven by the owner/primary pair while
breaking up repeated line sheets lower in the silhouette. After cuts, the owner
and primary parent define the visible fiber length. The third parent is a
volume-only shape donor: when it is shorter, its influence fades smoothly to
zero over the two segments before its cut and stays zero beyond that boundary.

At the fixed 256-guide × 15-fiber step-150 A/B, both modes report physics digest
`3c45d9ec1cd8d04b`; the two-parent binding/buffer digests are
`74bfb34c` / `49d77d60`, while the three-parent digests are
`0be410f0` / `4dda2af6`. Geometry p99 was 0.90 ms for both observations. At
step 330 after the diagonal cut, both modes report physics digest
`18079d1e106a2407`. The original shortest-of-three rule emitted 26,691
primitives versus 26,884 for two parents. The cut-aware donor fade now emits the
same 26,884 primitives as two-parent mode while preserving binding digest
`0be410f0`; its post-cut position-buffer digest is `02fa2f01`. A 600-frame live
sample observed 0.459 ms mean / 0.60 ms p99 / 0.70 ms max geometry update. The
mode remains opt-in because this is a bounded reconstruction improvement, not a
claim that three-parent interpolation improves every hairstyle.

Add `autoplay=0` to a `showcase=1` replay URL to hold the requested
`replaySteps` state for a fixed narrow-preview comparison.

## Section lift cycle

The existing **Section elevation** slider remains a static authored constraint.
For a deterministic hands-off experiment, add `liftCycle=1`; `liftPeak` controls
the bounded peak in meters and defaults to 0.24. The replay rises from steps
30–90, holds through step 154, releases through step 229, and stays off before
the diagonal cut. `just hair-lift-showcase` prints this styled three-parent URL,
while `just hair-section-lift-ab` runs the 256-guide acceptance gate.

The lift uses 0.18 total step stiffness distributed across the configured
solver iterations, rather than applying 0.18 in every iteration. At six
iterations the per-iteration blend is 0.03253. Receipts report phase, target,
correction count, and summed correction-distance proxy; that distance is not
calibrated work or force.

The fixed 420-step treatment repeats at digest `4c7b4af505e0e011`, completes all
256 cuts, and peaks at 3.499% stretch inside the comb-cycle measurement window.
The held / released / post-cut render-buffer digests are `5f0a9ab9`, `0e2a4e2e`,
and `faec1a23`. A live active-phase observation reported 14.95 ms smoothed solver
cost and 2.4 / 3.2 ms geometry p99 / max, so the choreography remains opt-in.

## Artist-directed section pose

The first Tonic-like control primitive selects one of the same eight scalp
sections used by dense groom interpolation, then poses a three-point mid-shaft
tube with lift plus signed scalp-tangential sweep. The remaining strand shape
continues through the material solve, and dense two- or three-parent fibers
inherit the guide motion. This is a sparse-control capability milestone, not a
production grooming or Disney parity claim.

Use the **Section pose**, **Pose lift**, and **Pose sweep** controls for a static
pose. The hands-off replay uses `poseCycle=1`; `poseSection`, `poseLift`, and
`poseSweep` default to section 7, 0.32 m, and +0.34 m. This side-section
orientation was selected in a narrow browser A/B because the original section
6 / negative-sweep recipe pulled a front lock across the face. `just
hair-section-pose-showcase` prints the dense autonomous recipe and `just
hair-section-pose-ab` runs the fixed 256-guide acceptance gate.

The pose applies 0.12 total step stiffness across three weighted control points
at 36%, 50%, and 64% strand length, distributed over solver iterations. At six
iterations the per-iteration blend is 0.02108. The 420-step replay selects 35
guides, repeats at digest `e72b5a6c17a20c57`, completes all 256 cuts, and peaks
at 3.4982% stretch. The unchanged disabled baseline remains
`6a0294d4bf085310`. Receipts expose field identity, phase, section, guide counts,
targets, stiffness, corrections, and summed correction-distance proxy.

## Anisotropic-fluid rules

The solver now treats the groom as a directed porous fluid through four compact
rules rather than as a bag of identical springs:

1. **Comb channels.** The local average strand tangent is a low-viscosity
   direction. Neighboring particles lose transverse relative velocity much
   faster than axial slip, so locks may flow lengthwise without freely shearing
   sideways.
2. **Clumps remember.** A pair captures inside a small radius and releases only
   outside a larger one. The interval between those radii is a memory band:
   previous contact, not distance alone, decides the state.
3. **Hair keeps pore space.** Below a minimum gap, cohesion gives way to a
   symmetric pressure correction. This is a local volume surrogate that stops
   wet/product-heavy hair from collapsing into a single numerical sheet.
4. **Internal bargains do not kick the head.** Directional drag, attraction,
   and pressure exchange equal-and-opposite corrections. They may dissipate
   relative motion but do not create pair translation.

These are creative reduced-order constitutive rules. They are motivated by the
directionality, entanglement, and porous bulk of real hair, but they have not
been fitted to measured fibers or derived from a continuum discretization.

Wetness increases drag and clumping while reducing bend recovery. Product
increases bend recovery, damping, friction, and clumping. These mappings are
deliberately qualitative; they make material controls mechanical rather than
shader-only, but are not calibrated to real tresses. Wetness and product are
composed from the selected preset, so changing either control no longer erases
the other.

The dependency-light numerical suite checks:

- mass-weighted pair-correction conservation;
- equal-mass friction conservation and reduction of relative velocity;
- anisotropic friction conservation with stronger transverse damping;
- hysteretic capture/hold/release behavior;
- equal-and-opposite capped cohesion correction;
- equal-and-opposite short-range crowd pressure;
- strict reduction of a stretched pair's length residual;
- root pinning over 180 frames;
- bounded relative stretch after dynamics;
- irreversible cut topology;
- distinct rest spans for the four presets.

```sh
node scripts/test_hair_material_solver.mjs
```

## HOL Light Workbench lane

The pair correction, anisotropic exchange, clump-envelope ordering, crowd
pressure, and root-field decomposition have deliberately narrow componentwise HOL Light theorems at
`physics/labs/hair_material/proofs/pair_constraint.ml`.

```sh
hol-workbench/bin/prove \
  "$PWD/physics/labs/hair_material/proofs/pair_constraint.ml" \
  --profile light --run-root /tmp/hair-material-hol-runs
```

On the primary Mac this routes automatically through the live OrbStack CRIU
`light` shelf. The styled-root addition reused the shelf in 0.000 seconds and
the full source succeeded in 0.6 seconds. This is warm development evidence,
not a cold audit or a proof that the JavaScript implementation refines the HOL
statements.

The pressure suite now also pins the production coefficient `0.36 = 9 / 25`.
`HAIR_PRESSURE_STRENGTH_036_PREVENTS_GAP_OVERSHOOT` proves that the symmetric
uncapped update closes 72% of a scalar pore-gap deficit without crossing the
minimum gap. Changing that coefficient now requires changing a theorem rather
than merely refreshing a choreography receipt.

The loop produced useful Workbench feedback: the first failed attempt identified
the incorrect use of `REAL_RING` as a tactic without printing a transcript; later
attempts exposed the bounded residual goal. It also exposed a visibility issue:
`workbench state` reported `light: cold` immediately before `prove` reused an
already-live CRIU shelf. That feedback is tracked in
[hol-light-workbench issue #308](https://github.com/BenKnill/hol-light-workbench/issues/308).

## Observed primary-Mac envelope

An in-app browser exercise of the 512-guide fixture observed:

- 6,656 simulated particles and 4,608 visible fibers;
- 935 root-neighbor pairs and approximately 10,000 close particle contacts;
- approximately 7.6--9.2 ms per solver step and 104--120 displayed frames/s;
- 2.08% maximum relative segment stretch in the default dry fixture;
- approximately 13--16 MiB reported JavaScript heap;
- composable 65% wetness plus 55% product controls; and
- a successful guide-line cut across 395 mechanical strands.

After adding the anisotropic-fluid rules, the same default fixture observed
approximately 4,770 persistent dry clump bonds, 2,495 active cohesion moves,
13.5 ms solver time, and 73 displayed frames/s. Raising both wetness and product
to 70% increased the persistent bond population to approximately 5,078 while
remaining interactive at approximately 72 displayed frames/s. The pressure rule
is intentionally dormant unless a pair crosses the minimum pore gap; zero is a
valid steady-state reading, not evidence that the rule was omitted. A separate
fresh-start exercise observed both bond capture and release in live telemetry.

These are interactive observations on the primary M5 Mac, not a portable
benchmark. The tracked compact receipt is
`docs/receipts/hair_material_bench.json`.

The styled-root narrow gate uses a 560×720 viewport, 256 guides, 15 fat-line
fibers per guide, section-local two-parent interpolation, rotating wind, a
two-pass comb, and the diagonal cut. After the choreography completed, one
browser observation reported 3.03% stretch, 43 fps, 23.21 ms solver time, and
0.50 ms p99 / 1.70 ms maximum geometry update over 518 measured frames. The
same recipe's scalp-normal observation formed a smooth cap over the face; the
styled field retained a visible part and lateral sweep. These are visual and
single-run performance observations, not a pixel-identical or portable A/B.

The opt-in `controlTube=1` presentation makes the artist control separate from
the final material. It renders the selected section's mean guide as a
semi-transparent cyan tube, begins with thin cyan proxy fibers, hydrates those
fibers to their full groom color and width, and then dissolves the tube. At
fixed step 90, tube-on and hair-only modes share physics digest
`1b50f30cdfdff721`. One 560×720 browser sample observed 0.10 ms tube-geometry
p99 and 1.20 ms total hair-geometry p99 at 256 guides × 15 fibers. These are
single-browser render costs; the tube has no solver authority.

`groomHydration=1` now begins with an unambiguous reduced mechanical skeleton,
not a dense guide bundle. It deterministically samples 20 of the 256 solver
guides and draws 240 lit cylinder links plus 260 spherical joints in the eight
section colors. Every active rod has a 0.011 m world-space radius and every
active joint, including roots, has a 0.020 m radius. Size does not encode mass,
stiffness, or constraint type. The clean mechanical hold writes depth so
overlapping transparent roots do not accumulate into false large particles.
Dense hair, undercoat, and the mean-section volume tube are all absent. A cool
key/fill rig lights the rods while the mannequin fades to 32% opacity.

The clean mechanical hold lasts through step 119. Steps 120-209 hydrate the
complete 5,376-fiber material while the rods recede; steps 210-239 release the
last rod overlay; from step 240 only the shaded groom remains. At fixed step 60,
the skeleton and hair-only modes share physics digest `b7a5a62747c250db`.
One 560x720 observation measured the skeleton update at 0.038 ms mean / 0.20 ms
p99 / 0.20 ms maximum over 600 frames. `just hair-groom-hydration-showcase` is
the direct front door, and `just hair-reel-control` uses the same presentation.
The rods and joints read solver positions but have no force, collision, or
state authority. Perspective still produces ordinary projected-size change;
the renderer adds no semantic size variation.

The dense fat-line path now defaults to `hairShade=fiber`, a compact real-time
strand approximation informed by Disney fiber models and TressFX rather than a
2D noise texture. It uses the segment tangent for diffuse response, separates a
neutral primary reflection from a hair-tinted internal-reflection lobe, adds a
small multiple-scattering fill, and varies color deterministically from root to
tip. `hairShade=flat` preserves the diagnostic A/B. At fixed step 90, both modes
share physics digest `1b50f30cdfdff721` and render-position digest `8019ba02`;
both reached the browser's 120 fps ceiling in the 560×720 isolated gate. This
is renderer-only and does not implement full Marschner/Chiang transport, deep
hair shadows, or order-independent transparency.

The reel screenshot pass exposed a more basic coverage failure beneath that
shading model: all dense children shared each mechanical guide root, and every
strand was twelve separately overlapping quads. Fifteen opaque children made
the crown read as rectangular ladders rather than hair. The v2 fiber path keeps
one tapered owner, deterministically fades the other children in over the first
4-27% of strand length, narrows half-width from 0.84 px at the root to 0.07 px
at the tip, softens the analytic cross-section, and balances adjacent segment
endpoints at half coverage. Screenshot review subsequently found that the
replacement hairline cap had inward triangle winding and sat inside the
realistic head. The current cap follows the same frontal hairline as the roots,
faces outward, sits just inside the 45 mm root offset, and uses 62% opacity.
Crown child fibers also emerge earlier than side fibers. This closes the
accidental bald patch without restoring the old forehead helmet.

The hero recipes now use 21 visible fibers per guide, or 5,376 fibers for the
256-guide fixture. At fixed step 90, the physics digest remains
`1b50f30cdfdff721`; the v2 receipt records position/color/start-width/end-width
digests `03bd29bb` / `a6ef84a3` / `b257ebcb` / `06dd4fcf`. One 560x720 browser
sample observed 2.26 ms mean / 2.80 ms p99 / 2.90 ms maximum geometry update.
The screenshot is materially finer and the part is clearer, but it is still
not realistic hair: the hairline cap remains visibly coarse, the 12-segment
topology remains readable at sharp bends, transparency is not order-independent,
and there are no deep opacity/self-shadow maps.

The lock-aware v2 hydration pass fixes a subtler placement error underneath
that appearance. Convex interpolation had placed 5,120 of 5,376 child roots
slightly inside the analytic ellipsoid. Every blended root is now projected
back to the 45 mm scalp shell before rendering. Each mechanical link is split
into two Catmull-Rom spans, and every distributed root adds a deterministic
three-span, nominal 0.24 m coverage lock that follows the styled tangent with
positive outward lift. Three density-broken shadow layers replace the single
cap. The uncut canonical fixture draws 145,152 spans; this is a renderer-only
12.5% primitive increase over the curved solver spans and leaves the physics
digest unchanged. See `docs/receipts/hair_lock_aware_coverage.md` for the
placement audit and claim boundary.

The v3 coverage field also follows live wind deformation. The initial short
coverage locks were rooted correctly but used only the baked style direction,
so they stayed still while the simulated shafts moved. Each coverage direction
now blends 86% of the current interpolated particle-7 tangent with 14% of the
authored root field, bounded to a 0.34 authored-direction dot. In the fixed step
270-285 canonical interval, coverage endpoints move 4.61 mm RMS / 8.86 mm p95
instead of exactly zero; simulated guide tips move 69.0 mm RMS. This exposes
existing mechanics in hydration and does not add wind force, particles, or
constraints. See
`docs/receipts/hair_hydrated_wind_response.md`.

`presentationLoop=1` restores the showcase as an animation. With
`windProgram=strong-then-moderate-orbits`, the deterministic fixture fades in,
finishes its rod-to-hair hydration at step 240, then shows one complete
360-degree strong orbit and one complete 360-degree moderate orbit. Only after
both revolutions does it fade from step 990 and reset at step 1020. The HUD
names the current wind strength and reports revolution progress, so the two-act
sequence remains legible without inferring it from the hair alone. See
`docs/receipts/hair_two_orbit_wind_preview.md`.

The follow-up visual calibration uses strong/moderate solver magnitudes 4.0 and
1.5. The original 0.58/0.29 program advanced correctly but was swallowed by the
dense hydrated groom and therefore read frozen. The corrected fixture moves
guide tips approximately 326-402 mm RMS per settled strong quarter-orbit versus
132-150 mm moderate while remaining below 3.5% post-settle live stretch. See
`docs/receipts/hair_visible_wind_amplitude.md`.

## Native Box3D canonical playback

The no-query canonical page now selects `physicsClip=box3d-scalp-256`. The
source fixture contains 256 scalp-rooted guides, 2,048 dynamic capsules, and
2,048 spherical target-spring joints. Its anisotropic persistent-contact
operator runs natively during capture; the resulting twelve seconds contain
one full 6.0 m/s orbit followed by one full 3.25 m/s orbit. Fixed replay repeats
at digest `5aaf6c2db5806b28`.

The first spherical joint now aligns its cone frame with the capsule long axis,
uses a 6 Hz target spring, and limits root swing to 12 degrees. Across the
settled clip, minimum target alignment is 0.929 and minimum scalp-outward
alignment is 0.231. The maximum settled joint gap is 11.31 mm. The browser
receipt reports those native measurements instead of stale metrics from its
inactive Verlet solver.

For the diagnostic phase, the reel exposes 64 evenly sampled native guides as
512 uniform rods and 576 uniform joints. It then hydrates all 256 guide paths
into 5,376 display fibers. The 181-frame int16 clip is 2,502,144 bytes and is
sampled at 15 Hz; the browser linearly interpolates positions for display. One
local Chrome observation measured the dense 102,144-primitives geometry update
at 23.49 ms mean / 34.90 ms p99 / 44.30 ms maximum, while the instanced rod
subset measured 0.22 ms mean / 0.70 ms p99.

This is recorded native physics, not Box3D/WASM execution. The realistic head
is still a visual plate and not a native collision proxy, so strands can cross
the face during wind. The remaining ribbon-like surface and head/strand contact
are visible next boundaries rather than accepted realism claims. See
`docs/receipts/hair_box3d_scalp_scale_v1.json` and
`docs/HAIR_BOX3D_SWATCH.md`.

## Disney-reference hydration breadth lab

The earlier five-recipe audition was still five bundled points on one ribbon
renderer. The current `groomHydration=1` presentation separates the hierarchy
instead: uniform mechanical rods, one translucent groom volume, owner guides,
clump children, microfiber fill, and a flyaway/frizz layer. It then auditions
twelve deliberately different compositions before returning to the selected
final material for the full six-second strong and six-second moderate native
Box3D wind orbits.

The architecture is informed by Disney's published Frozen pipeline: roughly 50
groom volumes, 100 simulation curves, 1,000 guide curves, and 400,000 render
curves, with scalp clump regions and procedural curl/noise/clumping. Tonic also
describes hierarchical volumes that are procedurally populated with individual
strands. Those ratios are references, not parity claims: this browser study
plays 256 native Box3D guides into 5,376 display fibers.

The final display composition is independently selectable:

- `hydrationGeometry=diagnostic-ribbons|fine-layers|balanced-full|coarse-clusters|wet-locks`
- `hydrationOptical=diagnostic-flat|artist-dual|near-field-proxy|backlit-silk|diffuse-coil|silver-glint`
- `hydrationColor=blueprint|deep-ebony|chestnut|copper|honey-blonde|silver`
- `hydrationDetail=groom-clean|natural-variation|soft-wave|tight-coil|flyaway-frizz|wet-grouped`

That is a 5 × 6 × 6 × 6, or 1,080-composition display space. The optical models
include artist-directed dual highlights and an R/TT/TRT-inspired near-field
proxy. They are compact real-time approximations, not Disney's energy-conserving
production BFSDF or a path-traced multiple-scattering solution. Rest-baked curl,
frizz, and flyaway offsets read the same guide motion and never write physics.

`hydrationRecipe=fine-silk|natural-balanced|coarse-matte|glossy-cinematic|wet-clumped`
remains as a shortcut that sets all four axes. `hydrationTour=0` skips the
twelve-state substitution while retaining the structural hierarchy. Receipts
store both the selected and active compositions under
`full_groom_hydration.breadth_lab`.

The wide-silhouette follow-up adds an independent, renderer-only section
envelope. `groomEnvelope=off|salon-full|cinematic-mass|storybook-volume` selects
an asymmetric eight-section elliptical boundary, and `envelopeScale=0.5..2.5`
scales its world-space radii. Hydrated child fibers receive deterministic
low-discrepancy disk coordinates inside the live section frame; the final
cross-section is projected to normalized radius 1.0. Roots stay exact and the
envelope grows only after the first 3.5% of each guide, preserving the authored
part and hairline. `cinematic-mass` at the canonical 1.25 scale reaches about
0.96 m outward and 0.74 m lateral at its broadest section. This deliberately
changes silhouette volume without writing guide positions or adding a physics
collision boundary.

A second renderer-only projection cuts a front-center aperture through that
volume. Between 10% and 84% of affected front guides, hydrated children are
routed to the nearest side of the part and behind a bounded face plane, then
projected back into the radius-1 section envelope. In the fixed cyan diagnostic
crop, cinematic and storybook profiles add 14.0% and 22.2% mask coverage over
the guide-only baseline after this face clearing. A 20-frame Chrome Canary pass
reported no exceptions or console errors; the final cinematic pass measured
9.74 ms mean geometry update versus 8.64 ms in the envelope-off baseline. This
is a screen-space diagnostic, not a physical area or production-performance
claim. See `docs/receipts/hair_section_envelope_v1.json`.

An exact-time 20-frame Chrome Canary pass observed every named state plus both
wind phases with no JavaScript exceptions or console errors. The cached rest-detail
field measured 8.04 ms mean / 14.50 ms p99 / 20.40 ms maximum over 144 browser
geometry updates at 960x900. The native clip remained trajectory digest
`5aaf6c2db5806b28`; these
are browser display measurements, not new Box3D performance or realism claims.
See `docs/receipts/hair_disney_breadth_lab_v1.json`.

Primary production references:

- <https://disneyanimation.com/publications/disneys-hair-pipeline-crafting-hair-styles-from-design-to-motion/>
- <https://www.disneyanimation.com/technology/tonic/>
- <https://disneyanimation.com/publications/the-art-and-technology-of-simulating-hair-in-disneys-moana/>
- <https://www.disneyanimation.com/publications/hierarchical-workflow-for-art-directed-hair-animation/>
- <https://disneyanimation.com/publications/a-practical-and-controllable-hair-and-fur-model-for-production-path-tracing/>
- <https://la.disneyresearch.com/publication/an-artist-friendly-hair-shading-system/>

## Hero mannequin and reel cameras

The demo can now put that loop on a CC0 Blender Studio realistic head with
`mannequin=realistic`. The tracked GLB contains the head, sclerae, and irises;
the browser applies deliberately simple warm salon materials. It is a visual
plate only. The unchanged analytic ellipsoid still owns every scalp collision,
so switching `mannequin=primitive|realistic` cannot add mesh collision detail or
change the mechanics claim.

`reel=beauty|control|cut` selects a deterministic 1020-step camera field. The
beauty shot makes a restrained orbit, the control shot holds a higher view of
the transient authoring tube, and the cut shot eases closer and lower during
the cut-and-relaxation interval. `reel=free` preserves manual orbit controls.
The render receipt records the mannequin asset identity, CC0 license, collision
authority, named shot, and `fixed_control_two_orbit_1020_step_v3` camera identity.

The three moving front doors are:

```sh
just hair-reel-beauty
just hair-reel-control
just hair-reel-cut
```

They intentionally print looping browser URLs rather than frame directories.
The existing deterministic-frame packaging scripts remain available for final
encoding, but named moving shots are now the source-of-truth compositions for
the upcoming reels.

## Claim boundary

This is a material-aware graphics solver, not continuum hair mechanics or a
validated predictor of an individual's haircut. It has scalp collision and a
bounded anisotropic-friction, hysteretic-clump, and crowd-pressure approximation,
but no general strand self-contact, torsional frame, comb teeth, detached
cut-hair dynamics, or calibrated moisture chemistry. Nine visible fibers share
each guide's mechanical state. The HOL theorems cover scalar conservation and
threshold-ordering rules only.

## Fixed-step replay

`just hair-replay` runs the exact wet, product-heavy diagonal-cut comparison in
Node and prints two 240-step receipts. The browser route accepts `replay=1`,
`replaySteps=N`, and `operators=on|off`; it advances by exact 1/60-second solver
steps and publishes the final digest in the status line. Digests quantize
positions to `1e-6` world units before hashing, which matched Node and the
browser in this exercise. This is semantic trajectory reproducibility, not a
promise of byte-identical pixels across renderers.
