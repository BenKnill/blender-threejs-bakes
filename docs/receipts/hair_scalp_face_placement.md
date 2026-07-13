# Scalp placement and face-clear groom receipt

Issue: [#151](https://github.com/BenKnill/blender-threejs-bakes/issues/151)

## Diagnosed failures

The browser screenshots exposed three separate faults rather than a generic
"needs more hair" problem:

1. roots used one uniform polar cap extending to 1.28 radians (73 degrees), so
   center-front anchors could reach the visible forehead;
2. every styled section had a positive X bias, pulling much of the crown to one
   side and opening an oversized central gap;
3. the replacement density cap had inward triangle winding and sat inside the
   realistic GLB, so back-face culling and depth occlusion removed the intended
   crown coverage.

## Current placement fields

- scalp layout: `face_hairline_ellipsoid_v1`;
- root surface offset: 0.045 m outside the analytic ellipsoid;
- front-center maximum observed polar angle: 1.046 radians;
- crown guides (`normalY >= 0.8`): 66 / 256;
- front-center guides in the placement receipt: 47 / 256;
- styled root field: `face_clear_side_part_crown_v2`;
- minimum target outward dot: 0.465;
- mean target tangential magnitude: 0.812;
- mean first-segment target alignment in the fixed browser fixture: 0.981.

Crown roots now flow backward with lift. Frontal roots receive lateral/backward
targets. The side and rear polar reach remains deeper than the central forehead
boundary.

## Mid-shaft face clearance

`front_midshaft_rest_projection_v1` selects 64 front-center guides and applies
a per-iteration distributed 0.12 step strength over particles spanning 22-68%
of guide length. Its analytic target is outside a 0.58 m cheek half-width and
behind `z=0.24 m`. `faceClear=0` disables only this operator for A/B checks.

The tracked 180-step comb A/B reports:

| Mode           | Digest             | Peak measured stretch |
| -------------- | ------------------ | --------------------: |
| disabled       | `f594c1354cc42ccc` |               3.4825% |
| enabled        | `bad7957fcc2e2976` |               3.4993% |
| enabled repeat | `bad7957fcc2e2976` |               3.4993% |

The existing 420-step section-pose, two-pass comb, rotating-wind, and diagonal
cut gate repeats at `b1e6b723267c19fc`, completes all 256 cuts, and peaks at
3.4997% stretch.

## Browser inspection

At fixed step 120 in the 560 x 720 beauty fixture, face-clear off reports
physics digest `95d1d6154fe6e857`; enabled reports `15462703fc86d2c9` and
visibly moves the central veil outside the face. The rod view reports no browser
warnings or errors and makes the revised root positions and first-segment
directions explicit.

The off/on/rod screenshots are preserved in the gitignored local shelf at
`attachments/20260712-scalp-face-placement/`.

## Renderer correction

The hairline-matched ellipsoid cap now has outward triangle winding, sits 6 mm
inside the root surface, and renders at 62% opacity. Crown child fibers use an
earlier emergence envelope than side fibers. This is density support, not a
substitute for the corrected anchors.

## Claim boundary

The hairline and face volume are analytic authored proxies fitted to this demo
mannequin. The face-clear operator is not strand/mesh collision, and the 45 mm
root offset is not a measured human follicle depth. The visible hairline remains
coarse and the groom still lacks production self-shadowing, transparency, and
artist-authored per-lock topology.
