# Interactive hair material bench

Issue: [#79](https://github.com/BenKnill/blender-threejs-bakes/issues/79)

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
6. relative-velocity friction over a deterministic three-neighbor root graph;
7. capped equal-and-opposite cohesion over close matched particles;
8. final distance passes so telemetry describes the rendered state.

Wetness increases drag and clumping while reducing bend recovery. Product
increases bend recovery, damping, friction, and clumping. These mappings are
deliberately qualitative; they make material controls mechanical rather than
shader-only, but are not calibrated to real tresses. Wetness and product are
composed from the selected preset, so changing either control no longer erases
the other.

The dependency-light numerical suite checks:

- mass-weighted pair-correction conservation;
- equal-mass friction conservation and reduction of relative velocity;
- equal-and-opposite capped cohesion correction;
- strict reduction of a stretched pair's length residual;
- root pinning over 180 frames;
- bounded relative stretch after dynamics;
- irreversible cut topology;
- distinct rest spans for the four presets.

```sh
node scripts/test_hair_material_solver.mjs
```

## HOL Light Workbench lane

The inverse-mass pair correction and equal-mass friction blend have deliberately
narrow componentwise HOL Light theorems at
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

These are interactive observations on the primary M5 Mac, not a portable
benchmark. The tracked compact receipt is
`docs/receipts/hair_material_bench.json`.

## Claim boundary

This is a material-aware graphics solver, not continuum hair mechanics or a
validated predictor of an individual's haircut. It has scalp collision and a
bounded root-neighbor friction/cohesion approximation, but no general strand
self-contact, torsional frame, comb teeth, detached cut-hair dynamics, or
calibrated moisture chemistry. Nine visible fibers share each guide's mechanical
state. The HOL theorems cover the algebraic conservation laws only.
