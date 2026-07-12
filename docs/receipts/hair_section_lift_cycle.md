# Deterministic section lift-cycle receipt

Issue: [#136](https://github.com/BenKnill/blender-threejs-bakes/issues/136)

## Question

Can the styled volume groom repeat the convincing full silhouettes seen only
intermittently in the wind preview, then release back into comb/cut motion,
without freezing the groom or hiding a stretch/performance regression?

## Operator and choreography

- The selected front section targets particle 6 of each 12-segment guide.
- Lift rises from steps 30–89, holds at 0.24 m for steps 90–154, releases during
  steps 155–229, and is zero afterward.
- Step 30 is also the start of the existing comb-cycle measurement window, so
  the entire nonzero lift pulse is inside the reported peak-stretch interval.
- A 0.18 total step blend is distributed across six solver iterations:
  `1 - (1 - 0.18)^(1 / 6) = 0.0325341544` per iteration.
- Correction distance is a sum of solver-position corrections. It is not
  calibrated work or force.

The first implementation applied 0.18 in every iteration. At the held checkpoint
it accumulated 5.088 correction-distance units and produced roughly 48 ms
smoothed solver cost in the browser. The compliant form reduces that checkpoint
to 2.529 units and observed 14.95 ms active-phase smoothed solver cost.

## Production mechanical gate

Fixture: 256 guides, 12 segments, six iterations, wavy preset, 35% wetness, 45%
product, styled side-part root field, rotating wind, two-pass comb, 0.24 m lift
cycle, and a complete diagonal cut at step 420.

| Lane | Final digest | Peak stretch | Final stretch | Cuts |
| --- | --- | ---: | ---: | ---: |
| No lift cycle | `6a0294d4bf085310` | 3.496% | — | 256 |
| Lift cycle | `4c7b4af505e0e011` | 3.499% | 3.063% | 256 |
| Repeated lift cycle | `4c7b4af505e0e011` | 3.499% | 3.063% | 256 |

The solver resets its peak ledger when the comb cycle begins. Initial settling
before step 30 is therefore not relabeled as part of the lift claim. Small-guide
unit fixtures cover envelope math and determinism, but the 3.5% peak gate belongs
to this explicit 256-guide run.

## Fixed 560x720 browser checkpoints

| Step | Phase | Target | Physics digest | Position-buffer digest | Current stretch |
| ---: | --- | ---: | --- | --- | ---: |
| 91 | hold | 0.24 m | `240e8ed4342bc5f0` | `5f0a9ab9` | 3.25% |
| 231 | released | 0 m | `f33b3a28735bf63b` | `0e2a4e2e` | 3.47% |
| 420 | released, cut complete | 0 m | `4c7b4af505e0e011` | `faec1a23` | 3.06% |

The held frame reads as a fuller moving section; the released frame retains a
cohesive long silhouette rather than snapping to a static pose; the finished
cut preserves all 26,884 donor-fade draw primitives.

One single-tab active-phase observation collected 126 render updates and
reported 2.4 ms geometry p99 / 3.2 ms max with 14.95 ms smoothed solver cost.
These timings and pixels are browser observations; fixed digests are the
semantic receipts.

## Commands

- `just hair-section-lift-ab`
- `just hair-lift-showcase`
- `just lint`
- `just test`

No HOL theorem is added. The slice orchestrates an existing bounded constraint;
its new claims are the executable envelope, iteration-normalized stiffness,
telemetry, determinism, and bounded production replay.
