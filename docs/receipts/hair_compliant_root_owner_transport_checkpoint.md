# Compliant root and owner-transport hydration checkpoint

Issue: [#187](https://github.com/BenKnill/blender-threejs-bakes/issues/187)

This checkpoint replaces the 8-link scalp fixture's abrupt 6.0 / 2.4 / 1.35 Hz
root profile and 12 / 32 / 75 degree cone profile with twelve shorter uniform
links and a 3.8 / 2.5 / 1.8 / 1.4 / 1.1 Hz compliance ramp. The matching cone
ramp is 10 / 28 / 50 / 68 / 78 degrees. Total guide length is unchanged.

The deterministic 64-guide native A/B passed. The former accepted clip reported
minimum / mean target alignment 0.941 / 0.960 and minimum / mean outward
alignment 0.255 / 0.458. The compliant fixture reports 0.927 / 0.958 and
0.248 / 0.459 respectively. Settled joint gap is 12.13 mm. Strong / moderate
mean horizontal tip displacement is 1.192 / 0.641 m. Deterministic digest is
`6419d6ab3a45d6dd`.

The 256-guide fixture also repeats and passes with 3,072 capsules and joints.
Its settled gap is 14.17 mm against an explicit 15.5 mm bound; minimum / mean
target alignment is 0.900 / 0.961 and minimum / mean outward alignment is
0.211 / 0.473. Strong / moderate mean displacement is 1.135 / 0.579 m and the
stiction digest is `eb53b6e105f6e58d`.

Browser hydration now keeps each child on its owner guide's translated path and
admits only an 18% donor-shape correction bounded to 55 mm. The separate root
coverage stroke is shortened from 240 to 140 mm, retains at least 0.32 outward
normal alignment, and narrows its angular scatter.

Chrome Canary then exercised the 256-guide clip in mechanical, hydrated,
strong-wind, and moderate-wind states at 960 x 900. It reported no JavaScript
exceptions or console errors. Across 169 measured hydrated geometry updates,
cost was 31.36 ms mean / 65 ms p99 / 81 ms maximum. The hydrated binding has
5,376 children; only two short root-transition copies per guide are added, for
512 transition strands rather than a second full-density layer.

The visual claim is deliberately bounded. The shorter joints make the
mechanical fixture read as a compliant fan instead of a rigid root lever, and
owner-relative transport removes the worst long cross-guide chords while
preserving collective wind motion. The result is still stylized line-based
hydration, remains spiky around parts of the crown, and has no hydrated-fiber to
head collision. Those are follow-up work, not properties established here.
