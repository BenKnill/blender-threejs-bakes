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
