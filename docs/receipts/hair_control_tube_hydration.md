# Hair control-tube hydration receipt

Issue: [#142](https://github.com/BenKnill/blender-threejs-bakes/issues/142)

## Capability boundary

This slice visualizes the existing section-pose operator as an artist-facing
control volume. The cyan tube is a dynamic render mesh around the selected
section's mean mechanical guide. It is deliberately schematic and has no
collision, force, constraint, or state authority. Dense fibers remain the
rendered material; the tube is removed before the released simulation phase.

## Presentation identity

- Field: `mean_guide_tube_hydration_v1`
- Selected section: 7 of 8, 35 of 256 mechanical guides
- Tube: 10 radial sides, 130 vertices, 240 triangles, transparent single pass
- Authoring: steps 0–29, 8% proxy-fiber hydration
- Hydrating: steps 30–89, proxy fibers restore full width and color
- Hydrated: steps 90–169, full hair under a faint retained tube
- Dissolving: steps 170–214
- Simulation: tube hidden from step 215

The schedule is deterministic and unit-tested through
`sectionPosePresentationAtStep`. Query `controlTube=1` and the **Pose
presentation** selector preserve the existing hair-only default.

## Fixed narrow-browser gate

Fixture: 560×720 viewport, 256 guides, 12 segments, 15 fat-line fibers per
guide, three-parent volume interpolation, styled side-part roots, section 7
pose, and fixed replay step 90.

| Mode | Physics digest | Hair geometry p99 | Tube geometry p99 | Tube buffer digest |
| --- | --- | ---: | ---: | --- |
| control tube | `1b50f30cdfdff721` | 1.20 ms | 0.10 ms | `ab37bc33` |
| hair only | `1b50f30cdfdff721` | 1.10 ms | — | — |

The enabled observation used 347 measured tube frames. Tube geometry mean was
0.035 ms and maximum was 0.20 ms. The timing comparison is a single live
browser observation, not a portable benchmark. Digest equality is the bounded
claim that this visual layer did not change the fixed-step physics state.

Visual checkpoints are gitignored at:

- `attachments/20260712-control-tube-hydration/step-020-authoring.png`
- `attachments/20260712-control-tube-hydration/step-090-hydrated.png`
- `attachments/20260712-control-tube-hydration/step-215-simulation.png`

## Commands

- `just hair-control-tube-showcase`
- `node scripts/test_hair_material_solver.mjs`
- `just lint`
- `just test`
