# Box3D spherical-chain hair swatch

Issues: [#171](https://github.com/BenKnill/blender-threejs-bakes/issues/171),
[#173](https://github.com/BenKnill/blender-threejs-bakes/issues/173),
[#175](https://github.com/BenKnill/blender-threejs-bakes/issues/175)

## Question

Can the repository's native Box3D lane produce a visibly wind-driven reduced
hair skeleton without the heavy per-frame damping and repeated rest-shape
projection used by the browser Verlet/PBD solver?

This is a bounded mechanics experiment, not a replacement hair solver. It uses
16 guides with eight dynamic capsule links each. Every link is attached through
a three-dimensional spherical joint with a target-rotation spring, cone limit,
and twist limit. A static root body anchors each chain.

The follow-up scalp fixture raises that same operator to accepted 64- and
256-guide targets. It bakes the browser groom's golden-angle scalp placement,
face-clear side part, and crown sweep into native rest frames. The spherical
joint cone is aligned with each capsule's long axis; an earlier perpendicular
frame let roots fold across the scalp even though their initial pose was
correct.

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
The contact-memory A/B is preserved at
`docs/receipts/hair_box3d_stiction_ab_v1.json`.
The scalable scalp result is preserved at
`docs/receipts/hair_box3d_scalp_scale_v1.json`.

The same recipe regenerates the tracked aligned two-row diagnostic plate at
`docs/images/hair_box3d_swatch_preview.svg`. It is a projection of the recorded
Box3D transforms, not a second simulation. The top row is ordinary Box3D
contact; the lower row adds the hair-specific operator under the identical
wind program.

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

## Persistent anisotropic contact operator

The second experiment consumes Box3D's touching contact IDs, manifold feature
IDs, points, normals, and normal impulses after each native solver step. A
fixed-capacity open-addressed table remembers contacts for three steps. It is
bounded to 1,024 entries and uses deterministic ordering, tombstones, expiry,
and oldest-entry eviction rather than allocating in the simulation loop.

At each admitted cross-guide contact, the operator:

1. derives the guide-axial tangent and its transverse contact-plane axis;
2. builds the coupled 2×2 effective-mass response at the contact point;
3. solves the impulse that would cancel relative tangential velocity;
4. sticks if it lies inside the anisotropic static ellipse and the hysteretic
   speed threshold, otherwise scales it onto the smaller kinetic ellipse;
5. applies equal-and-opposite impulses at the same world point.

The production coefficients deliberately make transverse friction much
stronger than axial friction: static 0.92 versus 0.16 and kinetic 0.62 versus
0.10. New contacts capture below 0.12 m/s; remembered contacts release above
0.30 m/s.

## Contact-memory A/B result

The accepted Apple Silicon release A/B retained the original Box3D-only digest
`eb3ebea59ffbb5af`. The stiction lane repeated at digest
`039c9dfa44a1f32b`, observed 1,793 captures, 1,482 releases, 8,225 stick
services, and 33,664 slip services. Contacts persisted for as many as 109
steps while the table peaked at 182 entries, with zero candidate drops,
evictions, invalid solves, or measured energy-injection violations.

Mean predicted contact-plane relative speed fell from 0.05599 m/s to
0.04255 m/s, a 24.0% reduction. Strong-wind mean tip displacement retained
99.99% of baseline and moderate-wind displacement retained 100.00%, so the
operator changed local relative motion without freezing the wind response.
Strong-phase mean horizontal tip spread fell 2.7%; the moderate change was
within noise at +0.5%. The stiction lane cost 1.06× the Box3D-only CPU time in
this small fixture.

The C self-test exercises static capture, kinetic projection, non-positive
energy change, and equal-and-opposite linear and same-point angular balance.
HOL Light supplies five deliberately local real-arithmetic contracts for
momentum, same-point angular balance, nested friction bounds, hysteresis
ordering, and non-positive scaled cancellation work. A warm OrbStack replay is
development evidence only, not a cold final proof receipt or a refinement proof
for the C implementation.

## Scalp-scale result and browser playback

The accepted 256-guide target contains 3,072 dynamic capsules and 3,072
spherical joints. Its fixed replay repeats at digest `eb53b6e105f6e58d`.
The strong and moderate phases visit 23/24 and 24/24 azimuth bins. Persistent
stiction records 68,050 captures and 58,460 releases while reducing mean
predicted contact-plane relative speed from 0.14576 m/s to 0.05251 m/s.

Root direction is now a gate rather than an initial-condition claim. Across
the settled two-orbit window, minimum first-link target alignment is 0.900 and
minimum outward alignment is 0.211. Maximum settled joint separation is
14.17 mm against a 15.5 mm bound. The smaller accepted 64-guide target remains
available for faster diagnostics and repeats at digest `6419d6ab3a45d6dd`.

The demo assets store 15 Hz quantized guide nodes: 0.86 MiB for 64 guides and
3.45 MiB for 256. The canonical page plays the 256-guide clip, exposes 64 of
those guides as 768 uniform rods and 832 uniform joints, then hydrates the
recorded motion into 5,376 render fibers. Browser code only interpolates and
renders the recorded nodes; it does not run Box3D or alter the native motion.

## Claim boundary

This result establishes deterministic 64- and 256-guide native scalp fixtures
with real capsule inertia, spherical joints, contact, direction-aware drag,
directed roots, and a bounded post-step hair-specific stick/slip operator. The
256-guide target measures thousands of bodies, but not live browser/WASM cost:
the public demo is recorded playback. It does not establish realistic fiber
calibration or a refinement connection between the native code and HOL Light
statements. The mannequin is deliberately excluded from native collision, so
head/face contact and the remaining ribbon-like hydrated surface are the next
visible mechanics/rendering boundaries.
