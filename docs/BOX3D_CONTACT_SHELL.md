# Box3D contact-shell oracle

This lab captures a deliberately thin slice of the Box3D contact solver used by
the physics bridge. It formalizes and probes the discrete update that Box3D
actually computes. It does not claim that Box3D implements an ideal simultaneous
contact solution or conserves mechanical energy.

## Step identity

For each Box3D substep, `h = dt / substeps`. The solver prepares manifolds,
effective masses, cached impulses, and saved pre-solve normal velocity. It then
applies warm-start impulses, performs one biased normal solve, integrates and
clamps motion, performs one unbiased relaxation solve with friction, and applies
restitution after the substeps. Warm starting and speculative contacts are
enabled in the bridge's current world configuration.

The source anchors for this snapshot are:

- `/Users/boxer/box3d/src/solver.c`, solver-stage ordering;
- `/Users/boxer/box3d/src/contact_solver.c`, normal and friction updates;
- `/Users/boxer/box3d/src/solver.h`, softness coefficients;
- `physics/box3d_scene_runner.c`, the bridge call to `b3World_Step`.

## Claim dossier v0

| ID | Claim | Evidence target |
| --- | --- | --- |
| C1 | The substep definition is `dt / N`. | Exact-real HOL observation |
| C2 | The accumulated normal impulse clamp is nonnegative. | Exact-real HOL observation |
| C3 | The speculative branch uses `separation / h`. | Exact-real HOL observation |
| C4 | The nonzero-hertz softness mass and impulse scales sum to one. | Exact-real HOL observation |
| C5 | The friction projection lies inside its nonnegative disk radius. | Exact-real HOL observation |
| P1 | Aggressive overlap recovery may create motion from an overlapped rest state. | Public-API Box3D probe |
| P2 | Restitution has a discontinuity around the configured speed threshold. | Public-API Box3D probe |
| P3 | Reported central friction impulse remains inside `mu * normal impulse`. | Public-manifold probe |

The first deterministic native run observed:

- overlap recovery raised translational kinetic energy from `0` to
  `0.024870797991752625`;
- the `-0.999 m/s` threshold twin ended at `-0.0337811559 m/s`, while the
  `-1.001 m/s` twin ended at `+0.9667028785 m/s`;
- central friction magnitude `0.7126111463` remained within radius
  `0.7126112578`;
- repeated complete runs produced identical JSONL hash
  `b5e30f263c6ebfffc69b346aee93e5035957f45f841c9cc3b54ffed69849e705`.

These are fixture observations against the pinned local Box3D checkout, not
universal solver guarantees.

The reference run used Box3D commit
`ef8ef0187a6fb7d93fc847872a538096b4a5833d`. The HOL source had SHA-256
`48b507b31fbbd987e78dec4d27d1b80ccb6145ed5f08d64bf4eb259a8918cd34`;
the heavy OrbStack profile semantically observed all seven named theorems in a
`0.5s` disposable replay. That receipt is `warm_exploration`, not final audit
evidence.

The exact-real claims live in `physics/labs/contact_shell/contact_shell.ml`.
Warm Workbench results are development evidence only; a cold final audit is
required before calling those claims proved. The C executable produces
`outputs/contact_shell.jsonl`, kept out of git, with pure-shell oracle examples
and public Box3D observations.

## Explicit non-claims

- The global contact graph is not claimed to be order-independent.
- The solver is not claimed to conserve or monotonically decrease mechanical
  energy. Soft overlap recovery is allowed to inject energy.
- Bounding-box project colliders are not claimed to equal authored mesh geometry.
- The exact-real shell is not a verification of Box3D C or its floating-point
  execution.
- CCD, gyroscopic integration, restitution correctness, warm-start matching, and
  multi-contact stacking are outside this first shell.

## Run

```sh
just contact-shell

/Users/boxer/hol-light-workbench/hol-workbench/bin/prove \
  "$PWD/physics/labs/contact_shell/contact_shell.ml" \
  --profile heavy \
  --run-root /Users/boxer/workbench-artifacts/box3d-contact-shell
```

Inspect the proof run through the Workbench receipt, not process exit alone.

## Interactive laboratory

The static browser laboratory turns the fixed probe observations into three
inspectable experiments: energy lift, restitution threshold twins, and friction
disk projection. Start the existing repo server and open:

```sh
./scripts/serve.sh
open http://127.0.0.1:8091/physics/labs/contact_shell/demo/
```

The demo reads the tracked `demo/fixture.json`; it does not run Box3D in the
browser. `scripts/test_contact_shell_demo.py` checks its claim boundaries and,
when a fresh ignored `outputs/contact_shell.jsonl` exists, requires the tracked
fixture to match that native probe byte-for-byte at the JSON-value level.

## One-day gate

**Go** only if the C self-tests and public Box3D probes pass, C2/C3/C5 are
semantically observed by HOL, and the receipt preserves the warm-versus-final
evidence boundary. A probe/formula mismatch is a model problem to investigate,
not permission to weaken the claim silently.
