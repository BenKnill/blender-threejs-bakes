# Three-parent cut donor fade receipt

Issue: [#134](https://github.com/BenKnill/blender-threejs-bakes/issues/134)

## Contract

- Owner and primary parent continue to define visible fiber length. This keeps
  the established two-parent cut ownership and primitive count.
- The third parent is a volume-only shape donor. If it is shorter than the
  visible fiber, its influence smoothsteps to zero over the two segments before
  its active cut and remains zero at and beyond that boundary.
- Two-parent binding digest `74bfb34c` and three-parent binding digest
  `0be410f0` remain unchanged.
- The rule changes render reconstruction only. It does not alter mechanical
  guides, cut topology, or solver scheduling.

## Fixed 560x720 browser gates

Shared fixture: 256 guides, 12 segments, 15 fat-line fibers per guide, styled
side-part root field, rotating wind, deterministic two-pass comb, and diagonal
cut. `autoplay=0` holds the exact requested replay step.

| Step | Rule | Physics digest | Position-buffer digest | Active primitives |
| ---: | --- | --- | --- | ---: |
| 150, before cut | merged three-parent baseline | `3c45d9ec1cd8d04b` | `4dda2af6` | 46,080 |
| 150, before cut | secondary donor fade | `3c45d9ec1cd8d04b` | `4dda2af6` | 46,080 |
| 330, after cut | merged shortest-of-three | `18079d1e106a2407` | `d07147b4` | 26,691 |
| 330, after cut | secondary donor fade | `18079d1e106a2407` | `02fa2f01` | 26,884 |
| 330, after cut | two-parent reference | `18079d1e106a2407` | `4d543d1f` | 26,884 |

The pre-cut buffer is byte-identical, so the volume-filling silhouette is not
retuned. After the cut, all 193 primitives lost by the shortest-of-three rule
are restored. The resulting buffer remains distinct from two-parent mode
because surviving third-parent influence still fills the lower silhouette.

## Live timing observation

One autonomous post-cut narrow-preview run collected 600 geometry updates:

- mean: 0.459 ms
- p99: 0.60 ms
- max: 0.70 ms

These timings and pixels are single-browser observations. Fixed physics and
buffer digests are the semantic receipts. No HOL claim is introduced because
the change is a render reconstruction/cut-ownership rule covered directly by
executable tests.

## Commands

- `just hair-volume-showcase`
- `just lint`
- `just test`
