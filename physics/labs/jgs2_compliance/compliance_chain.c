// SPDX-License-Identifier: MIT

#include "chain_quadratic.h"

#include "box3d/box3d.h"

#include <errno.h>
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static bool ensure_outputs(void)
{
    return mkdir("outputs", 0755) == 0 || errno == EEXIST;
}

static double owned_energy(const double* x)
{
    return 0.5 * x[0] * x[0] - x[0] + 0.5 * x[1] * x[1] - x[1];
}

static void write_row(FILE* csv, const char* fixture, const char* method, int iteration,
                      const cqQuadratic* q, const double* x, double exact_energy,
                      double local_energy, double alpha)
{
    double energy = cq_energy(q, x);
    fprintf(csv, "%s,%s,%d,%.17g,%.17g,%.17g,%.17g,%.17g\n", fixture, method,
            iteration, energy, energy - exact_energy, cq_residual_l2(q, x), local_energy,
            alpha);
}

static bool write_quadratic_csv(void)
{
    FILE* csv = fopen("outputs/compliance_chain.csv", "w");
    if (csv == NULL)
    {
        perror("outputs/compliance_chain.csv");
        return false;
    }
    fprintf(csv,
            "fixture,method,iteration,idealized_energy,energy_gap,residual_l2,"
            "owned_local_energy,applied_alpha\n");

    cqQuadratic witness = {.n = 2};
    witness.h[0][0] = 1.0;
    witness.h[0][1] = 0.9;
    witness.h[1][0] = 0.9;
    witness.h[1][1] = 1.0;
    witness.rhs[0] = 1.0;
    witness.rhs[1] = 1.0;
    const double local_diagonal[2] = {1.0, 1.0};
    const double local_linear[2] = {-1.0, -1.0};
    double local[2] = {0.5, 0.5};
    double exact_witness[2] = {0.5, 0.5};
    double witness_oracle[2] = {0.0, 0.0};
    if (!cq_solve(&witness, witness_oracle))
    {
        fclose(csv);
        return false;
    }
    double witness_exact_energy = cq_energy(&witness, witness_oracle);
    write_row(csv, "owned_objective_witness", "owned_local", 0, &witness, local,
              witness_exact_energy, owned_energy(local), NAN);
    cq_owned_local_minimizers(2, local_diagonal, local_linear, local);
    write_row(csv, "owned_objective_witness", "owned_local", 1, &witness, local,
              witness_exact_energy, owned_energy(local), NAN);
    write_row(csv, "owned_objective_witness", "exact_oracle", 0, &witness, exact_witness,
              witness_exact_energy, NAN, NAN);
    if (!cq_step_exact_oracle(&witness, exact_witness))
    {
        fclose(csv);
        return false;
    }
    write_row(csv, "owned_objective_witness", "exact_oracle", 1, &witness, exact_witness,
              witness_exact_energy, NAN, 1.0);

    enum
    {
        count = 12,
        iterations = 24
    };
    const double spring = 4.0;
    double target[count];
    double initial[count];
    for (int i = 0; i < count; ++i)
    {
        target[i] = 0.25 * sin(0.7 * (double)i);
        initial[i] = (i % 2 == 0 ? 0.75 : -0.6) + 0.03 * (double)i;
    }
    cqQuadratic chain;
    cq_make_fixed_chain(&chain, count, 1.0, spring, target);
    double chain_oracle[count];
    memset(chain_oracle, 0, sizeof(chain_oracle));
    if (!cq_solve(&chain, chain_oracle))
    {
        fclose(csv);
        return false;
    }
    double chain_exact_energy = cq_energy(&chain, chain_oracle);

    const char* methods[] = {"jacobi", "neumann_r2", "schur_window_r2_ls",
                             "red_black_gs", "exact_oracle"};
    for (int method = 0; method < 5; ++method)
    {
        double x[count];
        memcpy(x, initial, sizeof(x));
        double alpha = NAN;
        for (int iteration = 0; iteration <= iterations; ++iteration)
        {
            write_row(csv, "fixed_end_chain", methods[method], iteration, &chain, x,
                      chain_exact_energy, NAN, alpha);
            alpha = NAN;
            if (method == 0)
            {
                cq_step_jacobi(&chain, x);
            }
            else if (method == 1)
            {
                cq_step_neumann(&chain, spring, 2, x);
            }
            else if (method == 2)
            {
                if (!cq_step_schur_window(&chain, 2, x, &alpha))
                {
                    fclose(csv);
                    return false;
                }
            }
            else if (method == 3)
            {
                cq_step_red_black_gs(&chain, x);
            }
            else if (!cq_step_exact_oracle(&chain, x))
            {
                fclose(csv);
                return false;
            }
        }
    }
    fclose(csv);
    return true;
}

static bool write_box3d_reference(void)
{
    enum
    {
        count = 8,
        ticks = 240
    };
    FILE* csv = fopen("outputs/box3d_distance_reference.csv", "w");
    if (csv == NULL)
    {
        perror("outputs/box3d_distance_reference.csv");
        return false;
    }
    fprintf(csv, "tick,time_s,joint,current_length,constraint_force_x\n");

    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = b3Vec3_zero;
    world_def.enableSleep = false;
    b3WorldId world = b3CreateWorld(&world_def);

    b3BodyDef anchor_def = b3DefaultBodyDef();
    anchor_def.name = "fixed_anchor";
    b3BodyId previous = b3CreateBody(world, &anchor_def);
    b3JointId joints[count];
    b3Sphere sphere = {{0.0f, 0.0f, 0.0f}, 0.15f};
    b3ShapeDef shape_def = b3DefaultShapeDef();
    shape_def.density = 1.0f;

    for (int i = 0; i < count; ++i)
    {
        b3BodyDef body_def = b3DefaultBodyDef();
        body_def.type = b3_dynamicBody;
        body_def.position = (b3Pos){(float)(i + 1) + (i == count - 1 ? 0.5f : 0.0f), 0.0f,
                                    0.0f};
        body_def.motionLocks.linearY = true;
        body_def.motionLocks.linearZ = true;
        body_def.motionLocks.angularX = true;
        body_def.motionLocks.angularY = true;
        body_def.motionLocks.angularZ = true;
        body_def.enableSleep = false;
        b3BodyId body = b3CreateBody(world, &body_def);
        b3CreateSphereShape(body, &shape_def, &sphere);

        b3DistanceJointDef joint_def = b3DefaultDistanceJointDef();
        joint_def.base.bodyIdA = previous;
        joint_def.base.bodyIdB = body;
        joint_def.length = 1.0f;
        joint_def.enableSpring = true;
        joint_def.hertz = 4.0f;
        joint_def.dampingRatio = 0.25f;
        joint_def.lowerSpringForce = -1000.0f;
        joint_def.upperSpringForce = 1000.0f;
        joints[i] = b3CreateDistanceJoint(world, &joint_def);
        previous = body;
    }

    const float time_step = 1.0f / 60.0f;
    bool finite = true;
    for (int tick = 0; tick <= ticks; ++tick)
    {
        for (int i = 0; i < count; ++i)
        {
            float length = b3DistanceJoint_GetCurrentLength(joints[i]);
            b3Vec3 force = b3Joint_GetConstraintForce(joints[i]);
            fprintf(csv, "%d,%.9g,%d,%.9g,%.9g\n", tick, (double)(tick * time_step), i,
                    (double)length, (double)force.x);
            finite = finite && isfinite(length) && isfinite(force.x);
        }
        if (tick < ticks)
        {
            b3World_Step(world, time_step, 4);
        }
    }
    b3DestroyWorld(world);
    fclose(csv);
    return finite;
}

int main(int argc, char** argv)
{
    bool self_test_only = argc == 2 && strcmp(argv[1], "--self-test") == 0;
    bool box3d_reference = argc == 2 && strcmp(argv[1], "--box3d-reference") == 0;
    if (argc > 2 || (argc == 2 && !self_test_only && !box3d_reference))
    {
        fprintf(stderr, "usage: %s [--self-test|--box3d-reference]\n", argv[0]);
        return EXIT_FAILURE;
    }
    if (!cq_self_test())
    {
        fprintf(stderr, "quadratic self-test: FAILED\n");
        return EXIT_FAILURE;
    }
    printf("quadratic self-test: passed\n");
    if (self_test_only)
    {
        return EXIT_SUCCESS;
    }
    if (!ensure_outputs() || !write_quadratic_csv())
    {
        return EXIT_FAILURE;
    }
    printf("wrote outputs/compliance_chain.csv\n");
    if (box3d_reference)
    {
        if (!write_box3d_reference())
        {
            return EXIT_FAILURE;
        }
        printf("wrote outputs/box3d_distance_reference.csv\n");
    }
    return EXIT_SUCCESS;
}
