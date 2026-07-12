# Hair section pose control receipt

Issues: [#138](https://github.com/BenKnill/blender-threejs-bakes/issues/138),
[#140](https://github.com/BenKnill/blender-threejs-bakes/issues/140)

## Capability boundary

This slice adds one artist-directed section control primitive: a deterministic
eighth of the scalp drives three weighted mid-shaft guide points with lift plus
signed scalp-tangential sweep. Existing rest-baked dense interpolation inherits
the guide motion. It does not claim production grooming, arbitrary volume
selection, collision-complete character interaction, or Disney parity.

## Operator identity

- Field: `eight_section_tangent_tube_v1`
- Selected section: 7 of 8
- Affected guides at 256-guide resolution: 35
- Control fractions: 0.36, 0.50, 0.64
- Control weights: 0.55, 1.00, 0.62
- Peak lift / tangential sweep: 0.32 m / +0.34 m
- Total step stiffness: 0.12
- Six-iteration stiffness: 0.021080201746559446 per iteration
- Cycle: pose steps 30–89, hold 90–169, release 170–254, released from 255

## Deterministic acceptance

Command: `just hair-section-pose-ab`

- Disabled baseline digest: `6a0294d4bf085310`
- Treatment digest: `e72b5a6c17a20c57`
- Repeated treatment digest: `e72b5a6c17a20c57`
- Peak relative stretch: 0.03498150905519519
- Final relative stretch: 0.03356592599200791
- Completed cuts: 256
- Held step 91 digest: `c804e540af6db4bb`
- Released step 256 digest: `c3ae264c4b3c65eb`
- Post-cut step 420 digest: `e72b5a6c17a20c57`

The acceptance boundary is the existing 3.5% peak-stretch gate. Summed
correction distance is a solver-position proxy, not calibrated work or force.

## Visual recipe

`just hair-section-pose-showcase` prints the autonomous narrow-preview URL with
256 guides, 15 visible fibers per guide, three-parent volume interpolation,
styled roots, rotating wind, comb cycle, section pose, and delayed diagonal cut.

## Narrow browser A/B

At fixed step 91 without the comb, the original section 6 / -0.34 m recipe
pulled a front lock across the mannequin's face. Section 7 / +0.34 m instead
formed a coherent outward side volume, preserved the central part, and cleared
both eyes. The isolated held frame reported 3.05% current stretch. The visual
receipt is gitignored at
`attachments/20260712T234700Z-section-pose-s7-outward-held.png`.

This is a bounded front-view silhouette judgment, not a claim that section 7 is
optimal from every camera or for every groom. A live timing and render-buffer
digest pass remains separate from this deterministic fixed-step receipt.
