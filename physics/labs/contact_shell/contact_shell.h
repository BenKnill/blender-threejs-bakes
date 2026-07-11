// SPDX-License-Identifier: MIT

#pragma once

#include <stdbool.h>

typedef struct csSoftness
{
    double bias_rate;
    double mass_scale;
    double impulse_scale;
} csSoftness;

typedef struct csVec2
{
    double x;
    double y;
} csVec2;

typedef struct csNormalResult
{
    double impulse;
    double delta_impulse;
    double neg_impulse;
} csNormalResult;

double cs_substep(double time_step, int substeps);
double cs_speculative_bias(double separation, double inverse_substep);
double cs_penetration_bias(double mass_scale, double bias_rate, double separation,
                           double contact_speed);
csSoftness cs_make_softness(double hertz, double damping_ratio, double substep);
csNormalResult cs_normal_update(double old_impulse, double normal_mass,
                                double mass_scale, double normal_velocity, double bias,
                                double impulse_scale);
csVec2 cs_project_friction(csVec2 candidate, double friction,
                           double total_normal_impulse);
bool cs_self_test(void);
