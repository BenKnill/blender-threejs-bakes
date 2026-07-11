# Scene state contract

`scene-state/1` describes continuous world state. It does not describe how often
the state is simulated, previewed, or rendered.

That separation is deliberate:

- simulation step frequency belongs to a simulation job;
- preview refresh rate belongs to Three.js;
- output FPS belongs to a Blender render job;
- a generated motion clip records its own sample interval.

An entity says what it is, which reference frame it uses, and its state in that
frame:

```json
{
  "id": "falling_crate",
  "kind": "asset",
  "frame": "world",
  "pose": {
    "position_m": [0, 5, -2],
    "orientation_xyzw": [0, 0, 0, 1],
    "scale_xyz": [1, 1, 1]
  },
  "motion": {
    "linear_velocity_m_s": [1.2, -0.5, 0],
    "angular_velocity_rad_s": [0, 1.4, 0.2]
  },
  "asset": { "asset_id": "medieval_prop_crate" }
}
```

## Canonical quantities

- Space is right-handed Three.js Y-up, deliberately matching the application
  frame used for Box3D; all lengths are metres and angles are radians unless a
  field name explicitly says millimetres or degrees. Box3D has no built-in up
  axis, so +Y up is a project convention rather than a hidden engine rule.
- Position is an XYZ vector in metres.
- Orientation is a normalized XYZW quaternion.
- Scale is a positive XYZ vector. It is part of the authored transform, not a
  renderer default.
- Linear velocity is an XYZ vector in metres per second.
- Angular velocity is an XYZ axis-times-speed vector in radians per second.

Angular velocity is not a quaternion or angular momentum. A normalized
quaternion carries a finite orientation but loses the magnitude needed to
represent spin rate. Box3D initializes bodies from angular velocity and applies
one-shot changes as forces, torques, or impulses; angular momentum would require
an explicit mass/inertia contract first because `H = I * omega` depends on the
body's inertia tensor and reference frame.

## Initialization checklist

Every authored entity should make these questions answerable without opening a
Blender file:

| Question | Canonical field | Rule |
| --- | --- | --- |
| What is it? | `kind`, `asset.asset_id` | Stable manifest identity; procedural provenance stays in the asset receipt. |
| What is its parent? | `frame` | `world` or another entity id; local pose is resolved before physics. |
| Where is it? | `pose.position_m` | Metres in the declared `threejs_yup` space. |
| Which way is it facing? | `pose.orientation_xyzw` | Normalized quaternion; local +X is right, +Y is up, and -Z is forward. |
| How large is it? | `pose.scale_xyz` | Positive XYZ scale; omitted means `[1, 1, 1]`. |
| How is it initially moving? | `motion.linear_velocity_m_s`, `motion.angular_velocity_rad_s` | Velocities are the solver-facing state; do not substitute a direction-only vector. |
| How does it collide? | `physics` | Body type, collider identity, density, friction, restitution, and optional native body controls. |
| How is a camera exposed? | `camera` | Focal length, sensor width, focus distance, aperture, exposure, and optional world-space target. |

Direction is not a second orientation source. For an entity, derive `forward`,
`up`, and `right` by rotating `(0, 0, -1)`, `(0, 1, 0)`, and `(1, 0, 0)` by the
quaternion. Cameras may instead specify `camera.look_at.target_position_m` in
world space (plus an optional up direction); the compiler turns that readable
intent into the canonical quaternion. The stored/compiled state still has one
orientation source.

```json
"camera": {
  "focal_length_mm": 50,
  "sensor_width_mm": 36,
  "focus_distance_m": 8,
  "aperture_fstop": 2.8,
  "exposure_stops": -0.7,
  "look_at": {
    "target_position_m": [0, 0.8, 0],
    "up_direction_xyz": [0, 1, 0]
  }
}
```

Mass, center of mass, and the inertia tensor are the remaining physics details
when we move beyond collider-derived rigid bodies. The current Box3D path derives
them from collider geometry and density, following `b3ShapeDef` semantics.
When needed, `physics.linear_damping`, `angular_damping`, `gravity_scale`,
`sleep_threshold_m_s`, sleep/awake flags, bullet/enabled flags, and named
`motion_locks` map directly to `b3BodyDef`; omitted fields retain native
defaults. Kinematic target transforms remain a separate adapter surface.
Initial forces, torques, impulses, wind, and joint releases are events/controllers,
not static pose fields; keep them in a simulation/assembly recipe so the initial
state stays readable.

`frame` is either `world` or the id of another entity. Parent-relative state is
useful for rigs and authored assemblies. A physics compiler should resolve the
hierarchy into world-space state before creating Box3D bodies. Until articulated
velocity composition is implemented, put initial velocities on world-framed
physics bodies or resolve them explicitly in the compiler; do not silently treat
a parent-local velocity as world-space.

## Entity kinds

- `asset` references an existing id in `assets/manifest.json`.
- `camera` is a moving scene entity with physical optics.

Procedural generation is an asset-authoring concern, not a scene concern. An
agent may use Blender or another generator to make a plant, but the scene only
references the accepted result:

```json
{
  "kind": "asset",
  "asset": { "asset_id": "seedthree_white_oak_1737" }
}
```

Generator version, species, seed, controls, screenshots, and export notes belong
in that asset's provenance receipt. This keeps the scene contract independent of
any one generator and avoids building an adapter before repeated work proves one
is necessary.

## Files

- `schemas/scene-state.schema.json` is the machine-readable shape.
- `scenes/example.scene.json` is a complete example.
- `scripts/validate_scene.py` performs dependency-free semantic checks.
- `jobs/example.render.json` supplies FPS, duration, active camera, and output settings.
- `scripts/compile_scene.py` checks manifest references, flattens hierarchy, and emits the existing layout schema.

Validate a scene with:

```sh
python3 scripts/validate_scene.py scenes/example.scene.json
python3 scripts/compile_scene.py scenes/example.scene.json jobs/example.render.json
```
