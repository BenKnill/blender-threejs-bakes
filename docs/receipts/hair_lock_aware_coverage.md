# Lock-aware scalp coverage receipt

Issue: [#157](https://github.com/BenKnill/blender-threejs-bakes/issues/157)

## Diagnosed failures

The hydrated renderer had three coupled coverage errors:

1. child roots were blended in Cartesian space, which moves points inside a
   convex scalp even when both parents lie on its surface;
2. twelve independent screen-space quads made each mechanical link readable as
   a ribbon ladder at sharp bends;
3. one smooth undercoat shell hid sparse areas as a helmet instead of supplying
   a broken shadow beneath visible locks.

At the canonical 256-guide x 21-fiber density, 5,120 of 5,376 blended roots
were inside the analytic ellipsoid before projection. The deepest normalized
ellipsoid radius was 0.9960968, or roughly a few millimeters below this demo's
scalp shell. That small error is enough for the realistic head and undercoat to
win the depth test.

## Hydrated renderer

`styled_root_cover_locks_catmull_rom_v2` makes four renderer-only changes:

- every blended child root is radially projected onto the 45 mm analytic scalp
  shell with identity `ellipsoid_shell_radial_v1`;
- every mechanical link is evaluated as two Catmull-Rom spans while retaining
  exact solver points at link boundaries;
- each of the 5,376 distributed roots grows a deterministic three-span, nominal
  0.24 m coverage lock along the styled root tangent, with bounded cross-lock
  spread and positive outward lift;
- the solid cap becomes three density-broken shadow layers with opacities
  0.50 / 0.16 / 0.05.

The uncut canonical fixture therefore draws 129,024 curved solver spans plus
16,128 short coverage spans, or 145,152 screen-space primitives. The coverage
locks add 12.5% to the curved solver-span count; they do not add simulated
particles or constraints.

## Placement and mechanics gates

The canonical root audit reports:

- hydrated bindings: 5,376;
- roots inside the shell before projection: 5,120;
- maximum projected shell error: `4.44e-16` normalized radius;
- minimum outward clearance over all coverage-lock control points: 0.011088 m.

The 330-step styled-root replay remains byte deterministic at digest
`810dcc040586fc06`, completes all 256 cuts, and peaks at 3.4995% relative
stretch. `just test`, `just lint`, and the Pages bundle test pass.

## Claim boundary

This is a hydration and coverage operator, not added hair mechanics. The rods,
joints, contact graph, state digest, and stretch behavior are unchanged. The
short coverage locks read the simulated roots and styled tangent field but do
not write solver state. The analytic ellipsoid is still an authored collision
proxy rather than mesh-fitted human scalp geometry, and the real-time fiber
material still lacks production deep-opacity shadows and order-independent
transparency.
