# Hair hero mannequin and reel-shot receipt

Issue: [#146](https://github.com/BenKnill/blender-threejs-bakes/issues/146)

## Asset identity and authority

- Visual asset: `physics/labs/hair_material/demo/assets/realistic-head-animation.glb`
- Source: Blender Studio Human Base Meshes Bundle v1.0.0
- License: CC0 1.0 Universal
- SHA-256: `d1ef943ef0b0081ed5b9d655f6b6bce419190ab754ad7aa0659bfa58e3566b78`
- Tracked size: 534,640 bytes
- Included geometry: realistic head, sclerae, and irises
- Collision authority: none. The original analytic scalp ellipsoid remains the
  only head collision proxy.

At the fixed 90-step styled-side-part fixture, both primitive and realistic
mannequin modes report physics digest `1b50f30cdfdff721`. This is the expected
renderer-only identity check, not evidence that the imported facial mesh is a
collider.

## Deterministic framing

Camera field identity: `three_shot_orbit_450_step_v1`.

- `beauty`: restrained 450-step orbit and breathing push-in around the complete
  silhouette.
- `control`: higher close-up for the translucent authoring volume and hair
  hydration.
- `cut`: a bounded ease closer and lower from steps 285 through 390 to hold the
  cut and post-cut relaxation.

The camera helper repeats exactly at steps 0 and 450. Camera selection is
query/UI state and has no solver authority. `reel=free` preserves manual orbit.

## Browser observations

The in-app browser was checked at 560 x 720 and 1280 x 720:

- The CC0 face points toward the camera, fits inside the analytic groom, and
  reads as a haircut mannequin in the narrow preview.
- A fixed beauty frame at step 90 renders 256 guides as 3,840 visible fibers;
  its current stretch is 3.05%. Because the no-comb beauty loop uses the
  `full_simulation` window, the showcase labels this reading `live` rather than
  implying an acceptance gate.
- The control shot at step 15 visibly separates the cyan authoring section from
  the brown hydrated fibers. Current stretch was 3.48%, reported as `live`.
- The cut shot at step 360 completed the two-pass comb, showed the shortened
  asymmetric silhouette, and reported 3.39% current stretch with the measured
  gate passing.
- A live 1280 x 720 beauty run crossed the 450-step boundary and displayed
  `loop 2`, confirming that the product path remains animated. One early-loop
  sample observed 52 displayed frames/s and 20.22 ms solver time. These are
  single-browser observations, not portable performance promises.

The fixed beauty check observed geometry-update p99 between 1.4 and 1.8 ms in
one realistic-head run. Renderer timing is deliberately reported separately
from solver timing and may vary with viewport, warmup, and browser scheduling.

## Moving front doors

```sh
just hair-reel-beauty
just hair-reel-control
just hair-reel-cut
```

Each recipe prints a hands-off looping browser URL with the realistic mannequin,
directional fiber shader, dense three-parent volume fill, styled side-part root
field, rotating wind, and one named camera. The cut recipe retains the measured
two-pass comb before the diagonal cut.

## Claim boundary

This slice supplies a better visual plate, deterministic compositions, and a
reconstructable capture identity. It does not add face-mesh collision, skin or
eye shading parity, detached cut-hair dynamics, deep opacity maps, or production
Disney grooming. Final reel encoding remains a separate packaging step; the
looping browser animations are the source experience, not a replacement set of
still frames.
