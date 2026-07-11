# Interactive hair material bench

Issues: [#79](https://github.com/BenKnill/blender-threejs-bakes/issues/79),
[#86](https://github.com/BenKnill/blender-threejs-bakes/issues/86)

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

The pair correction, anisotropic exchange, clump-envelope ordering, and crowd
pressure have deliberately narrow componentwise HOL Light theorems at
`physics/labs/hair_material/proofs/pair_constraint.ml`.

```sh
hol-workbench/bin/prove \
  "$PWD/physics/labs/hair_material/proofs/pair_constraint.ml" \
  --profile light --run-root /tmp/hair-material-hol-runs
```

On the primary Mac this routed automatically through the live OrbStack CRIU
`light` shelf. Restore/reuse took 0.000 seconds and the warm semantic attempt
covering both theorems succeeded in 0.3 seconds. This is warm development
evidence, not a cold audit or a proof that the JavaScript implementation refines
the HOL statements.

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

## Claim boundary

This is a material-aware graphics solver, not continuum hair mechanics or a
validated predictor of an individual's haircut. It has scalp collision and a
bounded anisotropic-friction, hysteretic-clump, and crowd-pressure approximation,
but no general strand self-contact, torsional frame, comb teeth, detached
cut-hair dynamics, or calibrated moisture chemistry. Nine visible fibers share
each guide's mechanical state. The HOL theorems cover scalar conservation and
threshold-ordering rules only.
