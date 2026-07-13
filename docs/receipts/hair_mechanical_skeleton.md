# Lit rod-and-joint hair physics receipt

- Original issue: [#154](https://github.com/BenKnill/blender-threejs-bakes/issues/154)
- Uniform-size correction: [#158](https://github.com/BenKnill/blender-threejs-bakes/issues/158)

## Visual diagnosis

The first full-groom cage rendered all 256 guides as overlapping lines together
with a translucent mean-section tube. At one-third-window preview scale that
combination read as bundled fibers, not the reduced rod-and-link system driving
the simulation. The v2 rod renderer made the hierarchy explicit, but later
screenshot review exposed false size heterogeneity: root joints were
deliberately 1.65 times larger, transparent overlaps did not write depth, and
brighter root clusters accumulated into irregular blobs. None of those
differences encoded a solver property.

## Mechanical display

- identity: `uniform_rod_joint_hydration_450_v3`;
- style identity: `uniform_world_space_rods_joints_v1`;
- 20 guides selected deterministically across the full 256-guide ordering;
- 12 lit cylinder links per displayed guide, 240 rods total;
- 13 spherical joints per displayed guide, 260 joints total;
- one 0.011 m world-space radius for every active rod;
- one 0.020 m world-space radius for every active joint, including roots;
- depth writes during the mechanical hold resolve overlaps instead of adding
  transparent brightness and apparent size;
- eight section colors preserve the solver grouping;
- cool key and cyan fill light the mesh geometry;
- mannequin opacity falls to 32% during the clean mechanical phase;
- dense hair, undercoat, and the section-volume tube are absent.

These are renderer-owned instances that copy solver positions. They do not
write positions, velocities, constraints, forces, collision, cuts, or section
membership.

## Schedule

| Step range | Representation      | Dense hair |   Rods | Tube |
| ---------- | ------------------- | ---------: | -----: | ---: |
| 0-119      | mechanical skeleton |         0% |    92% |   0% |
| 120-209    | hydration handoff   |     0-100% | 92-18% |   0% |
| 210-239    | final guide release |       100% |  18-0% |   0% |
| 240+       | hydrated groom      |       100% |     0% |   0% |

The reel therefore gives the clean system two seconds at 60 simulation steps
per second before any render fiber appears.

## Browser receipt

The realistic-head, styled-side-part fixture was checked at fixed steps 60,
165, and 260 in a 560 x 720 viewport. Step 60 shows only discrete rods and
joints; step 165 is the intentional handoff; step 260 shows only the hydrated
groom. The step-60 skeleton and hair-only A/B share physics digest
`b7a5a62747c250db` at 2.999% current stretch. At step 165, the hydrating and
hair-only A/B share digest `c478c99b9a2f29d7` at 3.389% current stretch.

The current fixed mechanical and hydration-midpoint screenshots are preserved
in the gitignored local attachment shelf at
`attachments/20260713-uniform-physics-skeleton/`. The original v2 screenshots
remain in `attachments/20260712-lit-rod-joint-demo/`.

One 600-frame narrow observation measured:

- skeleton update mean: 0.038 ms;
- skeleton update p99 / maximum: 0.20 / 0.20 ms;
- dense geometry update p99 at the hydration midpoint: 3.10 ms;
- browser console warnings/errors: none.

This timing is an observation on one browser session, not a portable performance
guarantee.

## Claim boundary

The displayed links reveal the solver's point-chain discretization; they are
not independent rigid bodies and do not add bend or twist mechanics. The sparse
selection is an explanatory view of the full 256-guide state, not a claim that
only 20 guides are simulated. World-space uniform radii still undergo normal
perspective projection, so distant particles are slightly smaller on screen.
The hydrated result still needs lock-aware hairline coverage, deep
self-shadowing, and better transparency before it reads as realistic production
hair.
