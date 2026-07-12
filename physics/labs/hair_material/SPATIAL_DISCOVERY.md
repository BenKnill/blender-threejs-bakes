# Spatial contact discovery experiment

Issue #107 compares a deterministic spatial candidate set with the existing
fixed root-neighbor graph. This PR is discovery-only: spatial pairs do not yet
drive friction, pressure, cohesion, or rendering, so the mechanical replay
digests must remain unchanged.

Run:

```sh
just hair-contact-discovery
```

Each active guide segment is inserted into every fixed 3D cell overlapped by
its padded AABB. Shared-cell pairs are filtered by padded-AABB overlap,
canonicalized, sorted, deduplicated, and then subjected to explicit per-segment
and global budgets. Midpoint-only insertion is deliberately not used because
it can miss long segments crossing cell boundaries.

## Initial M5 observation

Parameters: 3,072 active segments, 0.24 m cells, 0.04 m AABB padding, at most
16 emitted pairs per segment and 20,000 pairs globally.

| lane          | fixed candidates | spatial AABB candidates | emitted | saturated segments | discovery |
| ------------- | ---------------: | ----------------------: | ------: | -----------------: | --------: |
| dry           |            5,093 |                  34,702 |  20,000 |              1,627 |     87 ms |
| wet           |            5,093 |                  40,699 |  20,000 |              1,688 |     87 ms |
| product-heavy |            5,093 |                  47,880 |  20,000 |              1,972 |     92 ms |

Times are observations, not thresholds. The result falsifies the idea that a
spatial hash alone is a cheap drop-in replacement: it discovers many more
plausible mid-length neighbors, and every lane saturates the provisional
budget. It is still far below the roughly 4.7 million all-pairs segment set.
The next experiment must rank/cap candidates and preserve hot persistent bonds;
silently feeding all spatial candidates into every solver pass would be a
regression.

Tests cover stable ordering under reversed input, a mid-shaft crossing whose
segments span several cells, explicit budget saturation, and exclusion of cut
segments. `HAIR_SPATIAL_AABB_CELL_INTERVAL_COVERS_POINT` supplies a narrow
real-interval support lemma in HOL Light. It does not prove JavaScript floor
semantics, floating-point AABB construction, budget fairness, contact response,
or visual realism.

## External review receipt

Grok recommended this spatial-first experiment over round-robin service of the
known-incomplete fixed graph. Its full response is archived locally at
`attachments/20260712T141516Z-grok-issue-107-review.md`. The requested Fable
review could not run because Claude Code reported that subscription access had
been disabled for the logged-in organization; the exact blocker is archived at
`attachments/20260712T141516Z-fable-issue-107-review.md`. No Fable opinion is
inferred from that failure.

## Ranked admission follow-up

Issue #109 removes the provisional discovery cap, reserves every active
persistent bond first, and ranks new spatial pairs by quantized unpadded-AABB
gap with canonical pair ids. A 20,000-pair global capacity and 16-new-pairs per
segment capacity apply only after persistent reservation. Spatial pairs remain
force-free.

Initial M5 observation:

| lane          | persistent retained | new spatial admitted | global drops | per-segment drops | global frontier in/out |
| ------------- | ------------------: | -------------------: | -----------: | ----------------: | ---------------------: |
| dry           |           610 / 610 |               19,390 |        3,637 |            11,066 |      420,664 / 420,720 |
| wet           |       3,455 / 3,455 |               16,545 |        7,797 |            13,022 |      249,330 / 249,404 |
| product-heavy |       4,576 / 4,576 |               15,424 |       14,531 |            13,606 |      140,841 / 140,854 |

The global frontier is ordered correctly: the worst globally admitted spatial
risk is still lower than the best pair dropped only by the global capacity.
However, the best pair rejected by the per-segment quota has AABB risk zero in
all lanes. Dense, skew segments create many overlapping boxes that this risk
cannot distinguish. This falsifies force integration: the next experiment must
rank those ties by deterministic segment–segment closest distance rather than
loosening capacity or allowing arbitrary frontier flicker.

The receipt includes the persistent/spatial partition, both drop causes,
frontier risks, an admitted-pair digest, persistent overflow state, and an
explicit `spatial_force_integration: false` gate. Grok's complete Issue #109
review is archived locally at
`attachments/20260712T143038Z-grok-issue-109-review.md`. Fable was not retried
after the user confirmed they would repair its account access later.

## Closest-segment ranking follow-up

Issue #111 replaces the AABB-gap ranking key with the squared closest distance
between the two finite guide segments. The implementation handles degenerate
point segments, parallel and nearly parallel segments, and clamped endpoint
solutions before quantizing the squared distance. Canonical segment-pair ids
remain the final deterministic tie-breaker. The old and new rankers consume
the same unbounded discovery result in one dual-pass receipt; spatial forces
remain disabled.

Initial M5 observation:

| lane          | candidates | persistent retained | AABB zero-risk quota drops | closest zero-risk quota drops | discovery | AABB rank | closest rank |
| ------------- | ---------: | ------------------: | -------------------------: | ----------------------------: | --------: | --------: | -----------: |
| dry           |     34,702 |           610 / 610 |                          6 |                             0 |    114 ms |     35 ms |        36 ms |
| wet           |     40,699 |       3,455 / 3,455 |                          5 |                             0 |    106 ms |     29 ms |        33 ms |
| product-heavy |     47,880 |       4,576 / 4,576 |                         40 |                             0 |    114 ms |     58 ms |        41 ms |

Times are single observations, not thresholds. Closest-distance ranking clears
the stated tie falsifier in all three lanes while retaining every persistent
bond. Mechanical replay digests remain `30f2ac632a582b7d`,
`fcb9bcfb1123a02a`, and `8d3a5a2be7d13fbc`, confirming that the experiment is
still discovery-only. This is enough to adopt the better ranking metric, but
not enough to enable forces: the admitted set could still flicker around the
capacity frontier as the hair moves.

Tests cover crossing, point-point, point-segment, parallel and reversed
segments, quantization monotonicity, symmetry, and a quota fixture that must
retain the three nearest neighbors. `HAIR_SQUARED_SEPARATION_NONNEGATIVE`
proves only the real-arithmetic nonnegativity of the squared separation used by
the ideal metric; it does not verify JavaScript floating point, clamping,
degeneracy handling, quantization, or physical contact completeness.

Grok's full Issue #111 review is archived locally at
`attachments/20260712T143738Z-grok-issue-111-review.md`. Fable was not retried
after the user asked us to continue while they repair its access.

## Temporal churn follow-up

Issue #113 samples the closest-distance ranker in consecutive-frame clusters
around comb start, mid-pass, exit, diagonal-cut onset/sweep, and post-cut
settling. The default `hair-contact-churn/1` receipt contains counts, set
metrics, and digests only; it deliberately omits admitted pair payloads. Wide
sample gaps are retained for trajectory context but do not decide whether the
rank frontier flickers.

Adjacent-frame observation on the M5:

| fixture       | samples | minimum Jaccard | mean Jaccard | worst churn | max additions/removals |
| ------------- | ------: | --------------: | ------------: | ----------: | ---------------------: |
| dry comb      |      11 |           0.933 |         0.948 |        6.7% |              691 / 691 |
| wet comb      |      11 |           0.948 |         0.962 |        5.2% |              579 / 458 |
| product comb  |      11 |           0.968 |         0.977 |        3.2% |              328 / 328 |
| product cut   |      14 |           0.959 |         0.980 |        4.1% |              423 / 423 |

All four traces reproduce bit-identical whole-trace digests on a complete
rerun, match the ordinary mechanical replay at the final step, retain every
active persistent bond, drop no quantized zero-risk pair, and keep
`spatial_force_integration: false`. During the three adjacent cut clusters,
778 removals touch newly inactive segments versus 392 removals whose two
segments remain active, so topology-local removal dominates rather than
causing wholesale unrelated replacement.

The closest-ranked set therefore clears the review's Jaccard-at-least-0.9 gate
for a cautious low-count force A/B. This is not a license to turn on all 20,000
contacts: dry hair's 6.7% worst adjacent churn exceeds the alternate 5% target
and must remain visible in the next receipt. The next experiment should apply
response only to a strict interior subset, such as a very small per-segment
count or a distance threshold well inside the admitted frontier.

`HAIR_CONTACT_CHURN_CURRENT_PARTITION` supports the finite-set cardinality
identity checked by the transition receipt. It does not verify JavaScript Set
semantics, hashing, ranking, floating point, or contact physics. Grok's
interrupted inspection and successfully resumed final review are archived
together at `attachments/20260712T144729Z-grok-issue-113-review.md`. Fable
remains paused while the user repairs its account access.

## K=1 spatial-friction follow-up

Issue #115 turns only anisotropic friction on for a strict one-contact-per-
segment matching. The feature is off by default, fixed-graph guide pairs are
excluded to avoid double service, and spatial pressure and cohesion remain
disabled. Contact-point velocities and equal-and-opposite corrections use the
closest-point barycentric coordinates on the two finite segments.

A first global rerank every eight steps was deterministic and stretch-safe but
failed the temporal gate: minimum active Jaccard was only 0.224/0.286/0.372 for
dry/wet/product and 0.068 through the cut. The accepted policy retains prior
contacts that remain active and inside the same narrowphase contact radius,
then ranks new candidates only for unmatched segments. It adds no enlarged
release radius. Broadphase discovery remains authoritative for births;
narrowphase distance is authoritative for retaining an already serviced pair.

Final M5 observation at 256 guides and 12 segments:

| fixture       | minimum active Jaccard | retained / added / removed | impulse proxy | control / treatment |
| ------------- | ---------------------: | -------------------------: | ------------: | ------------------: |
| dry comb      |                  0.903 |      21,465 / 787 / 384 |        15.762 |       1.67 / 3.60 s |
| wet comb      |                  0.940 |      22,780 / 411 / 159 |        19.847 |       2.01 / 4.35 s |
| product comb  |                  0.981 |       24,340 / 178 / 67 |        17.128 |       2.75 / 5.73 s |
| product cut   |                  0.789 |      32,752 / 1,705 / 977 |        29.190 |       3.67 / 7.19 s |

Times are single observations, not thresholds. Explicit-off matches ordinary
replay, treatment reruns are bit-identical, each treatment changes the
mechanical digest and has nonzero impulse, and every comb treatment satisfies
the existing stretch gate. The cut fixture has the same 31.742% peak stretch
in control and treatment, so its pre-existing stretch failure remains red even
though spatial friction adds exactly zero stretch delta.

The runtime result is deliberately modest: the experiment roughly doubles
wall time and spends about 1.7--2.2 s of each comb treatment in refreshes. This
is acceptable for an off-default experiment, not evidence to enable it in the
hero browser. The next useful comparison is a small explicit-guide rod oracle,
not more contact operators.

`HAIR_BARYCENTRIC_ENDPOINT_EXCHANGE_PRESERVES_SUM` proves the ideal real-
arithmetic endpoint-distribution sum for one equal-and-opposite exchange. It
does not verify JavaScript floating point, candidate discovery, graph overlap
exclusion, temporal matching, cutting, or visual realism. Grok's Workbench and
Issue #115 review is archived locally at
`attachments/20260712T150647Z-grok-workbench-and-issue-115-review.md`.
