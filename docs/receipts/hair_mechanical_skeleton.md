# Lit rod-and-joint hair physics receipt

Issue: [#154](https://github.com/BenKnill/blender-threejs-bakes/issues/154)

## Visual diagnosis

The earlier full-groom cage removed dense hair during its initial phase, but it
still rendered all 256 guides as overlapping lines together with a translucent
mean-section tube. At one-third-window preview scale that combination read as
bundled fibers, not the reduced rod-and-link system driving the simulation.
The 45-step clean hold also passed too quickly in the moving reel.

## Mechanical display

- identity: `lit_rod_joint_hydration_450_v2`;
- 32 guides selected deterministically across the full 256-guide ordering;
- 12 lit cylinder links per displayed guide, 384 rods total;
- 13 spherical joints per displayed guide, 416 joints total;
- enlarged root joints make the scalp attachment explicit;
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
`4b5e2bcab247f0bd`.

The narrow physics, handoff, hydrated, and widescreen physics screenshots are
preserved in the gitignored local attachment shelf at
`attachments/20260712-lit-rod-joint-demo/`.

One 600-frame narrow observation measured:

- skeleton update mean: 0.058 ms;
- skeleton update p99 / maximum: 0.20 / 0.20 ms;
- dense geometry update p99: 3.00 ms;
- browser console warnings/errors: none.

This timing is an observation on one browser session, not a portable performance
guarantee.

## Claim boundary

The displayed links reveal the solver's point-chain discretization; they are
not independent rigid bodies and do not add bend or twist mechanics. The sparse
selection is an explanatory view of the full 256-guide state, not a claim that
only 32 guides are simulated. The hydrated result still needs face-clearing art
direction, deep self-shadowing, and better transparency before it reads as
realistic production hair.
