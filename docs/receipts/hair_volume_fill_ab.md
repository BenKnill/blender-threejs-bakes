# Three-parent groom volume receipt

Issue: [#132](https://github.com/BenKnill/blender-threejs-bakes/issues/132)

## Contract

- Two-parent bindings remain byte-stable at digest `74bfb34c`.
- Three-parent bindings are rest-baked and repeat at digest `0be410f0`.
- Primary plus secondary neighbor weight is at most 0.36, leaving at least 0.64
  owner weight.
- The secondary parent fades in with a smoothstep from 45% to 90% of active
  strand length.
- A cut display fiber uses the minimum active segment count of every weighted
  parent.

## Fixed browser A/B

Shared fixture: 560×720 viewport, 256 guides, 12 segments, 15 fat-line fibers
per guide, styled side-part root field, rotating wind, and deterministic comb /
cut choreography. `autoplay=0` holds the exact requested replay step.

| Step | Mode | Physics digest | Position-buffer digest | Active primitives | Geometry p99 / max |
| ---: | --- | --- | --- | ---: | ---: |
| 150, before cut | two parent | `3c45d9ec1cd8d04b` | `49d77d60` | 46,080 | 0.90 / 0.90 ms |
| 150, before cut | three parent | `3c45d9ec1cd8d04b` | `4dda2af6` | 46,080 | 0.90 / 1.00 ms |
| 330, after cut | two parent | `18079d1e106a2407` | `4d543d1f` | 26,884 | 0.90 / 1.00 ms |
| 330, after cut | three parent | `18079d1e106a2407` | `d07147b4` | 26,691 | 0.60 / 0.60 ms |

The pre-cut three-parent view breaks up the repeated two-parent sheets and fills
more of the moving silhouette. The post-cut view is slightly rougher because a
third parent can shorten a fiber; it emits 193 fewer primitives, a 0.72%
reduction. Timings and pixels are single-browser observations, while physics
digest equality is the fixed-step semantic check.

## Commands

- `just hair-volume-showcase` prints the autonomous volume-fill preview.
- `just lint`
- `just test`
