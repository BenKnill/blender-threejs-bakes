# Comb-through benchmark

Issue #95 adds the first small mechanical instrument to the hair-material lab:
a deterministic comb traverses 256 explicit guides after a short settling
period. The same fixed-step scene runs under dry, wet, and product-heavy
conditions.

Run it with:

```sh
just hair-comb-benchmark
```

The JSON output records stable state digests, wall time, clump release state,
peak relative stretch, comb travel, and reaction/work proxies. On the initial
M5 Mac run (2026-07-11), the observed results were:

| lane                            | runtime | peak reaction proxy | work proxy | clump releases | peak stretch | assumptions |
| ------------------------------- | ------: | ------------------: | ---------: | -------------: | -----------: | ----------- |
| dry, 5% moisture                |  1.33 s |              10,233 |     13,822 |            256 |        3.70% | satisfied   |
| wet, 85% moisture + 20% product |  2.04 s |               7,744 |     10,084 |            678 |        5.00% | satisfied   |

Times are observations, not golden thresholds. Digests and receipts are the
determinism/correctness surfaces. The measurement window begins when the comb
starts; initial mannequin settling is labeled `comb_settling` and is not folded
into the comb-pass peak.

The comb is a kinematic swept contact shell, not a calibrated comb model.
Reaction is summed unit-mass positional correction divided by `dt^2`; work is
that proxy times absolute comb travel. They are useful for A/B comparisons but
are not Newtons or Joules. The runtime assumption receipt separately reports:

- peak stretch at or below 3.5% during `comb_pass`;
- the production crowd-pressure coefficient 0.36 below its 0.5 design bound;
- nonnegative accumulated comb work.

`HAIR_COMB_WORK_ACCUMULATION_NONNEGATIVE` in `proofs/pair_constraint.ml`
proves the last scalar accumulation rule in HOL Light. The warm Workbench replay
is development evidence; cold audit remains the final-proof boundary.

## Three-condition material study

Issue #103 follows the research reports' recommendation to compare material
regimes before adding another heuristic. The benchmark now uses shared browser
and CLI definitions for dry (5% moisture), wet (85% moisture), and
product-heavy (35% moisture, 85% product) hair. The browser's **Run
three-condition study** button visibly replays all three lanes and fills a live
comparison table.

M5 observation on 2026-07-12:

| lane          | runtime |   peak |   work | releases | final bonds | reaction by travel third | peak stretch |
| ------------- | ------: | -----: | -----: | -------: | ----------: | ------------------------ | -----------: |
| dry           |  1.44 s | 10,053 | 13,830 |      260 |         610 | 13% / 38% / 48%          |       3.497% |
| wet           |  2.14 s |  8,463 | 11,483 |      330 |       3,455 | 15% / 38% / 48%          |       3.500% |
| product-heavy |  2.66 s |  7,571 |  8,909 |      834 |       4,576 | 13% / 31% / 56%          |       3.499% |

These are proxy observations, not calibration claims. They show that the
product-heavy response is dominated by persistent contact memory: it retains
about 7.5 times as many bonds as dry hair, releases about 3.2 times as many,
and shifts reaction later in the pass. The next operator target is therefore
bounded persistent-contact/cohesion telemetry, followed by an evidence-driven
force-law change if the contact-age trace supports one.

## Persistent-contact service receipt

Issue #105 adds bond ages and service accounting without changing the force
law or the deterministic state digests. On the same M5 run, final mean/max bond
ages were 84/170 steps dry, 157/180 wet, and 174/180 product-heavy. Age entries
matched the active bond sets in all lanes.

The current scheduler is exhaustive over a fixed bounded root-neighbor graph:
5,093 candidates are serviced every step and 763,950 during each measured comb
pass, with an observed service gap of exactly one step. The runtime receipt now
checks candidate capacity, bond/age consistency, and the one-step gap. These
facts make the next experiment concrete: retain every active persistent bond
as a hot contact while fairly scheduling discovery among unbonded candidates.
That future sparse schedule will require its own fairness theorem and A/B
comparison; this receipt does not pre-certify it.

`HAIR_PERSISTENT_CONTACT_AGE_MONOTONE` and
`HAIR_EXHAUSTIVE_CONTACT_SERVICE_GAP` state the present scalar contracts in HOL
Light. As elsewhere, the warm Workbench replay is development evidence rather
than a cold audit of the JavaScript implementation.

## Trace and margin follow-up

Issue #97 lowers the internal enforcement target to 3.5%, leaving a deliberate
half-point margin below the public 4% acceptance target. It also exports up to
128 deterministic force/displacement samples per pass. Each sample contains
comb position, cumulative displacement, reaction/work proxies, current stretch,
contacts, and cumulative clump events; longer experiments are deterministically
decimated and report their sample stride.

Initial M5 observations after the tighter solve:

| lane | runtime | digest             | samples | peak stretch |
| ---- | ------: | ------------------ | ------: | -----------: |
| dry  |  1.38 s | `30f2ac632a582b7d` |     121 |      3.4975% |
| wet  |  2.57 s | `e70416ee7c9a5fba` |     121 |      3.5000% |

The earlier wet run was about 2.05 seconds, so the added margin costs roughly
25% in this observation. Runtime remains a reported measurement rather than a
golden threshold.

## Visible two-pass cycle

Run `just hair-comb-cycle`, or press **Run wet two-pass** in the browser. The
comb moves outward, pauses, and returns through the same wet groom. The plot
uses cyan for the outward force-position leg and pink for the return leg. The
receipt records phase-specific projection work and their nonnegative
`cycle_dissipation_proxy`; this remains an A/B signal, not calibrated energy.

Initial M5 cycle observation: 5.40 m travel in 5.40 s, digest
`84286f894b527bf6`, outward/return work `9996 / 12342`, 122 retained samples at
stride 2, and 3.50% peak stretch. The unequal colored legs are the first
repeat-pass hysteresis result, not yet a calibrated material curve.

## Rotating-wind showcase

`just hair-wind-showcase` prints an autonomous URL intended for the narrow
preview window. It hides the editor panel, runs the two-pass comb without user
input, slowly orbits the camera, and continues afterward under a coherent wind
whose horizontal direction rotates continuously. A compass ring, arrow, flow
streaks, and compact HUD make the applied direction visible. The legacy scalar
wind remains the default unless `windRotation` or `windAngle` is requested.
