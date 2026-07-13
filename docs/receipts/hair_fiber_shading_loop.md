# Hair fiber shading and looping-preview receipt

Issue: [#144](https://github.com/BenKnill/blender-threejs-bakes/issues/144)

## Reference-derived design

The implementation uses the common structure of production and real-time
strand pipelines without claiming to reproduce either renderer:

- Disney's [artist-friendly hair shading system](https://disneyanimation.com/publications/an-artist-friendly-hair-shading-system/)
  wrapped physically motivated hair response in controls artists could reason
  about for *Tangled*.
- Disney's [production path-tracing model](https://disneyanimation.com/publications/a-practical-and-controllable-hair-and-fur-model-for-production-path-tracing/)
  separates reflection and internal-transmission modes, distinguishes
  longitudinal roughness from azimuthal softness, and treats multiple
  scattering as essential to perceived volume and color.
- AMD's open-source [TressFX lighting shader](https://github.com/GPUOpen-Effects/TressFX/blob/master/src/Shaders/TressFXLighting.hlsl)
  uses strand-tangent diffuse, a neutral primary reflection shifted toward the
  root, and a colored internal-reflection highlight shifted toward the tip.
  Its rendering parameters also expose base/tip color and strand UV.
- Current [Unity HDRP hair documentation](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@14.0/manual/master-stack-hair.html)
  and [Unreal groom guidance](https://dev.epicgames.com/documentation/unreal-engine/hair-simulation-and-rendering-quick-start-guide-in-unreal-engine)
  distinguish primary-character strand geometry from cheaper card LODs and
  retain per-root/per-strand attributes for material variation.

Because this demo already renders thousands of screen-aligned strand ribbons,
the immediate improvement is a strand shader rather than an alpha-card atlas.
Cards remain a plausible future LOD, not the hero representation.

## Renderer identity and boundary

- Field: `tangent_dual_lobe_ms_fill_v1`
- Geometry: screen-aligned tapered strand ribbons
- Longitudinal roughness: 0.34
- Primary: neutral root-shifted reflection approximation
- Secondary: hair-tinted tip-shifted transmission approximation
- Multiple-scattering fill: 0.11
- Color: deterministic fiber variation plus root-to-tip darkening/tint
- Diagnostic fallback: `hairShade=flat`
- Physics authority: none; renderer only

This is not a Marschner or Chiang path tracer. It has no fiber-width integral,
deep opacity map, voxelized transmittance, order-independent transparency, or
calibrated melanin absorption.

## Fixed narrow-browser A/B

Fixture: 560×720 viewport, replay step 90, 256 guides × 15 fibers, three-parent
volume interpolation, styled roots, section 7 pose, and the same hair state.

| Mode | Physics digest | Position digest | Observed FPS | Geometry p99 |
| --- | --- | --- | ---: | ---: |
| flat | `1b50f30cdfdff721` | `8019ba02` | 120 | 2.30 ms |
| fiber lobes | `1b50f30cdfdff721` | `8019ba02` | 120 | 1.40 ms |

The geometry timing difference is browser noise; the shader does not change
CPU geometry construction. The bounded result is digest equality plus no
observed frame-rate regression below the browser's 120 fps ceiling. GPU shader
time is not separately instrumented.

Visual A/B frames are gitignored at
`attachments/20260713-fiber-shading-loop/step-090-flat.png` and
`attachments/20260713-fiber-shading-loop/step-090-fiber-lobes.png`.

## Animation receipt

- Field: `fade_reset_450_step_v1`
- Fade in: steps 0–29
- Full presentation: steps 30–419
- Fade out: steps 420–449
- Reset: step 450 to the same deterministic initial fixture

The live browser moved from step 21 authoring through step 204 dissolving and
then crossed the reset boundary, reporting `restarts: 1` and `loop 2`. This
restores the hands-off animation. Fixed replay URLs remain non-looping so tests
can hold exact semantic checkpoints.

## Commands

- `just hair-control-tube-showcase`
- `node scripts/test_hair_material_solver.mjs`
- `just lint`
- `just test`
