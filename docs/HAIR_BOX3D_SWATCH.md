# Box3D spherical-chain hair swatch

Issue: [#171](https://github.com/BenKnill/blender-threejs-bakes/issues/171)

## Question

Can the repository's native Box3D lane produce a visibly wind-driven reduced
hair skeleton without the heavy per-frame damping and repeated rest-shape
projection used by the browser Verlet/PBD solver?

This is a bounded mechanics experiment, not a replacement hair solver. It uses
16 guides with eight dynamic capsule links each. Every link is attached through
a three-dimensional spherical joint with a target-rotation spring, cone limit,
and twist limit. A static root body anchors each chain.

## Wind operator

The twelve-second program applies one complete 6.0 m/s orbit followed by one
complete 3.25 m/s orbit. Each capsule receives quadratic drag from its velocity
relative to the air. Normal drag is deliberately much stronger than axial drag,
so the force respects the directed geometry of a hair guide instead of acting
as an orientation-blind acceleration.

The force is applied at the capsule center. The off-center spherical attachment
turns it into joint torque without adding an invented animation pose. A small,
deterministic per-guide coefficient variation prevents all 16 chains from
remaining a perfectly coincident curtain.

## Run

```sh
just hair-box3d-swatch
```

The recipe compiles Box3D and the C17 lab, runs the deterministic self-test,
then writes:

- `physics/labs/hair_box3d_swatch/outputs/hair_box3d_swatch_motion.csv`;
- `physics/labs/hair_box3d_swatch/outputs/receipt.json`.

Both files are generated and ignored. The compact measured receipt from the
first accepted run is preserved at
`docs/receipts/hair_box3d_swatch_v1.json`.

The same recipe regenerates the tracked seven-pose diagnostic plate at
`docs/images/hair_box3d_swatch_preview.svg`. It is a projection of the recorded
Box3D transforms, not a second simulation.

## First result

The first accepted Apple Silicon release build simulated 128 dynamic capsules,
128 spherical joints, 720 fixed 1/60-second steps, and four Box3D substeps per
step. It ran the twelve simulated seconds in 281 ms of measured process CPU time
(42.7 times real time) for the rotating-wind lane.

The calm control had zero horizontal mean-tip displacement. Strong wind moved
the mean tip horizontally by 1.662 m and visited 23 of 24 azimuth bins;
moderate wind moved it horizontally by 1.156 m and visited all 24 bins. Mean tip/wind alignment was 0.968 in both
phases. Maximum spherical-anchor separation was 2.40 mm on a 280 mm link, and
the fixed replay repeated at trajectory digest `eb3ebea59ffbb5af`.

This is much more motion than the current groom needs. That is useful: it proves
the Box3D skeleton can be responsive before tuning spring stiffness, guide
count, drag area, and hydration weight. It does not yet show good hair motion.

## Contact and stiction boundary

Box3D reported up to 553 simultaneously touching contact pairs and 3,154 begin
events during the rotating lane. Those are ordinary isotropic Box3D contacts.
There is no hair-specific static friction, anisotropic stick/slip ellipse,
persistent contact memory, or hydration in this slice.

The next operator should consume only Box3D's active contact IDs/manifolds and
apply a bounded equal-and-opposite tangential impulse:

1. compute the impulse that would cancel relative tangential velocity;
2. stick if it lies inside axial/transverse static-friction bounds;
3. otherwise project onto smaller kinetic-friction bounds;
4. use distinct capture/release speeds and expire inactive contact IDs;
5. prove conservation, non-positive tangential work, and threshold ordering as
   local HOL Light contracts, then test the C implementation against the same
   scalar/vector oracle.

## Claim boundary

This result establishes a fast, deterministic native reduced-guide fixture with
real capsule inertia, spherical joints, contact, and direction-aware drag. It
does not establish browser/WASM cost, thousands-of-body performance, realistic
fiber calibration, dense render quality, or a refinement connection between
the native code and HOL Light statements.
