# Hero-density moving haircut films

Issue: [#90](https://github.com/BenKnill/blender-threejs-bakes/issues/90)

This second film set moves beyond the static phase survey. Every shot runs 768
mechanical guides and 11,520--16,128 visible fibers, or 9,984 simulated
particles. The camera orbits, wind receives a sinusoidal gust envelope, and the
real solver topology changes during the recorded shot.

The generated local shelf is:

```text
physics/outputs/hair_hero_cuts_20260711T1710Z/
```

The capture initially produced eight seven-second 1280x720 H.264 clips, 84
source frames and a terminal telemetry sidecar per scenario, plus a synchronized
four-by-two comparison:

```text
hair_hero_cut_contact_sheet.mp4
```

The tracked configuration manifest is
`docs/receipts/hair_hero_cut_scenarios.json`. Large media remains ignored by
git. After a successful encode, packaging deletes source frames and all
individual clips unless one representative scenario is named. This keeps the
comparison, manifests and telemetry while making experimental shelves cheap to
replace. Repackage a compatible captured shelf with:

```sh
COLUMNS=4 OUTPUT_NAME=hair_hero_cut_contact_sheet.mp4 \
  RETAIN_SCENARIO=01_wavy_diagonal_gust \
  just hair-phase-videos physics/outputs/hair_hero_cuts_20260711T1710Z
```

Set `KEEP_SOURCE_FRAMES=1` only while debugging capture. Omitting
`RETAIN_SCENARIO` retains no individual clips. The command prints the final
file count and shelf size so an experiment cannot silently leave a frame dump
behind.

## Choreography

The films deliberately preserve three phases: intact groom motion, a visible
cut event, and post-cut relaxation. Bob shots perform one horizontal topology
change. Diagonal shots sweep across root x over 1.8--2.5 seconds and map
normalized root position `x` to the pre-rounding strand fraction
`0.78 - 0.38 x`, leaving a long-to-short asymmetric silhouette.

The set covers loose and wet waves, lifted product styling, dry and wet curls,
coily recovery, a straight storm bob, and an extreme dense cut. Diagonal shots
visit all 768 guides; bob intersections cut 688--766 guides depending on the
moving geometry. The curly shear cut ended with 108 crowd-pressure corrections,
while most wavy cuts remained in single digits.

## Workbench lane and boundary

The existing five collective-rule claims plus the new diagonal-cut fraction
bound were observed through the OrbStack CRIU `light` shelf in a 0.4-second warm
semantic attempt. The new theorem establishes that normalized cuts stay between
40% and 78% of strand length before segment rounding. A cold audit was launched
detached and is not claimed complete here.

The films are qualitative browser experiments, not calibrated haircut
predictions. Screenshot capture affects displayed fps, captured frames use
wall-clock sampling, and the HOL claims do not prove the JavaScript renderer or
pixel trajectory.
