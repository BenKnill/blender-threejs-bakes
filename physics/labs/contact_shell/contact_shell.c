// SPDX-License-Identifier: MIT

#include "contact_shell.h"

#include <math.h>

static double max_double(double a, double b)
{
    return a > b ? a : b;
}

double cs_substep(double time_step, int substeps)
{
    return substeps > 0 ? time_step / (double)substeps : NAN;
}

double cs_speculative_bias(double separation, double inverse_substep)
{
    return separation * inverse_substep;
}

double cs_penetration_bias(double mass_scale, double bias_rate, double separation,
                           double contact_speed)
{
    return max_double(mass_scale * bias_rate * separation, -contact_speed);
}

csSoftness cs_make_softness(double hertz, double damping_ratio, double substep)
{
    if (hertz == 0.0)
    {
        return (csSoftness){0.0, 0.0, 0.0};
    }

    const double pi = 3.14159265358979323846264338327950288;
    double omega = 2.0 * pi * hertz;
    double a1 = 2.0 * damping_ratio + substep * omega;
    double a2 = substep * omega * a1;
    double a3 = 1.0 / (1.0 + a2);
    return (csSoftness){omega / a1, a2 * a3, a3};
}

csNormalResult cs_normal_update(double old_impulse, double normal_mass,
                                double mass_scale, double normal_velocity, double bias,
                                double impulse_scale)
{
    double neg_impulse = normal_mass * (mass_scale * normal_velocity + bias) +
                         impulse_scale * old_impulse;
    double impulse = max_double(old_impulse - neg_impulse, 0.0);
    return (csNormalResult){impulse, impulse - old_impulse, neg_impulse};
}

csVec2 cs_project_friction(csVec2 candidate, double friction,
                           double total_normal_impulse)
{
    double radius = max_double(friction * total_normal_impulse, 0.0);
    double length_squared = candidate.x * candidate.x + candidate.y * candidate.y;
    if (length_squared <= radius * radius)
    {
        return candidate;
    }

    double length = sqrt(length_squared);
    if (length == 0.0)
    {
        return (csVec2){0.0, 0.0};
    }
    double scale = radius / length;
    return (csVec2){scale * candidate.x, scale * candidate.y};
}

static bool close_enough(double actual, double expected, double tolerance)
{
    return fabs(actual - expected) <= tolerance;
}

bool cs_self_test(void)
{
    if (!close_enough(cs_substep(1.0 / 30.0, 4), 1.0 / 120.0, 1e-15))
    {
        return false;
    }
    if (!close_enough(cs_speculative_bias(0.01, 120.0), 1.2, 1e-15))
    {
        return false;
    }
    if (!close_enough(cs_penetration_bias(0.5, 20.0, -1.0, 3.0), -3.0, 1e-15))
    {
        return false;
    }

    csSoftness softness = cs_make_softness(30.0, 10.0, 1.0 / 60.0);
    if (!close_enough(softness.mass_scale + softness.impulse_scale, 1.0, 1e-15))
    {
        return false;
    }

    csNormalResult normal = cs_normal_update(0.25, 0.5, 1.0, -2.0, 0.0, 0.0);
    if (normal.impulse < 0.0 || !close_enough(normal.impulse, 1.25, 1e-15))
    {
        return false;
    }

    csVec2 friction = cs_project_friction((csVec2){3.0, 4.0}, 0.5, 4.0);
    return close_enough(hypot(friction.x, friction.y), 2.0, 1e-15);
}
