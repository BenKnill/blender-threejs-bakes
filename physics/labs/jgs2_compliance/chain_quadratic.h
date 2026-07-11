// SPDX-License-Identifier: MIT

#ifndef CHAIN_QUADRATIC_H
#define CHAIN_QUADRATIC_H

#include <stdbool.h>

#define CQ_MAX_N 32

typedef struct cqQuadratic
{
    int n;
    double h[CQ_MAX_N][CQ_MAX_N];
    double rhs[CQ_MAX_N];
} cqQuadratic;

// E(x) = 0.5 * x^T H x - rhs^T x.
void cq_make_fixed_chain(cqQuadratic* q, int n, double mass_term, double spring,
                         const double* target);
double cq_energy(const cqQuadratic* q, const double* x);
void cq_gradient(const cqQuadratic* q, const double* x, double* gradient);
double cq_residual_l2(const cqQuadratic* q, const double* x);

bool cq_solve(const cqQuadratic* q, double* x);
void cq_step_jacobi(const cqQuadratic* q, double* x);
// Finite-hop inverse approximation for the fixed-chain stencil. radius=0 is
// Jacobi; larger radii add neighboring gradient information.
void cq_step_neumann(const cqQuadratic* q, double spring, int radius, double* x);
// Exact local complementary response on [i-radius,i+radius], assembled from
// the center correction of each stale window. A bounded exact quadratic line
// search makes the simultaneous update energy-nonincreasing. Returns false if
// a local solve fails or the assembled direction is not finite.
bool cq_step_schur_window(const cqQuadratic* q, int radius, double* x,
                          double* applied_alpha);
void cq_step_red_black_gs(const cqQuadratic* q, double* x);
bool cq_step_exact_oracle(const cqQuadratic* q, double* x);

// A deliberately separable, owned-objective update. This is only used by the
// two-variable counterexample; it is not the chain's Jacobi iteration.
void cq_owned_local_minimizers(int n, const double* diagonal, const double* linear,
                               double* x);

bool cq_self_test(void);

#endif
