# Small guide reference fixture

Issue #117 adds a deliberately small calibration instrument before spatial
friction is exposed in the hero browser or the mechanical guide count rises.
It is not a calibrated Cosserat-rod comparison.

Run:

```sh
just hair-rod-reference
```

The fixture settles eight independent 12-segment guides under the existing
PBD solver, resets the measurement window, and gives guide zero a tapered
axial or transverse initial displacement. Each treatment advances beside an
unforced control. The compact receipt records bounded tip-delta trajectories,
stretch, digests, and runtime. A separate direct pair-operator card checks
velocity-sum residual, swap symmetry, and relative-speed contraction.

## Initial M5 observation

Parameters: straight preset, collective rules off, 120 settling steps, 120
measurement steps, 0.004 initial tip displacement per step.

| case       | peak tip delta from control | peak stretch | control stretch |
| ---------- | --------------------------: | -----------: | --------------: |
| axial      |                    0.009292 |       1.810% |          1.487% |
| transverse |                    0.041196 |       1.487% |          1.487% |

The receipt reproduces exactly. The transverse displacement remains visible
longer and reaches 4.43 times the axial peak without exceeding the existing
3.5% stretch threshold. These are solver-space displacement proxies, not
meters or calibrated force-response data.

The direct anisotropic pair card uses axial/transverse blend coefficients
0.2/0.7. Its velocity-sum residual and swap-symmetry residual are exactly zero
at receipt precision; relative speed contracts from 0.198494 to 0.113318, a
ratio of 0.570889.

`HAIR_PAIR_FRICTION_COMPONENT_NONEXPANSIVE` proves that one ideal scalar
relative-velocity component cannot grow when its blend coefficient is in
[0,1]. It does not verify JavaScript floating point, the vector frame,
integration order, PBD convergence, guide initialization, or correspondence
to a continuous rod.

## Decision

The fixture is stable enough to become a small visual debug scene later, but
it also exposes the gap to scientific calibration: there is no stiffness,
mass, diameter, or force-unit mapping. The next visible hair improvement can
use this fixture as a regression card; a claim of calibrated rod behavior
would require a separate benchmark against an analytic or published reference.
