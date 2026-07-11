// SPDX-License-Identifier: MIT

#include "contact_shell.h"

#include "box3d/box3d.h"

#include <errno.h>
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

typedef struct contactObservation
{
    int manifold_count;
    int point_count;
    double normal_impulse;
    double total_normal_impulse;
    double friction_impulse;
    double saved_normal_velocity;
} contactObservation;

static bool ensure_outputs(void)
{
    return mkdir("outputs", 0755) == 0 || errno == EEXIST;
}

static b3BodyId create_ground(b3WorldId world, float friction, float restitution)
{
    b3BodyDef body_def = b3DefaultBodyDef();
    body_def.position = (b3Pos){0.0f, -0.5f, 0.0f};
    body_def.name = "contact_shell_ground";
    b3BodyId body = b3CreateBody(world, &body_def);

    b3BoxHull hull = b3MakeBoxHull(4.0f, 0.5f, 4.0f);
    b3ShapeDef shape_def = b3DefaultShapeDef();
    shape_def.baseMaterial.friction = friction;
    shape_def.baseMaterial.restitution = restitution;
    b3CreateHullShape(body, &shape_def, &hull.base);
    return body;
}

static b3BodyId create_box(b3WorldId world, float y, float friction, float restitution,
                           b3Vec3 velocity)
{
    b3BodyDef body_def = b3DefaultBodyDef();
    body_def.type = b3_dynamicBody;
    body_def.position = (b3Pos){0.0f, y, 0.0f};
    body_def.linearVelocity = velocity;
    body_def.enableSleep = false;
    body_def.name = "contact_shell_box";
    b3BodyId body = b3CreateBody(world, &body_def);

    b3BoxHull hull = b3MakeBoxHull(0.5f, 0.5f, 0.5f);
    b3ShapeDef shape_def = b3DefaultShapeDef();
    shape_def.density = 1.0f;
    shape_def.baseMaterial.friction = friction;
    shape_def.baseMaterial.restitution = restitution;
    b3CreateHullShape(body, &shape_def, &hull.base);
    return body;
}

static contactObservation observe_contact(b3BodyId body)
{
    contactObservation observation = {0};
    int capacity = b3Body_GetContactCapacity(body);
    if (capacity <= 0)
    {
        return observation;
    }

    b3ContactData* contacts = calloc((size_t)capacity, sizeof(b3ContactData));
    if (contacts == NULL)
    {
        return observation;
    }
    int count = b3Body_GetContactData(body, contacts, capacity);
    for (int contact_index = 0; contact_index < count; ++contact_index)
    {
        const b3ContactData* contact = contacts + contact_index;
        observation.manifold_count += contact->manifoldCount;
        for (int manifold_index = 0; manifold_index < contact->manifoldCount;
             ++manifold_index)
        {
            const b3Manifold* manifold = contact->manifolds + manifold_index;
            observation.point_count += manifold->pointCount;
            observation.friction_impulse +=
                sqrt((double)b3Dot(manifold->frictionImpulse, manifold->frictionImpulse));
            for (int point_index = 0; point_index < manifold->pointCount; ++point_index)
            {
                const b3ManifoldPoint* point = manifold->points + point_index;
                observation.normal_impulse += point->normalImpulse;
                observation.total_normal_impulse += point->totalNormalImpulse;
                if (point->normalVelocity < observation.saved_normal_velocity)
                {
                    observation.saved_normal_velocity = point->normalVelocity;
                }
            }
        }
    }
    free(contacts);
    return observation;
}

static double translational_energy(b3BodyId body)
{
    b3Vec3 velocity = b3Body_GetLinearVelocity(body);
    double speed_squared = (double)b3Dot(velocity, velocity);
    return 0.5 * (double)b3Body_GetMass(body) * speed_squared;
}

static bool run_energetic_penetrator(FILE* jsonl)
{
    const float time_step = 1.0f / 30.0f;
    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = b3Vec3_zero;
    world_def.enableSleep = false;
    world_def.enableContinuous = false;
    world_def.contactHertz = 120.0f;
    world_def.contactDampingRatio = 0.05f;
    world_def.contactSpeed = 50.0f;
    b3WorldId world = b3CreateWorld(&world_def);
    create_ground(world, 0.0f, 0.0f);
    b3BodyId body = create_box(world, 0.35f, 0.0f, 0.0f, b3Vec3_zero);

    double energy_before = translational_energy(body);
    b3World_Step(world, time_step, 1);
    double energy_after = translational_energy(body);
    b3Vec3 velocity = b3Body_GetLinearVelocity(body);
    contactObservation contact = observe_contact(body);
    fprintf(jsonl,
            "{\"case\":\"energetic_penetrator\",\"dt\":%.17g,"
            "\"energy_before\":%.17g,\"energy_after\":%.17g,"
            "\"post_vy\":%.17g,\"normal_impulse\":%.17g,"
            "\"total_normal_impulse\":%.17g,\"points\":%d}\n",
            (double)time_step, energy_before, energy_after, (double)velocity.y,
            contact.normal_impulse, contact.total_normal_impulse, contact.point_count);

    bool observed = contact.point_count > 0 && contact.normal_impulse >= 0.0 &&
                    energy_after > energy_before + 1e-8;
    b3DestroyWorld(world);
    return observed;
}

typedef struct thresholdResult
{
    double pre_velocity;
    double post_velocity;
    contactObservation contact;
} thresholdResult;

static thresholdResult run_threshold_case(float approach_speed)
{
    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = b3Vec3_zero;
    world_def.enableSleep = false;
    world_def.enableContinuous = false;
    world_def.restitutionThreshold = 1.0f;
    b3WorldId world = b3CreateWorld(&world_def);
    create_ground(world, 0.0f, 1.0f);
    b3BodyId body = create_box(world, 0.505f, 0.0f, 1.0f,
                               (b3Vec3){0.0f, approach_speed, 0.0f});
    b3World_Step(world, 1.0f / 60.0f, 1);

    thresholdResult result = {
        approach_speed,
        b3Body_GetLinearVelocity(body).y,
        observe_contact(body),
    };
    b3DestroyWorld(world);
    return result;
}

static bool run_threshold_twins(FILE* jsonl)
{
    thresholdResult slow = run_threshold_case(-0.999f);
    thresholdResult fast = run_threshold_case(-1.001f);
    fprintf(jsonl,
            "{\"case\":\"threshold_twin_slow\",\"threshold\":1,"
            "\"pre_vy\":%.17g,\"post_vy\":%.17g,\"saved_vn\":%.17g,"
            "\"normal_impulse\":%.17g,\"points\":%d}\n",
            slow.pre_velocity, slow.post_velocity, slow.contact.saved_normal_velocity,
            slow.contact.normal_impulse, slow.contact.point_count);
    fprintf(jsonl,
            "{\"case\":\"threshold_twin_fast\",\"threshold\":1,"
            "\"pre_vy\":%.17g,\"post_vy\":%.17g,\"saved_vn\":%.17g,"
            "\"normal_impulse\":%.17g,\"points\":%d}\n",
            fast.pre_velocity, fast.post_velocity, fast.contact.saved_normal_velocity,
            fast.contact.normal_impulse, fast.contact.point_count);

    return slow.contact.point_count > 0 && fast.contact.point_count > 0 &&
           slow.contact.saved_normal_velocity > -1.0 &&
           fast.contact.saved_normal_velocity < -1.0 && slow.post_velocity <= 0.0 &&
           fast.post_velocity > 0.0;
}

static bool run_friction_bound(FILE* jsonl)
{
    const float friction = 0.7f;
    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = b3Vec3_zero;
    world_def.enableSleep = false;
    world_def.enableContinuous = false;
    b3WorldId world = b3CreateWorld(&world_def);
    create_ground(world, friction, 0.0f);
    b3BodyId body = create_box(world, 0.45f, friction, 0.0f,
                               (b3Vec3){2.0f, -1.0f, 0.5f});
    b3World_Step(world, 1.0f / 60.0f, 1);

    contactObservation contact = observe_contact(body);
    double radius = (double)friction * contact.normal_impulse;
    bool within = contact.point_count > 0 && contact.friction_impulse <= radius + 1e-6;
    fprintf(jsonl,
            "{\"case\":\"friction_disk\",\"mu\":%.17g,"
            "\"friction_impulse\":%.17g,\"normal_impulse\":%.17g,"
            "\"radius\":%.17g,\"within\":%s,\"points\":%d}\n",
            (double)friction, contact.friction_impulse, contact.normal_impulse, radius,
            within ? "true" : "false", contact.point_count);
    b3DestroyWorld(world);
    return within;
}

static bool write_oracle_examples(FILE* jsonl)
{
    csSoftness softness = cs_make_softness(30.0, 10.0, 1.0 / 60.0);
    csNormalResult normal = cs_normal_update(0.25, 0.5, 1.0, -2.0, 0.0, 0.0);
    csVec2 friction = cs_project_friction((csVec2){3.0, 4.0}, 0.5, 4.0);
    fprintf(jsonl,
            "{\"case\":\"pure_oracle\",\"mass_scale\":%.17g,"
            "\"impulse_scale\":%.17g,\"softness_sum\":%.17g,"
            "\"normal_impulse\":%.17g,\"friction_x\":%.17g,"
            "\"friction_y\":%.17g,\"friction_norm\":%.17g}\n",
            softness.mass_scale, softness.impulse_scale,
            softness.mass_scale + softness.impulse_scale, normal.impulse, friction.x,
            friction.y, hypot(friction.x, friction.y));
    return true;
}

int main(int argc, char** argv)
{
    bool self_test_only = argc == 2 && strcmp(argv[1], "--self-test") == 0;
    if (argc > 2 || (argc == 2 && !self_test_only))
    {
        fprintf(stderr, "usage: %s [--self-test]\n", argv[0]);
        return EXIT_FAILURE;
    }
    if (!cs_self_test())
    {
        fprintf(stderr, "contact shell self-test: FAILED\n");
        return EXIT_FAILURE;
    }
    printf("contact shell self-test: passed\n");
    if (self_test_only)
    {
        return EXIT_SUCCESS;
    }
    if (!ensure_outputs())
    {
        perror("outputs");
        return EXIT_FAILURE;
    }

    FILE* jsonl = fopen("outputs/contact_shell.jsonl", "w");
    if (jsonl == NULL)
    {
        perror("outputs/contact_shell.jsonl");
        return EXIT_FAILURE;
    }
    bool ok = write_oracle_examples(jsonl) && run_energetic_penetrator(jsonl) &&
              run_threshold_twins(jsonl) && run_friction_bound(jsonl);
    fclose(jsonl);
    printf("wrote outputs/contact_shell.jsonl\n");
    return ok ? EXIT_SUCCESS : EXIT_FAILURE;
}
