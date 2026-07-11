# Globally aware tether-chain lab

This is an experimental numerical lab beside the Box3D integration. It does
not alter Box3D's production solver. Its purpose is to make the cost of missing
complementary response visible on a stiff, linearized chain before attempting
a long-tether dynamics integration.

The idealized fixture minimizes

```text
E(x) = 0.5 x^T H x - r^T x
H_ii = mu + 2 k,  H_i,i+1 = H_i+1,i = -k,  r = mu z.
```

`mu` is the implicit inertial/regularizing term and `k` is axial stiffness.
The mass-to-step interpretation is `mu = m / h^2`; a later tether snapshot can
assemble `H = diag(m_i/h^2) + D^T diag(k_i + c_i/h) D`. That interchange is a
proposal, not implemented tether physics.

## Solver lanes

- `jacobi`: simultaneous diagonal coordinate updates.
- `red_black_gs`: two-color coordinate minimization.
- `neumann_r2`: the preserved radius-two finite-hop inverse approximation.
- `schur_window_r2_ls`: each node solves the exact quadratic on its stale
  five-node window and keeps the center correction. The simultaneous assembled
  direction uses the exact quadratic line minimizer, clamped to `[0,1]`, so the
  safeguard is visible through `applied_alpha` rather than hiding instability.
- `exact_oracle`: dense Cholesky on this small reference problem.

The window solve is an exact local complementary response for the selected
window. It is not exact response from the full chain unless the window covers
the full chain; a self-test checks that full-radius recovery equals the oracle.
It is not the JGS2 algorithm.

On the current deterministic 12-node fixture, iteration 24 gives:

| lane | residual L2 | energy gap |
| --- | ---: | ---: |
| Jacobi | `1.0627` | `3.3978e-2` |
| radius-2 Neumann | `9.0442e-4` | `2.4608e-8` |
| red-black GS | `2.2203e-3` | `1.0735e-6` |
| exact radius-2 Schur window + line search | `1.7483e-11` | floating-point zero |
| dense oracle | `2.0325e-16` | zero |

These are fixture results, not asymptotic convergence claims. The Schur-window
lane is the new result beyond the preserved probe baseline.

## Run

```sh
just chain-lab
```

The command builds and self-tests the C lab, emits deterministic quadratic and
public-API Box3D traces, then creates a dependency-free SVG and JSON receipt:

- `physics/labs/jgs2_compliance/outputs/compliance_chain.csv`
- `physics/labs/jgs2_compliance/outputs/box3d_distance_reference.csv`
- `physics/labs/jgs2_compliance/outputs/convergence.svg`
- `physics/labs/jgs2_compliance/outputs/receipt.json`

The Box3D trace is deliberately separate. It observes eight dynamic spheres
connected by `b3DistanceJoint` springs for 240 ticks. Box3D hertz/damping is not
identified with `k`, and the idealized quadratic energy/residual is never
reported as Box3D mechanical energy or an internal solver residual.

## Formal seed and claim boundary

The exact-real two-variable Schur/decomposition theorem was proved in the
three-lane HOL/Lean race and is documented at
`/Users/boxer/hol-light-workbench/research/agent-trials/reports/jgs2-quadratic-compliance-race-20260711.md`.
It proves the small algebraic seed, including unique global minimality and an
explicit owned-local overshoot witness. It does not verify this C program or
its floating-point calculations.

This lab makes no claim to implement Box3D's solver, nonlinear FEM, contact,
JGS2, Cubature, or a GPU kernel. The paper relationship is a research question:
how much global compliance must a parallel local update retain to avoid slow or
misleading behavior on a stiff chain?
