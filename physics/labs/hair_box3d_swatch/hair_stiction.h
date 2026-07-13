// SPDX-License-Identifier: MIT

#ifndef HAIR_STICTION_H
#define HAIR_STICTION_H

#include <stdbool.h>

typedef enum HairStictionMode
{
    hair_stiction_none = 0,
    hair_stiction_stick = 1,
    hair_stiction_slip = 2
} HairStictionMode;

typedef struct HairStictionCoefficients
{
    float static_axial;
    float static_transverse;
    float kinetic_axial;
    float kinetic_transverse;
    float capture_speed;
    float release_speed;
} HairStictionCoefficients;

typedef struct HairStictionInput
{
    float relative_axial_speed;
    float relative_transverse_speed;
    float effective_axial;
    float effective_transverse;
    float effective_coupling;
    float normal_impulse;
    bool was_sticking;
} HairStictionInput;

typedef struct HairStictionOutput
{
    bool valid;
    bool sticking;
    HairStictionMode mode;
    float required_axial_impulse;
    float required_transverse_impulse;
    float applied_axial_impulse;
    float applied_transverse_impulse;
    float post_axial_speed;
    float post_transverse_speed;
    float static_ellipse;
    float kinetic_scale;
    float energy_change;
} HairStictionOutput;

bool hair_stiction_coefficients_valid(const HairStictionCoefficients* coefficients);
HairStictionOutput hair_stiction_solve(const HairStictionCoefficients* coefficients,
                                       const HairStictionInput* input);

#endif
