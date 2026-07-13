# Hydrated wind-response receipt

Issue: [#165](https://github.com/BenKnill/blender-threejs-bakes/issues/165)

## Diagnosis

The canonical solver was not frozen. During the hydrated phase, guide tips move
approximately 5-11 cm RMS over 15-30 frame windows, with individual particles
moving farther. The apparent freeze came from the renderer: the 5,376 short
scalp-coverage locks introduced by #164 read fixed roots and the baked style
field, so their endpoint motion was exactly zero while the mechanical guides
moved underneath them.

## Live hydration field

`live_root_cover_locks_catmull_rom_v3` blends each short coverage lock from:

- 86% of the current interpolated particle-7 shaft tangent;
- 14% of the authored side-part root direction.

The result stays rooted on the analytic scalp shell and retains the existing
positive outward arc. A 0.34 minimum dot with the authored direction bounds the
live field to approximately 70 degrees from the groom and prevents root-flow
reversal. It reads current solver positions but cannot write solver state.

Across the canonical 256-guide x 21-fiber fixture from fixed replay step 270 to
285, the 5,376 coverage endpoints change by:

- 4.61 mm RMS;
- 0.28 mm median;
- 8.86 mm p95;
- 34.68 mm maximum.

The previous baked-only coverage field reports exactly zero endpoint motion for
the same interval. The long simulated guide tips already move 69.0 mm RMS over
that interval; this slice exposes part of that motion in the dense scalp layer
rather than inventing a new wind force.

## Verification and boundary

`just lint`, `just test`, and the Pages bundle test pass. The deterministic
solver is unchanged; its existing styled-root digest and stretch receipts
remain the mechanics authority. Browser geometry cost and visual acceptance
remain live-preview observations rather than portable claims.
