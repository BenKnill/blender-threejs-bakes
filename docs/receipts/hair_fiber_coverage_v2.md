# Hair fiber coverage v2 receipt

Issue: [#149](https://github.com/BenKnill/blender-threejs-bakes/issues/149)

## Screenshot diagnosis

The same deterministic beauty fixture was inspected at 560 x 720 and
1280 x 720 before and after the renderer change. The old 15-fiber screenshot
had a convincing overall mass at preview size, but close inspection showed the
same failures repeatedly:

- all child fibers were fully wide and opaque at a shared guide root, creating
  rectangular crown ladders;
- independent segment quads accumulated dark coverage at every joint;
- the opaque children hid a smooth solid undercoat with a helmet-like hairline;
- root half-width 1.22 px and tip half-width 0.20 px read as cards rather than
  fine fibers.

The new screenshots remove most of the rectangular root mass, reveal a clearer
side part, preserve a dense outer silhouette at 21 children, and soften the
undercoat enough for scalp to show through. They do not yet look like realistic
hair. The remaining dominant failures are now easier to identify: front
sections fall as a uniform veil over the face, sharp bends still expose the
12-segment guide topology, and the long right-side clump terminates as a pointed
sheet. Those are groom/control and topology problems, not reasons to make the
cards opaque again.

## Renderer identity

- Field: `tangent_dual_lobe_root_emergence_v2`
- Root/tip half-width: 0.84 px / 0.07 px
- Owner root: zero-width scalp origin, effectively full by segment 1
- Child roots: deterministic smooth emergence over approximately 4-27% of
  active strand length
- Cross-section: soft analytic alpha coverage
- Joints: half coverage at segment endpoints, full coverage at segment center
- Undercoat: polar crop 1.02 radians, 28% opacity, no depth write
- Hero density: 256 guides x 21 fibers = 5,376 visible fibers

The render receipt now hashes color and width buffers in addition to positions:

| Buffer       | Fixed-step digest |
| ------------ | ----------------- |
| Positions    | `03bd29bb`        |
| Colors       | `a6ef84a3`        |
| Start widths | `b257ebcb`        |
| End widths   | `06dd4fcf`        |

## Correctness and cost

At fixed beauty step 90:

- physics digest: `1b50f30cdfdff721`, unchanged from the earlier 15-fiber
  realistic-head fixture;
- active draw primitives: 64,512;
- geometry mean / p99 / max: 2.26 / 2.80 / 2.90 ms over 292 measured frames in
  one 560 x 720 browser observation;
- mannequin: `realistic_ready`;
- collision authority: unchanged analytic ellipsoid.

A separate 1280 x 720 step-225 observation reported 1.73 ms mean, 2.00 ms p99,
and 2.20 ms maximum geometry update over 262 measured frames. These are
single-browser observations, not portable performance promises.

The 1280 x 720 cut shot at step 360 retained the measured 3.39% stretch gate
pass, physics digest `56ac4a719ff8e34d`, 56,236 active draw primitives, and
2.80 ms geometry p99. The shorter shape is clearer with soft coverage, while
the pointed right-side clump is now an explicit next-groom defect.

## Claim boundary and next visual operator

This is a better real-time coverage approximation, not a Disney production
hair renderer. It has no deep-opacity maps, order-independent transparency,
strand self-shadowing, elliptic cross-sections, or per-fiber mechanical state.
The next visible gain should redirect and group the face-crossing front sections
with an explicit groom control, then address the pointed sheet-like clump ends.
Increasing opacity or restoring the old shared-root cards would conceal those
problems without solving them.
