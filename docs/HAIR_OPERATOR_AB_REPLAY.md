# Deterministic hair-operator comparison

Issue: [#92](https://github.com/BenKnill/blender-threejs-bakes/issues/92)

This is the first falsifying film for the directed-porous-fluid approximation.
Both lanes use the same 256-guide wavy groom, 3,840 visible fibers, 60 Hz fixed
simulation step, 80% wetness, 65% product, gust, and traveling diagonal cut.
The pink lane enables anisotropic friction, hysteretic clumps, cohesion, and
crowd pressure; the blue lane disables all four collective operators.

The local disposable artifact is:

```text
physics/outputs/hair_operator_ab_20260711T1808Z/hair_operator_ab_comparison.mp4
```

It is a 4.08-second, 544x216 H.264 two-up film. The 98 browser captures occupied
6.3 MiB before packaging. The self-pruning packager retained the 75 KiB
comparison plus two compact sidecars and deleted every source frame and
intermediate clip.

## Result

The enabled lane retains a visibly more compact, collectively moving wet groom;
the disabled lane separates into a looser curtain. Final semantic digests were:

- operators on: `547042f48fd25cad`;
- operators off: `2ec97438e6a4e9dc`.

Node and browser produced the same digests after positions were quantized to
`1e-6` world units. Raw floating-point byte hashes did not match across engines,
which is why the receipt claims semantic replay rather than bitwise cross-engine
identity.

The comparison also found a real stress signal: maximum relative stretch was
8.38% with collective operators and 1.18% without them. The film therefore
supports the operators' visible effect but does not certify the enabled lane as
more accurate. A comb probe should measure this tradeoff before guide count is
scaled further.

## Workbench dogfood

The OrbStack `light` shelf restored in 0.000 seconds. Failed tactic edits returned
the first failing theorem in about 0.4 seconds; the final seven-theorem source
succeeded as warm semantic evidence in 0.3 seconds. The new theorem pins the
production pressure coefficient rather than a film choreography bound.

Two routing inconsistencies were found: `prove status` recommended `--cwd`,
which the source-centered OrbStack profile route then rejected, and `prove fix
--profile light` selected a native cold-load path instead of the live OrbStack
shelf. One deliberately bad rewrite also stack-overflowed for 77 seconds before
the failure card identified it. These are Workbench UX findings, not proof
failures in the final source. They are tracked as
[workbench issue #309](https://github.com/BenKnill/hol-light-workbench/issues/309)
and
[workbench issue #310](https://github.com/BenKnill/hol-light-workbench/issues/310).
No cold audit is claimed here.
