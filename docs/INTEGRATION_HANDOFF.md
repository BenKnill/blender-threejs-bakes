# Integration handoff

This repository is the composition and bake boundary. Three.js authors and
previews a scene; Box3D is the sole rigid-body integrator; Blender consumes
sampled motion and owns final materials, lighting, and visual deformation.

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

## What this branch guarantees

- `just test` covers the dependency-light scene and Box3D compiler contracts.
- The native runner records and replays a basic dynamic-body scene.
- The editor can play the resulting `motion-clip/1` without running another
  physics engine.
- Generated physics/build and render outputs are ignored by Git.
- Local `just lint` and `just test` run editor lint/format checks, Python lint,
  whitespace checks, and the compiler contract tests before review.

## Deliberate non-claims

- The generic compiler currently supports static/dynamic bodies with manifest
  bounding-box colliders only.
- Kinematic bodies, joints, mesh/compound colliders, and deformation feedback
  are not part of this stable generic surface.
- The editor preview proves playback visibility, not Three.js/Blender numeric
  parity. A parity receipt remains the next validation artifact.

## Adding a new integration

Keep a new feature in one reviewable slice. Add or update its schema, pure
compiler tests, receipt/non-claims, and local-check-safe command before adding generated
assets or long-running render output. Keep heavy source payloads in the external
asset shelf; commit metadata, stable IDs, and provenance receipts instead.
