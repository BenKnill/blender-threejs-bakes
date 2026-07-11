// SPDX-License-Identifier: MIT

#include "chain_quadratic.h"

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

void cq_make_fixed_chain(cqQuadratic* q, int n, double mass_term, double spring,
                         const double* target)
{
    memset(q, 0, sizeof(*q));
    q->n = n;
    for (int i = 0; i < n; ++i)
    {
        q->h[i][i] = mass_term + 2.0 * spring;
        q->rhs[i] = mass_term * target[i];
        if (i + 1 < n)
        {
            q->h[i][i + 1] = -spring;
            q->h[i + 1][i] = -spring;
        }
    }
}

double cq_energy(const cqQuadratic* q, const double* x)
{
    double value = 0.0;
    for (int i = 0; i < q->n; ++i)
    {
        value -= q->rhs[i] * x[i];
        for (int j = 0; j < q->n; ++j)
        {
            value += 0.5 * x[i] * q->h[i][j] * x[j];
        }
    }
    return value;
}

void cq_gradient(const cqQuadratic* q, const double* x, double* gradient)
{
    for (int i = 0; i < q->n; ++i)
    {
        double value = -q->rhs[i];
        for (int j = 0; j < q->n; ++j)
        {
            value += q->h[i][j] * x[j];
        }
        gradient[i] = value;
    }
}

double cq_residual_l2(const cqQuadratic* q, const double* x)
{
    double gradient[CQ_MAX_N];
    cq_gradient(q, x, gradient);
    double squared = 0.0;
    for (int i = 0; i < q->n; ++i)
    {
        squared += gradient[i] * gradient[i];
    }
    return sqrt(squared);
}

bool cq_solve(const cqQuadratic* q, double* x)
{
    double l[CQ_MAX_N][CQ_MAX_N] = {{0.0}};
    double y[CQ_MAX_N] = {0.0};

    for (int i = 0; i < q->n; ++i)
    {
        for (int j = 0; j <= i; ++j)
        {
            double value = q->h[i][j];
            for (int k = 0; k < j; ++k)
            {
                value -= l[i][k] * l[j][k];
            }
            if (i == j)
            {
                if (!(value > 0.0))
                {
                    return false;
                }
                l[i][j] = sqrt(value);
            }
            else
            {
                l[i][j] = value / l[j][j];
            }
        }
    }

    for (int i = 0; i < q->n; ++i)
    {
        double value = q->rhs[i];
        for (int j = 0; j < i; ++j)
        {
            value -= l[i][j] * y[j];
        }
        y[i] = value / l[i][i];
    }
    for (int i = q->n - 1; i >= 0; --i)
    {
        double value = y[i];
        for (int j = i + 1; j < q->n; ++j)
        {
            value -= l[j][i] * x[j];
        }
        x[i] = value / l[i][i];
    }
    return true;
}

void cq_step_jacobi(const cqQuadratic* q, double* x)
{
    double next[CQ_MAX_N];
    for (int i = 0; i < q->n; ++i)
    {
        double value = q->rhs[i];
        for (int j = 0; j < q->n; ++j)
        {
            if (j != i)
            {
                value -= q->h[i][j] * x[j];
            }
        }
        next[i] = value / q->h[i][i];
    }
    memcpy(x, next, (size_t)q->n * sizeof(double));
}

void cq_step_neumann(const cqQuadratic* q, double spring, int radius, double* x)
{
    double gradient[CQ_MAX_N];
    double v[CQ_MAX_N];
    double next[CQ_MAX_N];
    double delta[CQ_MAX_N];
    cq_gradient(q, x, gradient);
    double diagonal = q->h[0][0];
    double ratio = spring / diagonal;
    for (int i = 0; i < q->n; ++i)
    {
        v[i] = gradient[i];
        delta[i] = -v[i] / diagonal;
    }
    for (int hop = 0; hop < radius; ++hop)
    {
        for (int i = 0; i < q->n; ++i)
        {
            double left = i > 0 ? v[i - 1] : 0.0;
            double right = i + 1 < q->n ? v[i + 1] : 0.0;
            next[i] = ratio * (left + right);
        }
        memcpy(v, next, (size_t)q->n * sizeof(double));
        for (int i = 0; i < q->n; ++i)
        {
            delta[i] -= v[i] / diagonal;
        }
    }
    for (int i = 0; i < q->n; ++i)
    {
        x[i] += delta[i];
    }
}

bool cq_step_schur_window(const cqQuadratic* q, int radius, double* x,
                          double* applied_alpha)
{
    if (radius < 0)
    {
        return false;
    }
    double gradient[CQ_MAX_N];
    double delta[CQ_MAX_N] = {0.0};
    cq_gradient(q, x, gradient);
    for (int center = 0; center < q->n; ++center)
    {
        int lo = center - radius > 0 ? center - radius : 0;
        int hi = center + radius + 1 < q->n ? center + radius + 1 : q->n;
        cqQuadratic local = {.n = hi - lo};
        for (int i = lo; i < hi; ++i)
        {
            local.rhs[i - lo] = -gradient[i];
            for (int j = lo; j < hi; ++j)
            {
                local.h[i - lo][j - lo] = q->h[i][j];
            }
        }
        double local_delta[CQ_MAX_N] = {0.0};
        if (!cq_solve(&local, local_delta))
        {
            return false;
        }
        delta[center] = local_delta[center - lo];
    }

    double gradient_dot_delta = 0.0;
    double delta_h_delta = 0.0;
    for (int i = 0; i < q->n; ++i)
    {
        gradient_dot_delta += gradient[i] * delta[i];
        for (int j = 0; j < q->n; ++j)
        {
            delta_h_delta += delta[i] * q->h[i][j] * delta[j];
        }
    }
    if (!isfinite(gradient_dot_delta) || !isfinite(delta_h_delta) ||
        !(gradient_dot_delta < 0.0) || !(delta_h_delta > 0.0))
    {
        return false;
    }
    double alpha = -gradient_dot_delta / delta_h_delta;
    if (alpha > 1.0)
    {
        alpha = 1.0;
    }
    if (!(alpha > 0.0) || !isfinite(alpha))
    {
        return false;
    }
    for (int i = 0; i < q->n; ++i)
    {
        x[i] += alpha * delta[i];
    }
    if (applied_alpha != NULL)
    {
        *applied_alpha = alpha;
    }
    return true;
}

void cq_step_red_black_gs(const cqQuadratic* q, double* x)
{
    for (int color = 0; color < 2; ++color)
    {
        for (int i = color; i < q->n; i += 2)
        {
            double value = q->rhs[i];
            for (int j = 0; j < q->n; ++j)
            {
                if (j != i)
                {
                    value -= q->h[i][j] * x[j];
                }
            }
            x[i] = value / q->h[i][i];
        }
    }
}

bool cq_step_exact_oracle(const cqQuadratic* q, double* x)
{
    return cq_solve(q, x);
}

void cq_owned_local_minimizers(int n, const double* diagonal, const double* linear,
                               double* x)
{
    for (int i = 0; i < n; ++i)
    {
        x[i] = -linear[i] / diagonal[i];
    }
}

static bool close_enough(double a, double b, double tolerance)
{
    return fabs(a - b) <= tolerance * (1.0 + fabs(a) + fabs(b));
}

bool cq_self_test(void)
{
    // Deterministic two-block Schur checks. Eliminating y gives
    // (a-b^2/c)x = rx-(b/c)ry, which must match the dense solution.
    uint32_t state = 0x6d2b79f5u;
    for (int trial = 0; trial < 100; ++trial)
    {
        state = 1664525u * state + 1013904223u;
        double a = 1.0 + (double)(state & 1023u) / 257.0;
        state = 1664525u * state + 1013904223u;
        double c = 1.0 + (double)(state & 1023u) / 263.0;
        state = 1664525u * state + 1013904223u;
        double rho = 0.8 * ((double)(state & 1023u) / 1023.0 - 0.5);
        double b = rho * sqrt(a * c);
        state = 1664525u * state + 1013904223u;
        double rx = (double)(state & 1023u) / 101.0 - 5.0;
        state = 1664525u * state + 1013904223u;
        double ry = (double)(state & 1023u) / 103.0 - 5.0;

        cqQuadratic q = {.n = 2};
        q.h[0][0] = a;
        q.h[0][1] = b;
        q.h[1][0] = b;
        q.h[1][1] = c;
        q.rhs[0] = rx;
        q.rhs[1] = ry;
        double dense[2] = {0.0, 0.0};
        if (!cq_solve(&q, dense))
        {
            return false;
        }
        double schur = a - b * b / c;
        double schur_x = (rx - b * ry / c) / schur;
        if (!(schur > 0.0) || !close_enough(dense[0], schur_x, 1e-11))
        {
            return false;
        }
    }

    // The owned objectives 0.5*x_i^2-x_i prefer (1,1), but their update
    // increases the coupled global SPD energy from the chosen start.
    cqQuadratic witness = {.n = 2};
    witness.h[0][0] = 1.0;
    witness.h[0][1] = 0.9;
    witness.h[1][0] = 0.9;
    witness.h[1][1] = 1.0;
    witness.rhs[0] = 1.0;
    witness.rhs[1] = 1.0;
    double start[2] = {0.5, 0.5};
    double owned[2] = {start[0], start[1]};
    const double diagonal[2] = {1.0, 1.0};
    const double linear[2] = {-1.0, -1.0};
    cq_owned_local_minimizers(2, diagonal, linear, owned);
    double owned_before = 0.5 * start[0] * start[0] - start[0] +
                          0.5 * start[1] * start[1] - start[1];
    double owned_after = 0.5 * owned[0] * owned[0] - owned[0] +
                         0.5 * owned[1] * owned[1] - owned[1];
    if (!(owned_after < owned_before) || !(cq_energy(&witness, owned) > cq_energy(&witness, start)))
    {
        return false;
    }
    double exact[2] = {start[0], start[1]};
    if (!cq_step_exact_oracle(&witness, exact) ||
        !(cq_energy(&witness, exact) < cq_energy(&witness, start)) ||
        cq_residual_l2(&witness, exact) > 1e-12)
    {
        return false;
    }

    // The fixed chain lanes must remain finite; the exact oracle reaches the
    // dense optimum and the three iterative references reduce energy here.
    double target[8] = {0.0, 0.25, -0.1, 0.4, 0.2, -0.3, 0.1, 0.0};
    cqQuadratic chain;
    cq_make_fixed_chain(&chain, 8, 1.0, 4.0, target);
    double jacobi[8] = {0.8, -0.6, 0.7, -0.5, 0.4, -0.3, 0.2, -0.1};
    double rbgs[8];
    double neumann[8];
    double schur[8];
    double oracle[8];
    memcpy(rbgs, jacobi, sizeof(jacobi));
    memcpy(neumann, jacobi, sizeof(jacobi));
    memcpy(schur, jacobi, sizeof(jacobi));
    memcpy(oracle, jacobi, sizeof(jacobi));
    double jacobi_energy = cq_energy(&chain, jacobi);
    double neumann_energy = jacobi_energy;
    double rbgs_energy = jacobi_energy;
    double schur_energy = jacobi_energy;
    for (int iteration = 0; iteration < 40; ++iteration)
    {
        cq_step_jacobi(&chain, jacobi);
        cq_step_neumann(&chain, 4.0, 2, neumann);
        double alpha = 0.0;
        if (!cq_step_schur_window(&chain, 2, schur, &alpha) || !(alpha > 0.0))
        {
            return false;
        }
        cq_step_red_black_gs(&chain, rbgs);
        double next_jacobi = cq_energy(&chain, jacobi);
        double next_neumann = cq_energy(&chain, neumann);
        double next_rbgs = cq_energy(&chain, rbgs);
        double next_schur = cq_energy(&chain, schur);
        if (!isfinite(next_jacobi) || !isfinite(next_neumann) || !isfinite(next_rbgs) ||
            !isfinite(next_schur) ||
            next_jacobi > jacobi_energy + 1e-12 || next_neumann > neumann_energy + 1e-12 ||
            next_rbgs > rbgs_energy + 1e-12 || next_schur > schur_energy + 1e-12)
        {
            return false;
        }
        jacobi_energy = next_jacobi;
        neumann_energy = next_neumann;
        rbgs_energy = next_rbgs;
        schur_energy = next_schur;
    }
    if (!cq_step_exact_oracle(&chain, oracle) || cq_residual_l2(&chain, oracle) > 1e-11)
    {
        return false;
    }

    // A window covering the complete chain is the dense Newton/oracle step.
    double full_window[8] = {0.8, -0.6, 0.7, -0.5, 0.4, -0.3, 0.2, -0.1};
    double full_alpha = 0.0;
    if (!cq_step_schur_window(&chain, chain.n, full_window, &full_alpha) ||
        !close_enough(full_alpha, 1.0, 1e-11))
    {
        return false;
    }
    for (int i = 0; i < chain.n; ++i)
    {
        if (!close_enough(full_window[i], oracle[i], 1e-10))
        {
            return false;
        }
    }
    return true;
}
