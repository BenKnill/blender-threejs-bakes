# Visible wind-amplitude receipt

Issue: [#169](https://github.com/BenKnill/blender-threejs-bakes/issues/169)

## Production diagnosis

The two-orbit production replay introduced by #168 was not paused. Across three
live browser samples, it advanced from step 760 to 808 to 860 at approximately
30 FPS. Wind direction moved from 159 to 207 to 259 degrees, while both the
physics digest and rendered-position digest changed on every sample.

The visual report was nevertheless correct: magnitude 0.58 was labeled
`STRONG`, but the solver applies that value as acceleration multiplied by
`dt * dt` before constraints. The dense, product-bearing groom absorbed the
result into small motion that was easy to miss in the hydrated silhouette.

## Calibration

The deterministic 256-guide, 12-segment, six-iteration fixture compared four
strong/moderate pairs: 1.2/0.5, 1.6/0.65, 3.0/1.0, and 4.0/1.5. Every lane kept
post-settle live stretch below 3.5%. The canonical preview now uses 4.0/1.5.

At 4.0/1.5, settled quarter-orbit guide-tip motion is:

- strong: 326.2, 402.0, and 357.5 mm RMS;
- moderate: 146.4, 149.7, and 132.1 mm RMS.

Maximum post-settle live stretch is 3.4995%; final live stretch is 3.2872%.
The replay digest is `4d40078bcf6fe3d3`.

The raw all-time receipt still includes the known first-step initialization
transient (77.8791%); it is not relabeled as a wind gate. The bounded claim
begins after the defined 30-step settling interval.

Chrome Canary fixed-camera frames at strong-orbit 25%, 50%, and 75% show the
long hydrated silhouette changing with direction. The compass arrow is clamped
to the ring rather than scaling beyond the viewport at the corrected force.
The canonical URL no longer bakes force values into its query, and the exact
legacy 0.58/0.29 pair is migrated on refresh so an already-open production tab
cannot pin the frozen-looking calibration indefinitely.

## Claim boundary

These magnitudes remain uncalibrated solver acceleration controls, not wind
speed or force in physical units. The fixed-step digest, stretch measurements,
and guide-tip displacement are mechanics receipts. Perceptual readability is a
browser observation.
