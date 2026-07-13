# Two-orbit wind preview receipt

Issue: [#167](https://github.com/BenKnill/blender-threejs-bakes/issues/167)

## Diagnosis

The previous 450-step presentation lasted 7.5 seconds and rotated the wind at
0.58 rad/s. It therefore covered only 4.35 radians, or approximately 249
degrees, before resetting. Its first four seconds were also occupied by the
mechanical-guide and hydration presentation, leaving no complete wind orbit in
the hydrated view.

## Deterministic program

`hydrated_strong_then_moderate_full_orbits_v1` defines an explicit 1,020-step
sequence at 60 Hz:

- steps 0-239: calm mechanics/hydration setup at magnitude 0.12;
- steps 240-599: strong magnitude 0.58 while the direction advances exactly
  `2 * pi` radians;
- steps 600-959: moderate magnitude 0.29 while the direction advances exactly
  another `2 * pi` radians;
- steps 960-1019: hold the completed direction while the renderer fades before
  resetting.

The showcase HUD names `STRONG` or `MODERATE` and reports the current orbit
percentage, direction in degrees, and magnitude. Ordinary fixed/gusting wind
replays remain available when `windProgram` is absent. The canonical control
camera is fixed for both orbits, so the model and lighting do not drift while
the wind response is being compared.

## Mechanics receipt

The canonical 256-guide, 12-segment, six-iteration, wavy fixture uses 35%
wetness, 45% product, the styled side-part root field, and the section-pose
cycle. Two complete 1,020-step runs repeat at digest
`9c5a319aa70970b5`.

After the defined startup transient, maximum observed live stretch is 3.4998%
at step 928 and final live stretch is 3.1758%. Quarter-orbit guide-tip motion
is:

- strong: 144.8, 78.8, 67.6, and 55.2 mm RMS;
- moderate: 45.9, 27.1, 28.9, and 25.5 mm RMS.

The first strong and moderate quarters include transition response. The settled
quarters establish the intended approximately twofold visual separation. The
full fixture took 11-14 seconds per run in single-process Node observations;
this is not browser frame cost.

## Claim boundary

The labels describe two relative, uncalibrated solver force levels, not a wind
speed in physical units. The exact angular schedule and deterministic digest
are portable claims. Visual legibility and render cost remain browser-preview
observations.
