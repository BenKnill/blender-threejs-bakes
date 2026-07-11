# Anisotropic hair phase-space videos

Issue: [#88](https://github.com/BenKnill/blender-threejs-bakes/issues/88)

The first film set exercises ten deliberately different regions of the hair
material bench rather than presenting one preferred tune. The tracked scenario
manifest is `docs/receipts/hair_phase_space_scenarios.json`. Each URL sets the
real interactive lab through query parameters, including the visible scenario
name, preset, wetness, product, lift, wind, and solver iterations.

The local generated shelf is:

```text
physics/outputs/hair_phase_space_20260711T1650Z/
```

It contains ten four-second 1280x720 H.264 clips, each scenario's 48 source
frames and terminal telemetry sidecar, plus a synchronized 1920x432 ten-up film:

```text
hair_phase_space_contact_sheet.mp4
```

Generated media remains ignored by git. To repackage a compatible captured
frame shelf:

```sh
just hair-phase-videos physics/outputs/hair_phase_space_20260711T1650Z
```

## What the set probes

- dry wavy axial slip;
- wet wavy clump connectivity;
- product-stiffened lifted styling;
- high-wind hysteretic breakup;
- dry curly transverse shear;
- wet curly lock formation;
- product-heavy coily recovery;
- straight wet-sheet failure behavior;
- an extreme wet/product/wind coily mixture; and
- a maximum-cohesion density-pressure stress case.

The most useful comparison is loose dry wavy hair at roughly 5,525 terminal
bonds against the dense cases at roughly 9,400--10,037 bonds. Crowd-pressure
activity rose from zero in the loose case to 70 corrections in the coily
product-hold case. The maximum-density case reached 12.63% stretch and 34
displayed frames/s, correctly marking it as a stress/failure probe rather than
a recommended realtime configuration.

## Evidence boundary

These films are qualitative browser observations. Their displayed frame rate is
affected by simultaneous screenshot capture, and the source-frame timing is
wall-clock sampling rather than a deterministic offline stepping clock. The
tracked manifest makes material configurations reproducible; it does not make
pixel trajectories bit-reproducible. The HOL Light Workbench claims apply to
the internal pair-exchange and threshold rules, not to the rendered videos or
the JavaScript implementation as a whole.

Before publication, the five underlying hair-rule theorems were replayed through
the live OrbStack CRIU `light` shelf. Restore/reuse took 0.000 seconds and the
warm semantic attempt succeeded in 0.4 seconds. This is development evidence;
the films themselves are not theorem evidence.
