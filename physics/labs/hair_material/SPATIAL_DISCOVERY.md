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

| lane | fixed candidates | spatial AABB candidates | emitted | saturated segments | discovery |
| --- | ---: | ---: | ---: | ---: | ---: |
| dry | 5,093 | 34,702 | 20,000 | 1,627 | 87 ms |
| wet | 5,093 | 40,699 | 20,000 | 1,688 | 87 ms |
| product-heavy | 5,093 | 47,880 | 20,000 | 1,972 | 92 ms |

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
