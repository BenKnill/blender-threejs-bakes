# SeedThree tree assembly

This is the next step above the single rigid hull proof and the Blender-only
reduced deformation prototype. The tree is represented by six coarse Box3D
bodies and five revolute joints:

- a static base anchor;
- trunk, lower, middle, upper, and crown dynamic boxes;
- a spring-held hinge chain, with the root spring released at 1.65 seconds by
  a native world-space angular impulse.

The recipe uses Box3D's native `static`/`dynamic` body vocabulary. The scene
compiler writes `B3SCENE 3`. The versioned joint fields carry full
`b3Transform` local frames (anchor plus quaternion), revolute target/limit
settings, and an optional release angular impulse in kg·m²/s. The runner
records the real Box3D simulation and validates its replay before Blender sees
the motion clip. `B3SCENE 2` remains readable for older velocity-release
receipts, but new articulated recipes should use `tree-assembly/2`.

Compilation checks the complete initial joint geometry before Box3D can
silently correct it. Body-local anchors must land within `1e-4` m in world
space, and the two local-frame Z axes used by a revolute joint must align within
`1e-4` rad. The rotated trunk recipe therefore uses rotation-aware local anchor
coordinates rather than the visually plausible unrotated offsets.

## Visual bridge

The SeedThree source Blend remains live geometry: one branch mesh and 1,664
foliage-card objects. Each branch vertex and leaf card is assigned to the
nearest vertical dynamic-body band. Its rest transform is converted into that
body's local frame, then the sampled Box3D pose carries it through the shot.
This keeps frame zero aligned with the source tree and makes the hinge motion
visible without pretending that the imported mesh is a deformable FEM body.

Each dynamic band also has a tiny two-axis damped modal state. It adds a small
height-weighted lag to branches and leaves, so the crown does not read as a
single carbon-fiber rigid block in wind. That state is visual-only: it is not
fed back into Box3D and is not JGS2/FEM.

## Run it

```bash
bash scripts/build_tree_assembly_animation.sh
```

The local SeedThree source payload is not tracked by Git. On this machine the
manifest points to `/Users/boxer/blender-threejs-bakes/assets/source_blends/`
and its matching GLB. `BOX3D_SOURCE_DIR` can select another Box3D checkout.

The generated audit artifacts are:

- `physics/outputs/seedthree_tree_assembly.b3scene`
- `physics/outputs/seedthree_tree_assembly.motion.json`
- `physics/outputs/seedthree_tree_assembly.motion.json.events.json`
- `physics/outputs/seedthree_tree_assembly.b3rec`
- `renders/seedthree_tree_assembly.mp4`
- `renders/seedthree_tree_assembly_contact.png`
- `renders/seedthree_tree_assembly.receipt.json`

The motion and event JSON are canonical evidence surfaces. The native `.b3rec`
is currently a replay-validation artifact, not a byte-reproducibility claim;
issue #56 tracks canonicalizing its serialization.

The receipt deliberately records the boundary: rigid box/joint contact is
real; the mesh attachment is a coarse height-band bridge; there is no branch
fracture, stress solve, or deformation feedback into Box3D yet.
