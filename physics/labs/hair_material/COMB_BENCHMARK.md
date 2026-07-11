# Comb-through benchmark

Issue #95 adds the first small mechanical instrument to the hair-material lab:
a deterministic comb traverses 256 explicit guides after a short settling
period. The same fixed-step scene runs under dry and wet/product conditions.

Run it with:

```sh
just hair-comb-benchmark
```

The JSON output records stable state digests, wall time, clump release state,
peak relative stretch, comb travel, and reaction/work proxies. On the initial
M5 Mac run (2026-07-11), the observed results were:

| lane | runtime | peak reaction proxy | work proxy | clump releases | peak stretch | assumptions |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| dry, 5% moisture | 1.33 s | 10,233 | 13,822 | 256 | 3.70% | satisfied |
| wet, 85% moisture + 20% product | 2.04 s | 7,744 | 10,084 | 678 | 5.00% | satisfied |

Times are observations, not golden thresholds. Digests and receipts are the
determinism/correctness surfaces. The measurement window begins when the comb
starts; initial mannequin settling is labeled `comb_settling` and is not folded
into the comb-pass peak.

The comb is a kinematic swept contact shell, not a calibrated comb model.
Reaction is summed unit-mass positional correction divided by `dt^2`; work is
that proxy times absolute comb travel. They are useful for A/B comparisons but
are not Newtons or Joules. The runtime assumption receipt separately reports:

- peak stretch at or below 5% during `comb_pass`;
- the production crowd-pressure coefficient 0.36 below its 0.5 design bound;
- nonnegative accumulated comb work.

`HAIR_COMB_WORK_ACCUMULATION_NONNEGATIVE` in `proofs/pair_constraint.ml`
proves the last scalar accumulation rule in HOL Light. The warm Workbench replay
is development evidence; cold audit remains the final-proof boundary.

## Trace and margin follow-up

Issue #97 lowers the internal enforcement target to 3.5%, leaving a deliberate
half-point margin below the public 4% acceptance target. It also exports up to
128 deterministic force/displacement samples per pass. Each sample contains
comb position, cumulative displacement, reaction/work proxies, current stretch,
contacts, and cumulative clump events; longer experiments are deterministically
decimated and report their sample stride.

Initial M5 observations after the tighter solve:

| lane | runtime | digest | samples | peak stretch |
| --- | ---: | --- | ---: | ---: |
| dry | 1.38 s | `30f2ac632a582b7d` | 121 | 3.4975% |
| wet | 2.57 s | `e70416ee7c9a5fba` | 121 | 3.5000% |

The earlier wet run was about 2.05 seconds, so the added margin costs roughly
25% in this observation. Runtime remains a reported measurement rather than a
golden threshold.
