# Styled scalp root field receipt

Issue: [#130](https://github.com/BenKnill/blender-threejs-bakes/issues/130)

## Deterministic mechanical A/B

Command: `just hair-root-field-ab`

Shared fixture: 256 guides, 12 segments, 15 render fibers per guide, 330 fixed
steps, six solver iterations, rotating wind, two-pass comb, and diagonal cut.

| Root field | Digest | Peak stretch | Final stretch | Mean Node wall / step | Target tangent mean | Target outward min |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| free | `dd791225524a0f51` | 3.499% | 3.218% | 12.45 ms | 0.260 | 0.959 |
| scalp normal | `0d93d57e76ac1757` | 3.489% | 2.545% | 10.13 ms | 0.260 | 0.959 |
| styled side part | `e63a053332f3b265` | 3.499% | 3.044% | 10.23 ms | 0.820 | 0.462 |

The styled lane repeated with the same digest and full receipt. Node wall time
is a one-process observation, not a portable benchmark.

## Narrow browser gate

Viewport: 560×720. Render: 256 guides × 15 fat-line fibers with deterministic
two-parent section interpolation. Binding digest: `74bfb34c`.

The completed styled showcase observed:

- 3.03% current stretch with the runtime assumption gate satisfied;
- 23.21 ms solver time and 43 displayed fps;
- 0.50 ms geometry p99 and 1.70 ms maximum over 518 measured frames;
- 0.964 / 0.991 minimum / mean first-segment field alignment;
- 0.462 minimum baked target outward dot and 0.820 mean target tangential
  magnitude; and
- a visible side part and lateral sweep after all 256 guides participated in
  the diagonal cut.

The same-camera scalp-normal recipe observed 2.56% stretch, 22.47 ms solver
time, 0.60 ms geometry p99, and the expected smoother cap-like silhouette.
Browser timings and pixels are observations, not deterministic replay claims.

## Proof boundary

`HAIR_STYLED_ROOT_FIELD_RETAINS_OUTWARD_COMPONENT` proves the exact real-vector
identity for a unit normal plus orthogonal tangent. A warm OrbStack/CRIU `light`
full-source replay succeeded in 0.6 seconds after reusing the live shelf. This
is warm development evidence. JavaScript tests separately cover normalization,
mode identity, finite-field outward telemetry, deterministic replay, and the
stretch gate.
