# Full-groom physics-cage hydration receipt

Issue: [#152](https://github.com/BenKnill/blender-threejs-bakes/issues/152)

## Why the section tube was insufficient

The earlier `controlTube=1` mode made one posed section cyan while finished hair
remained visible over the rest of the head. It explained a local control, but
did not produce the globally separated simulation/appearance hierarchy visible
in the preserved Disney reference appendix. In particular, the references show
colored guide curves, scalp sections, and large volume controls as an upstream
representation distinct from the final dense material.

The new mode is opt-in through `groomHydration=1` or the **Physics cage -> full
hydrated groom** selector. Hair-only and local section-tube modes remain
available.

## Presentation identity

- Field: `section_guide_cage_hydration_450_v1`
- Mechanical cage: 256 guides x 12 segments = 3,072 colored line segments
- Root display: 256 section-colored scalp points
- Section palette: eight deterministic colors matching the solver's eight
  scalp groups
- Volume control: the existing 10-sided translucent mean-section tube
- Dense result: 256 guides x 21 interpolated fibers = 5,376 visible fibers
- Physics authority: none; every visual reads solver positions without writing
  force, collision, constraints, topology, or state

## Deterministic phases

| Step range | Phase         |    Dense hair |        Guides |           Tube |
| ---------- | ------------- | ------------: | ------------: | -------------: |
| 0-44       | physics cage  |            0% |           88% |            22% |
| 45-119     | hydrating     | smooth 0-100% | smooth 88-14% | smooth 22-4.4% |
| 120-149    | guide release |          100% |  smooth 14-0% |  smooth 4.4-0% |
| 150+       | hydrated      |          100% |            0% |             0% |

At step 90 the transition is 64.8% dense hair, 40.048% guide opacity, and
10.5952% tube opacity. The schedule is deterministic and unit-tested.

## Browser A/B

The same realistic-head, styled-side-part, 256-guide fixture was captured at
560 x 720 and 1280 x 720:

- Step 30 is unmistakably diagnostic: a section-colored x-ray cage, visible
  scalp roots, and cyan volume tube with no dense hair or undercoat.
- Step 90 visibly combines receding guides with the emerging complete material.
- Step 150 contains only the brown shaded groom; guide points, lines, and tube
  are absent.
- Both narrow and widescreen compositions retain the full silhouette and HUD
  phase label.

At fixed step 90, enabled and hair-only modes both report physics digest
`1b50f30cdfdff721`. This is the bounded renderer-only identity claim.

One enabled narrow observation reported:

- cage position-buffer digest: `4219a996`;
- cage geometry mean / p99 / max: 0.026 / 0.10 / 0.20 ms over 239 measured
  frames;
- dense geometry p99 / max: 2.90 / 2.90 ms over 240 measured frames.

Timing is a single-browser observation, not a portable performance guarantee.

## Front doors

```sh
just hair-groom-hydration-showcase
just hair-reel-control
```

Both remain moving browser animations. Fixed steps are validation checkpoints,
not a replacement for the transition.

## Claim boundary

This establishes a production-inspired representation boundary; it does not
reproduce Disney's Tonic, Quicksilver, solver, or renderer. The cage is still a
direct view of reduced-order guides, the one tube is a mean-section proxy, and
the hydrated groom still lacks deep self-shadowing, order-independent
transparency, face-clearing art direction, and per-fiber mechanics.
