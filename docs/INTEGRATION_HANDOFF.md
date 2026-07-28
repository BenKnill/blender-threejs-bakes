# Integration handoff

This document owns the supported composition, recorded-motion, and bake
boundary beneath the repository's product and research surfaces. The current
product is the [Hair Material Bench](HAIR_MATERIAL_BENCH.md); it uses only the
parts of this boundary that its receipts name.

For the stable integration itself, Three.js authors and previews a scene; Box3D
is the sole rigid-body integrator; Blender consumes sampled motion and owns final
materials, lighting, and visual deformation.

## Stable integration surface

```text
scene-state/1 + simulation-job/1 + render-job/1
                         │
                         ▼
                 compile_*.py
                         │
                         ▼
                  B3SCENE 5
                         │
                         ▼
              Box3D motion-clip/1
                 │              │
                 ▼              ▼
       Three.js Physics Preview  Blender bake
```

The authored and sampled space is right-handed Three.js Y-up, in metres,
kilograms, seconds, and radians. Blender performs the existing Y-up → Z-up
conversion only at its render boundary. Do not add a second conversion in the
editor or physics compiler.

## What the stable surface guarantees

- `just test` covers the dependency-light scene and Box3D compiler contracts.
- The native runner records and replays a basic dynamic-body scene.
- The editor can play the resulting `motion-clip/1` without running another
  physics engine.
- Generated physics/build and render outputs are ignored by Git.
- The local review gate is `just lint`, `just test`, and `git diff --check`.

## Deliberate non-claims

- The generic compiler currently supports static/dynamic bodies with manifest
  bounding-box colliders only.
- Kinematic bodies, joints, mesh/compound colliders, and deformation feedback
  are not part of this stable generic surface.
- Specialized tree, ribbon, wind, contact, and hair studies do not silently
  widen the generic compiler contract.
- The editor preview proves playback visibility, not Three.js/Blender numeric
  parity. A parity receipt remains the next validation artifact.

## Adding a new integration

Keep a new feature in one reviewable slice. Add or update its schema, pure
compiler tests, receipt/non-claims, and local-check-safe command before adding generated
assets or long-running render output. Keep heavy source payloads in the external
asset shelf; commit metadata, stable IDs, and provenance receipts instead.
