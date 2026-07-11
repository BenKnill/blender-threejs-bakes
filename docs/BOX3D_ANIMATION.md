# Box3D animation proof

The basic proof is a complete native-physics-to-Blender path:

1. `scene-state/1` supplies asset identity, position, quaternion orientation,
   optional scale, linear/angular velocity, physical material, and a moving
   physical camera. Cameras may author a readable world-space `look_at` target;
   compilation turns it into the same canonical quaternion.
2. `simulation-job/1` supplies Box3D gravity, fixed step, substeps, and ground.
3. `render-job/1` supplies duration, FPS, active camera, resolution, and samples.
4. `compile_physics.py` converts manifest bounding boxes into first-pass box
   colliders and emits a versioned native-runner input (`B3SCENE 5` for the
   generic scene path).
5. `box3d_scene_runner` simulates at 120 Hz, samples at 24 Hz, writes a
   `motion-clip/1` JSON file, writes a native cumulative event receipt, saves a
   `.b3rec`, and validates replay.
6. The editor's Physics Preview loads the same sampled transforms and interpolates
   them in Three.js space, so pose and quaternion mistakes are visible before bake.
7. `render_motion.py` turns the sampled transforms into linear Blender
   keyframes, integrates camera velocity, and renders reusable PNG frames.
8. FFmpeg encodes those cached frames without asking Blender to render again.

The native boundary is documented in
[`BOX3D_NATIVE_CONVENTIONS.md`](BOX3D_NATIVE_CONVENTIONS.md). The scene
contract deliberately uses Box3D-compatible MKS units, XYZW quaternions,
body-origin transforms, angular velocity, shape density/materials, and local
joint frames. Blender only converts the sampled motion at the render boundary.

Run the complete proof:

```sh
./scripts/build_basic_animation.sh
```

Outputs are gitignored:

- `physics/outputs/basic_crate.motion.json`
- `physics/outputs/basic_crate.motion.json.events.json`
- `physics/outputs/basic_crate.b3rec`
- `renders/box3d_crate_drop_frames/`
- `renders/box3d_crate_drop.mp4`
- `renders/box3d_crate_drop.receipt.json`

## Current deliberate limits

- Collision is a manifest bounding box. Convex and compound collider assets are
  the next fidelity step.
- The proof uses a procedural studio material because this Blender build could
  not upload several source texture images to the GPU.
- Camera motion currently integrates constant linear and angular velocity. More
  expressive camera controllers should compile down to the same canonical
  state rather than changing the renderer contract.
- The editor preview is playback, not a second physics engine. It currently
  previews body poses only; a future parity receipt should compare sampled
  Three.js and Blender transforms directly.
- Blender renders a PNG sequence because this build exposes no FFmpeg render
  format. External FFmpeg encoding is intentional and lets video settings be
  changed without rerendering frames.
