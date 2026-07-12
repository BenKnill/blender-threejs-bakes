# Hair section pose control receipt

Issue: [#138](https://github.com/BenKnill/blender-threejs-bakes/issues/138)

## Capability boundary

This slice adds one artist-directed section control primitive: a deterministic
eighth of the scalp drives three weighted mid-shaft guide points with lift plus
signed scalp-tangential sweep. Existing rest-baked dense interpolation inherits
the guide motion. It does not claim production grooming, arbitrary volume
selection, collision-complete character interaction, or Disney parity.

## Operator identity

- Field: `eight_section_tangent_tube_v1`
- Selected section: 6 of 8
- Affected guides at 256-guide resolution: 30
- Control fractions: 0.36, 0.50, 0.64
- Control weights: 0.55, 1.00, 0.62
- Peak lift / tangential sweep: 0.32 m / -0.34 m
- Total step stiffness: 0.12
- Six-iteration stiffness: 0.021080201746559446 per iteration
- Cycle: pose steps 30–89, hold 90–169, release 170–254, released from 255

## Deterministic acceptance

Command: `just hair-section-pose-ab`

- Disabled baseline digest: `6a0294d4bf085310`
- Treatment digest: `0a6325fc2d861d5c`
- Repeated treatment digest: `0a6325fc2d861d5c`
- Peak relative stretch: 0.034999288296334606
- Final relative stretch: 0.03062987405066118
- Completed cuts: 256
- Held step 91 digest: `232d8fd7fb7524f0`
- Released step 256 digest: `837b2af693b2cf73`
- Post-cut step 420 digest: `0a6325fc2d861d5c`

The acceptance boundary is the existing 3.5% peak-stretch gate. Summed
correction distance is a solver-position proxy, not calibrated work or force.

## Visual recipe

`just hair-section-pose-showcase` prints the autonomous narrow-preview URL with
256 guides, 15 visible fibers per guide, three-parent volume interpolation,
styled roots, rotating wind, comb cycle, section pose, and delayed diagonal cut.

Browser timing and render-buffer digests are deliberately left for a subsequent
visual pass if the local preview is not observed before shutdown; the
deterministic product gate above is the claim made by this receipt.
