// SPDX-License-Identifier: MIT

#include "hair_stiction.h"

#include <math.h>
#include <stddef.h>

static float ellipse_norm(float axial, float transverse, float axial_limit,
                          float transverse_limit)
{
    if (axial_limit <= 0.0f || transverse_limit <= 0.0f)
    {
        return INFINITY;
    }
    return hypotf(axial / axial_limit, transverse / transverse_limit);
}

bool hair_stiction_coefficients_valid(const HairStictionCoefficients* coefficients)
{
    return coefficients != NULL && coefficients->static_axial >= 0.0f &&
           coefficients->static_transverse >= 0.0f &&
           coefficients->kinetic_axial >= 0.0f &&
           coefficients->kinetic_transverse >= 0.0f &&
           coefficients->kinetic_axial <= coefficients->static_axial &&
           coefficients->kinetic_transverse <= coefficients->static_transverse &&
           coefficients->capture_speed >= 0.0f &&
           coefficients->capture_speed < coefficients->release_speed;
}

HairStictionOutput hair_stiction_solve(const HairStictionCoefficients* coefficients,
                                       const HairStictionInput* input)
{
    HairStictionOutput output = {0};
    if (!hair_stiction_coefficients_valid(coefficients) || input == NULL ||
        input->normal_impulse <= 0.0f || input->effective_axial <= 0.0f ||
        input->effective_transverse <= 0.0f)
    {
        return output;
    }

    float determinant = input->effective_axial * input->effective_transverse -
                        input->effective_coupling * input->effective_coupling;
    if (determinant <= 1.0e-8f)
    {
        return output;
    }

    output.valid = true;
    output.required_axial_impulse =
        (-input->effective_transverse * input->relative_axial_speed +
         input->effective_coupling * input->relative_transverse_speed) /
        determinant;
    output.required_transverse_impulse =
        (input->effective_coupling * input->relative_axial_speed -
         input->effective_axial * input->relative_transverse_speed) /
        determinant;

    float static_axial_limit = coefficients->static_axial * input->normal_impulse;
    float static_transverse_limit =
        coefficients->static_transverse * input->normal_impulse;
    output.static_ellipse = ellipse_norm(
        output.required_axial_impulse, output.required_transverse_impulse,
        static_axial_limit, static_transverse_limit);

    float speed = hypotf(input->relative_axial_speed, input->relative_transverse_speed);
    float speed_limit =
        input->was_sticking ? coefficients->release_speed : coefficients->capture_speed;
    output.sticking = speed <= speed_limit && output.static_ellipse <= 1.0f;
    output.mode = output.sticking ? hair_stiction_stick : hair_stiction_slip;

    float scale = 1.0f;
    if (!output.sticking)
    {
        float kinetic_axial_limit = coefficients->kinetic_axial * input->normal_impulse;
        float kinetic_transverse_limit =
            coefficients->kinetic_transverse * input->normal_impulse;
        float kinetic_ellipse = ellipse_norm(
            output.required_axial_impulse, output.required_transverse_impulse,
            kinetic_axial_limit, kinetic_transverse_limit);
        if (!isfinite(kinetic_ellipse))
        {
            scale = 0.0f;
        }
        else if (kinetic_ellipse > 1.0f)
        {
            scale = 1.0f / kinetic_ellipse;
        }
    }
    output.kinetic_scale = scale;
    output.applied_axial_impulse = scale * output.required_axial_impulse;
    output.applied_transverse_impulse = scale * output.required_transverse_impulse;

    output.post_axial_speed =
        input->relative_axial_speed +
        input->effective_axial * output.applied_axial_impulse +
        input->effective_coupling * output.applied_transverse_impulse;
    output.post_transverse_speed =
        input->relative_transverse_speed +
        input->effective_coupling * output.applied_axial_impulse +
        input->effective_transverse * output.applied_transverse_impulse;
    output.energy_change =
        output.applied_axial_impulse * input->relative_axial_speed +
        output.applied_transverse_impulse * input->relative_transverse_speed +
        0.5f *
            (input->effective_axial * output.applied_axial_impulse *
                 output.applied_axial_impulse +
             2.0f * input->effective_coupling * output.applied_axial_impulse *
                 output.applied_transverse_impulse +
             input->effective_transverse * output.applied_transverse_impulse *
                 output.applied_transverse_impulse);
    return output;
}
