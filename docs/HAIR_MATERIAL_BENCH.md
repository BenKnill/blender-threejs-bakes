# Interactive hair material bench

Issues: [#79](https://github.com/BenKnill/blender-threejs-bakes/issues/79),
[#86](https://github.com/BenKnill/blender-threejs-bakes/issues/86),
[#130](https://github.com/BenKnill/blender-threejs-bakes/issues/130),
[#132](https://github.com/BenKnill/blender-threejs-bakes/issues/132)

This laboratory is the first interactive step beyond the rendered mannequin
cut. It runs hundreds of 3D mechanical guides in the browser, couples nearby
guides with bounded friction and cohesion constraints, and interpolates nine
visible fibers from each guide.

```sh
just hair-material
```

Then open:

```text
http://127.0.0.1:8091/physics/labs/hair_material/demo/
```

The default fixture uses 512 guides, 12 segments per guide, five constraint
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
`styled_side_part`. The styled field divides the scalp azimuth into eight
sections, separates roots around a left side part, projects an authored lateral
sweep into each root tangent plane, and adds bounded crown lift. It then mixes
that direction with the original rest direction over the same two-segment root
zone used by the scalp-normal director.

Use `rootField=styled-side-part` in a demo URL or select **Styled side part +
sweep** in the panel. The legacy `rootDirector=1` query still resolves to
`scalp_normal`. Receipts identify the exact field, section count, part location,
target outward dot, target tangential magnitude, actual normal alignment, and
actual field alignment.

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
