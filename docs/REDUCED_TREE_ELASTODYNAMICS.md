# Reduced-coordinate tree experiment

The supplied paper, [JGS2: Near Second-order Converging Jacobi/Gauss-Seidel for GPU Elastodynamics](https://arxiv.org/abs/2506.06494), is a general GPU solver for implicit FEM elastodynamics. It uses local subproblems, material-aware reduced perturbation spaces, and sparse Cubature samples to make a large deformable solve converge quickly. It is not a ready-made plant simulator, and reproducing the paper would mean tetrahedralizing the tree, defining a constitutive material, handling contacts, and writing a GPU solver.

This repository now has a deliberately smaller experiment:

- two damped generalized coordinates drive wind sway;
- a third hinge coordinate is held before a cut time, then released with a gravity-like torque;
- a height-weighted basis maps those coordinates onto the branch mesh and leaf-card objects;
- a cheap floor clamp prevents the visual canopy from tunneling through the ground.

Run it with:

```sh
./scripts/build_reduced_tree_animation.sh
```

Outputs are `renders/seedthree_tree_reduced.mp4`, its contact sheet, and a
`reduced-tree-motion-receipt/1` JSON receipt. This is a visual plausibility
prototype, not a FEM or JGS2 implementation. In particular it has no
material-aware local perturbation spaces and no trained sparse Cubature; the
receipt records those exclusions as machine-readable `false` fields. Box3D remains the right place for
rigid-body contacts and a future split trunk/branch assembly; this reduced model
is the deformable visual layer between those contacts and Blender rendering.
The follow-up articulated Box3D proof is documented in
[`SEEDTHREE_TREE_ASSEMBLY.md`](SEEDTHREE_TREE_ASSEMBLY.md); it uses six coarse
rigid bodies, five hinges, and small visual-only per-body modal states.

The local SeedThree source payload is not tracked by Git. On this machine the
manifest points to `/Users/boxer/blender-threejs-bakes/assets/source_blends/`
and its matching GLB.

## Why the leaves are squares

SeedThree intentionally uses base-anchored alpha cards for foliage. White Oak's
LOD0 uses one crossed pair of quads per leaf; the leaf texture supplies the
silhouette through alpha. The square outline is therefore an asset/style choice,
not a Blender import failure. The live SeedThree renderer also adds translucency,
dome normals, and wind, while the portable GLB export keeps only standard
materials and geometry. A closer hero asset would need a higher-fidelity leaf
mesh or a better alpha card, not a different physics setting.
