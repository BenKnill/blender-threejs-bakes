// SPDX-License-Identifier: MIT

#include "box3d/box3d.h"

#include <errno.h>
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>

enum
{
    max_nodes = 128,
    max_edges = 256,
    hair_strands = 7,
    simulation_hz = 60,
    sample_hz = 30,
    equilibration_seconds = 12,
    duration_seconds = 6,
    step_count = simulation_hz * duration_seconds
};

typedef struct Node
{
    b3Pos rest;
    const char* kind;
    bool pinned;
    float radius;
    float density;
    float wind_scale;
} Node;

typedef struct Edge
{
    int a;
    int b;
    const char* kind;
    float rest_length;
    float hertz;
    float damping;
} Edge;

typedef struct Garden
{
    Node nodes[max_nodes];
    Edge edges[max_edges];
    int node_count;
    int edge_count;
    int crown_tip;
    int hair_tips[hair_strands];
} Garden;

typedef struct Result
{
    bool finite;
    float max_speed;
    float max_stretch_ratio;
    float min_height;
    float max_crown_displacement;
    float max_hair_tip_displacement;
} Result;

static b3Vec3 difference(b3Pos a, b3Pos b)
{
    return (b3Vec3){a.x - b.x, a.y - b.y, a.z - b.z};
}

static float vector_length(b3Vec3 value)
{
    return sqrtf(value.x * value.x + value.y * value.y + value.z * value.z);
}

static float horizontal_distance(b3Pos a, b3Pos b)
{
    float dx = a.x - b.x;
    float dz = a.z - b.z;
    return sqrtf(dx * dx + dz * dz);
}

static int add_node(Garden* garden, b3Pos rest, const char* kind, bool pinned,
                    float radius, float density, float wind_scale)
{
    if (garden->node_count >= max_nodes)
    {
        fprintf(stderr, "wind garden node capacity exceeded\n");
        exit(EXIT_FAILURE);
    }
    int index = garden->node_count++;
    garden->nodes[index] = (Node){.rest = rest,
                                 .kind = kind,
                                 .pinned = pinned,
                                 .radius = radius,
                                 .density = density,
                                 .wind_scale = wind_scale};
    return index;
}

static void add_edge(Garden* garden, int a, int b, const char* kind, float hertz,
                     float damping)
{
    if (garden->edge_count >= max_edges)
    {
        fprintf(stderr, "wind garden edge capacity exceeded\n");
        exit(EXIT_FAILURE);
    }
    garden->edges[garden->edge_count++] =
        (Edge){.a = a,
               .b = b,
               .kind = kind,
               .rest_length = vector_length(difference(garden->nodes[b].rest,
                                                       garden->nodes[a].rest)),
               .hertz = hertz,
               .damping = damping};
}

static Garden build_garden(void)
{
    Garden garden = {0};
    int trunk[8];
    for (int i = 0; i < 8; ++i)
    {
        float sway = 0.06f * sinf(0.8f * (float)i);
        trunk[i] = add_node(&garden, (b3Pos){-2.8f + sway, 0.28f + 0.68f * i, 0.0f},
                            "trunk", true, 0.16f - 0.008f * i, 2.2f,
                            0.18f + 0.08f * i);
        if (i > 0)
            add_edge(&garden, trunk[i - 1], trunk[i], "trunk", 12.0f, 0.55f);
        if (i > 1)
            add_edge(&garden, trunk[i - 2], trunk[i], "tree_bend", 8.5f, 0.6f);
    }
    garden.crown_tip = trunk[7];
    // A point root leaves the entire distance-spring tree free to rotate about
    // the trunk axis under its asymmetric branch weight. Two off-axis root
    // braces establish a real base frame while leaving the crown compliant.
    int root_a = add_node(&garden, (b3Pos){-2.38f, 0.28f, -0.42f}, "trunk", true,
                          0.13f, 2.2f, 0.0f);
    int root_b = add_node(&garden, (b3Pos){-2.38f, 0.28f, 0.42f}, "trunk", true,
                          0.13f, 2.2f, 0.0f);
    add_edge(&garden, root_a, trunk[2], "tree_bend", 10.0f, 0.62f);
    add_edge(&garden, root_a, trunk[3], "tree_bend", 10.0f, 0.62f);
    add_edge(&garden, root_b, trunk[2], "tree_bend", 10.0f, 0.62f);
    add_edge(&garden, root_b, trunk[3], "tree_bend", 10.0f, 0.62f);

    const int parent_levels[5] = {3, 4, 5, 6, 7};
    const float directions[5][2] = {
        {0.92f, 0.18f}, {-0.82f, 0.30f}, {0.35f, 0.92f}, {-0.20f, -0.95f}, {0.88f, -0.42f}};
    for (int branch = 0; branch < 5; ++branch)
    {
        int previous = trunk[parent_levels[branch]];
        int before_previous = -1;
        for (int segment = 1; segment <= 5; ++segment)
        {
            float taper = (float)segment / 5.0f;
            b3Pos root = garden.nodes[trunk[parent_levels[branch]]].rest;
            b3Pos position = {root.x + 0.53f * segment * directions[branch][0],
                              root.y + 0.15f * segment - 0.035f * segment * segment,
                              root.z + 0.53f * segment * directions[branch][1]};
            int node = add_node(&garden, position, segment == 5 ? "leaf" : "branch", false,
                                segment == 5 ? 0.14f : 0.10f, 1.2f,
                                0.75f + 0.55f * taper);
            add_edge(&garden, previous, node, "branch", 10.0f, 0.48f);
            if (segment == 1)
                add_edge(&garden, trunk[parent_levels[branch] - 1], node, "tree_bend",
                         8.0f, 0.58f);
            if (before_previous >= 0)
                add_edge(&garden, before_previous, node, "tree_bend", 7.5f, 0.55f);
            before_previous = previous;
            previous = node;
            if (branch == 4 && segment == 5)
                garden.crown_tip = node;
        }
    }

    for (int strand = 0; strand < hair_strands; ++strand)
    {
        float z = -1.32f + 0.44f * strand;
        float x = 2.65f + 0.13f * cosf(0.75f * (float)(strand - 3));
        int root = add_node(&garden, (b3Pos){x, 6.15f, z}, "hair_root", true, 0.11f,
                            0.8f, 0.0f);
        int previous = root;
        int before_previous = -1;
        int segments = 7 + strand % 3;
        for (int segment = 1; segment <= segments; ++segment)
        {
            b3Pos position = {x, 6.15f - 0.43f * segment, z};
            int node = add_node(&garden, position, "hair", false, 0.065f, 0.52f,
                                1.0f + 0.06f * segment + 0.04f * strand);
            add_edge(&garden, previous, node, "hair", 8.5f, 0.28f);
            if (before_previous >= 0)
                add_edge(&garden, before_previous, node, "hair_bend", 2.4f, 0.36f);
            before_previous = previous;
            previous = node;
        }
        garden.hair_tips[strand] = previous;
    }
    return garden;
}

static bool ensure_directory(const char* path)
{
    return mkdir(path, 0755) == 0 || errno == EEXIST;
}

static void apply_wind(const Garden* garden, const b3BodyId* bodies, float time_s)
{
    float ramp_phase = fminf(time_s / 0.8f, 1.0f);
    float ramp = 0.5f - 0.5f * cosf(3.14159265f * ramp_phase);
    for (int i = 0; i < garden->node_count; ++i)
    {
        const Node* node = garden->nodes + i;
        if (node->pinned)
            continue;
        b3Pos position = b3Body_GetPosition(bodies[i]);
        float traveling = sinf(2.35f * time_s - 0.72f * position.y + 0.85f * position.z);
        float flutter = sinf(5.8f * time_s - 1.35f * position.y - 0.4f * position.z);
        float pulse = 0.55f + 0.45f * sinf(0.62f * time_s - 0.3f);
        float acceleration_x = node->wind_scale * ramp * (3.0f + 3.8f * traveling * pulse + 0.9f * flutter);
        float acceleration_z = node->wind_scale * ramp * (1.25f * traveling - 0.75f * flutter);
        float mass = b3Body_GetMass(bodies[i]);
        b3Body_ApplyForceToCenter(
            bodies[i], (b3Vec3){mass * acceleration_x, 0.0f, mass * acceleration_z}, true);
    }
}

static Result simulate(const Garden* garden, bool wind_enabled, FILE* motion,
                       FILE* topology)
{
    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = (b3Vec3){0.0f, -9.8f, 0.0f};
    world_def.enableSleep = false;
    world_def.workerCount = 1;
    b3WorldId world = b3CreateWorld(&world_def);

    b3BodyDef ground_def = b3DefaultBodyDef();
    ground_def.position = (b3Pos){0.0f, -0.25f, 0.0f};
    b3BodyId ground = b3CreateBody(world, &ground_def);
    b3BoxHull ground_hull = b3MakeBoxHull(9.0f, 0.25f, 6.0f);
    b3ShapeDef ground_shape = b3DefaultShapeDef();
    ground_shape.baseMaterial.friction = 0.72f;
    ground_shape.filter.categoryBits = 0x1;
    ground_shape.filter.maskBits = 0x2;
    b3CreateHullShape(ground, &ground_shape, &ground_hull.base);

    b3BodyId bodies[max_nodes];
    for (int i = 0; i < garden->node_count; ++i)
    {
        const Node* node = garden->nodes + i;
        b3BodyDef body_def = b3DefaultBodyDef();
        body_def.type = node->pinned ? b3_staticBody : b3_dynamicBody;
        body_def.position = node->rest;
        body_def.linearDamping = strcmp(node->kind, "hair") == 0 ? 0.06f : 0.35f;
        body_def.angularDamping = 0.3f;
        body_def.enableSleep = false;
        bodies[i] = b3CreateBody(world, &body_def);
        b3Sphere sphere = {{0.0f, 0.0f, 0.0f}, node->radius};
        b3ShapeDef shape = b3DefaultShapeDef();
        shape.density = node->density;
        shape.baseMaterial.friction = 0.45f;
        shape.filter.categoryBits = 0x2;
        shape.filter.maskBits = 0x1;
        shape.filter.groupIndex = -67;
        b3CreateSphereShape(bodies[i], &shape, &sphere);
    }

    for (int i = 0; i < garden->edge_count; ++i)
    {
        const Edge* edge = garden->edges + i;
        b3DistanceJointDef joint = b3DefaultDistanceJointDef();
        joint.base.bodyIdA = bodies[edge->a];
        joint.base.bodyIdB = bodies[edge->b];
        joint.length = edge->rest_length;
        joint.enableSpring = true;
        joint.hertz = edge->hertz;
        joint.dampingRatio = edge->damping;
        joint.lowerSpringForce = -3000.0f;
        joint.upperSpringForce = 3000.0f;
        b3CreateDistanceJoint(world, &joint);
    }

    // Begin both the calm control and the wind run from the same gravity-settled
    // state. This keeps authored branch sag out of the reported wind response.
    for (int step = 0; step < equilibration_seconds * simulation_hz; ++step)
        b3World_Step(world, 1.0f / simulation_hz, 4);
    b3Pos baseline_positions[max_nodes];
    for (int i = 0; i < garden->node_count; ++i)
        baseline_positions[i] = b3Body_GetPosition(bodies[i]);

    if (topology != NULL)
    {
        fprintf(topology, "edge,a,b,kind,rest_length_m,hertz\n");
        for (int i = 0; i < garden->edge_count; ++i)
        {
            const Edge* edge = garden->edges + i;
            fprintf(topology, "%d,%d,%d,%s,%.9g,%.9g\n", i, edge->a, edge->b,
                    edge->kind, (double)edge->rest_length, (double)edge->hertz);
        }
    }
    if (motion != NULL)
    {
        fprintf(motion,
                "frame,time_s,node,kind,pinned,radius_m,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s\n");
    }

    Result result = {.finite = true,
                     .max_speed = 0.0f,
                     .max_stretch_ratio = 1.0f,
                     .min_height = INFINITY,
                     .max_crown_displacement = 0.0f,
                     .max_hair_tip_displacement = 0.0f};
    int frame = 0;
    for (int step = 0; step <= step_count; ++step)
    {
        float time_s = (float)step / simulation_hz;
        if (step % (simulation_hz / sample_hz) == 0)
        {
            for (int i = 0; i < garden->node_count; ++i)
            {
                b3Pos position = b3Body_GetPosition(bodies[i]);
                b3Vec3 velocity = b3Body_GetLinearVelocity(bodies[i]);
                float speed = vector_length(velocity);
                result.finite = result.finite && isfinite(position.x) && isfinite(position.y) &&
                                isfinite(position.z) && isfinite(speed);
                result.max_speed = fmaxf(result.max_speed, speed);
                result.min_height = fminf(result.min_height, position.y);
                if (motion != NULL)
                {
                    const Node* node = garden->nodes + i;
                    fprintf(motion,
                            "%d,%.9g,%d,%s,%d,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g\n",
                            frame, (double)time_s, i, node->kind, node->pinned ? 1 : 0,
                            (double)node->radius, (double)position.x, (double)position.y,
                            (double)position.z, (double)velocity.x, (double)velocity.y,
                            (double)velocity.z);
                }
            }
            b3Pos crown = b3Body_GetPosition(bodies[garden->crown_tip]);
            result.max_crown_displacement = fmaxf(
                result.max_crown_displacement,
                horizontal_distance(crown, baseline_positions[garden->crown_tip]));
            for (int strand = 0; strand < hair_strands; ++strand)
            {
                int tip = garden->hair_tips[strand];
                result.max_hair_tip_displacement =
                    fmaxf(result.max_hair_tip_displacement,
                          horizontal_distance(b3Body_GetPosition(bodies[tip]),
                                              baseline_positions[tip]));
            }
            for (int i = 0; i < garden->edge_count; ++i)
            {
                const Edge* edge = garden->edges + i;
                float current = vector_length(difference(b3Body_GetPosition(bodies[edge->b]),
                                                         b3Body_GetPosition(bodies[edge->a])));
                result.max_stretch_ratio =
                    fmaxf(result.max_stretch_ratio, current / edge->rest_length);
            }
            frame += 1;
        }
        if (step < step_count)
        {
            if (wind_enabled)
                apply_wind(garden, bodies, time_s);
            b3World_Step(world, 1.0f / simulation_hz, 4);
        }
    }
    b3DestroyWorld(world);
    return result;
}

static bool result_is_healthy(Result result)
{
    return result.finite && result.max_speed < 80.0f && result.max_stretch_ratio < 1.8f &&
           result.min_height > -0.2f;
}

int main(int argc, char** argv)
{
    bool self_test = argc == 2 && strcmp(argv[1], "--self-test") == 0;
    if (argc > 2 || (argc == 2 && !self_test))
    {
        fprintf(stderr, "usage: %s [--self-test]\n", argv[0]);
        return EXIT_FAILURE;
    }
    Garden garden = build_garden();
    FILE* motion = NULL;
    FILE* topology = NULL;
    if (!self_test)
    {
        if (!ensure_directory("outputs"))
        {
            perror("outputs");
            return EXIT_FAILURE;
        }
        motion = fopen("outputs/wind_garden_motion.csv", "w");
        topology = fopen("outputs/wind_garden_topology.csv", "w");
        if (motion == NULL || topology == NULL)
        {
            perror("wind garden outputs");
            return EXIT_FAILURE;
        }
    }

    clock_t started = clock();
    Result wind = simulate(&garden, true, motion, topology);
    double cpu_ms = 1000.0 * (double)(clock() - started) / CLOCKS_PER_SEC;
    if (motion != NULL)
        fclose(motion);
    if (topology != NULL)
        fclose(topology);
    Result calm = simulate(&garden, false, NULL, NULL);

    if (!self_test)
    {
        FILE* metrics = fopen("outputs/metrics.json", "w");
        if (metrics == NULL)
        {
            perror("outputs/metrics.json");
            return EXIT_FAILURE;
        }
        fprintf(metrics,
                "{\n  \"nodes\": %d,\n  \"edges\": %d,\n  \"simulation_cpu_ms\": %.6f,\n"
                "  \"simulated_seconds\": %d,\n  \"equilibration_seconds\": %d,\n"
                "  \"steps\": %d,\n"
                "  \"substeps_per_step\": 4,\n  \"realtime_factor\": %.6f,\n"
                "  \"wind_max_stretch_ratio\": %.9g,\n"
                "  \"wind_max_crown_displacement_m\": %.9g,\n"
                "  \"wind_max_hair_tip_displacement_m\": %.9g,\n"
                "  \"calm_max_crown_displacement_m\": %.9g,\n"
                "  \"calm_max_hair_tip_displacement_m\": %.9g\n}\n",
                garden.node_count, garden.edge_count, cpu_ms, duration_seconds,
                equilibration_seconds, step_count,
                cpu_ms > 0.0
                    ? 1000.0 * (duration_seconds + equilibration_seconds) / cpu_ms
                    : 0.0,
                (double)wind.max_stretch_ratio, (double)wind.max_crown_displacement,
                (double)wind.max_hair_tip_displacement, (double)calm.max_crown_displacement,
                (double)calm.max_hair_tip_displacement);
        fclose(metrics);
    }

    printf("wind garden: nodes=%d edges=%d finite=%s stretch=%.4g crown=%.4g "
           "hair=%.4g calm_hair=%.4g\n",
           garden.node_count, garden.edge_count, wind.finite ? "yes" : "no",
           (double)wind.max_stretch_ratio, (double)wind.max_crown_displacement,
           (double)wind.max_hair_tip_displacement, (double)calm.max_hair_tip_displacement);
    bool wind_visible = wind.max_hair_tip_displacement > calm.max_hair_tip_displacement + 0.35f &&
                        wind.max_crown_displacement > calm.max_crown_displacement + 0.25f;
    return result_is_healthy(wind) && result_is_healthy(calm) && wind_visible ? EXIT_SUCCESS
                                                                             : EXIT_FAILURE;
}
