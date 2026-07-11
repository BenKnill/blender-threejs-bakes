# Box3D native conventions

Box3D is the authoritative simulation vocabulary for this project. Blender is
the animation/rendering endpoint; it should not redefine the physics state on
the way through.

This note records the boundary against the local Box3D checkout at
`/Users/boxer/box3d`. The primary references are
[`types.h`](/Users/boxer/box3d/include/box3d/types.h),
[`box3d.h`](/Users/boxer/box3d/include/box3d/box3d.h),
[`hello.md`](/Users/boxer/box3d/docs/hello.md),
[`overview.md`](/Users/boxer/box3d/docs/overview.md), and the joint section of
[`simulation.md`](/Users/boxer/box3d/docs/simulation.md).

## Adopted canonical contract

| Project field | Box3D field | Convention |
| --- | --- | --- |
| `space: "threejs_yup"` | application-selected Box3D frame | Right-handed, +Y up, gravity normally negative Y. Box3D itself has no built-in up axis. |
| `position_m` | `b3BodyDef.position` / `b3Pos` | MKS metres. The position is the body origin, not automatically the center of mass. |
| `orientation_xyzw` | `b3BodyDef.rotation` / `b3Quat` | Native quaternion vector part `(x,y,z)` followed by scalar `w`; serialized XYZW is a direct representation. |
| `linear_velocity_m_s` | `b3BodyDef.linearVelocity` | Metres per second. |
| `angular_velocity_rad_s` | `b3BodyDef.angularVelocity` | Axis-times-speed vector in radians per second. |
| body damping/gravity/sleep fields | `b3BodyDef.linearDamping`, `angularDamping`, `gravityScale`, `sleepThreshold`, and flags | Optional native controls; omitted values keep `b3DefaultBodyDef()` defaults. |
| `motion_locks` | `b3BodyDef.motionLocks` | Per-axis linear/angular locks, expressed as named booleans. |
| simulation contact/speed fields | `b3WorldDef` | Thresholds, contact hertz/damping/speed, maximum linear speed, sleep, and continuous-collision flags retain native units and defaults. |
| `density_kg_m3` | `b3ShapeDef.density` | Shape density derives mass and inertia when `updateBodyMass` is enabled. |
| `friction`, `restitution` | `b3ShapeDef.baseMaterial` | Shape material values; Box3D mixes them at contact time. |

All lengths, masses, times, and angles stay in metres, kilograms, seconds, and
radians. This is also why Blender conversion is kept at the renderer boundary:
the simulation and Three.js preview share one space and one set of units.

## World defaults

Every world starts from `b3DefaultWorldDef()`. Our simulation jobs override the
gravity vector, fixed step, and substep count; the remaining native defaults are
intentional unless a job says otherwise: sleeping and continuous collision are
enabled, restitution/hit thresholds are 1 m/s, contact hertz is 30, contact
damping ratio is 10, contact speed is 3 m/s, and the maximum linear speed is
400 m/s. The solver is tuned for roughly 0.1–10 m moving objects, so the
manifest and authored scale should keep ordinary assets in that range.

## Native initialization order

The runner follows this order for a body:

1. Start from `b3DefaultBodyDef()`, never a zero-initialized definition.
2. Set type, world position, world rotation, initial velocities, and any body
   damping/gravity/sleep options.
3. Create the body at its intended transform.
4. Start each shape from `b3DefaultShapeDef()`, set density and material, then
   attach the shape. Shape geometry and density determine mass properties by
   default.
We do not put an angular momentum field in the readable
scene contract: `H = Iω` is only meaningful once the inertia tensor and its
reference frame are fixed.

## What is native today vs. adapter work

Already native-aligned:

- MKS units, right-handed +Y-up application frame, and radians;
- XYZW quaternions and origin-based body transforms;
- fixed-step stepping with explicit substeps;
- body/shape material and density ownership;
- native body damping, gravity scale, sleep/awake policy, bullet/enabled flags,
  and motion locks when authored;
- real Box3D recording plus replay validation;
- cumulative native contact, joint, and body-move event counts in the
  `simulation-events/1` receipt;

Still intentionally thin adapters:

- the first-pass scene compiler represents mesh colliders as manifest bounding
  boxes, not convex/compound/mesh shapes;
- the first-pass generic compiler emits rigid bodies only; it does not yet
  author joints, releases, or articulated assemblies;
- the generic scene runner still does not expose every `b3ShapeDef` option
  (filters, sensors, and event flags);
- kinematic target transforms and native debug draw are not yet part of the
  motion-clip contract. The event receipt is deliberately separate from the
  motion clip, and currently records counts rather than a stable entity-pair
  event vocabulary. Kinematic scene bodies are rejected explicitly rather than
  silently downgraded to static;
- the Blender bridge consumes sampled body transforms and does not feed mesh
  deformation back into Box3D.

These are explicit follow-up surfaces, not hidden differences in units or
coordinate conventions. New physics fields should use Box3D names and units
first, then be compiled into an adapter version that preserves those semantics.
The generic scene compiler now emits `B3SCENE 5` for these body and world
controls; legacy `B3SCENE 1`/`2`/`3`/`4` inputs remain readable by the runner.

## Sanity checks for every new physics feature

- Does the field say whether it is a body, shape, joint, world, or event value?
- Is its unit explicit (`_m`, `_kg_m3`, `_m_s`, `_rad`, or `_rad_s`)?
- Is an authored quaternion normalized and serialized XYZW?
- Are mass and inertia derived from the shape assembly or explicitly overridden?
- Is a one-shot change a force/torque/impulse event rather than a teleport or
  velocity replacement?
- Can the native replay/recording and a Blender render receipt prove what was
  simulated before visual deformation is applied?
