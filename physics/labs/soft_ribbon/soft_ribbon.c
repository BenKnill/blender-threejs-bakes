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
    columns = 12,
    rows = 3,
    node_count = columns * rows,
    simulation_hz = 60,
    sample_hz = 30,
    duration_seconds = 5,
    step_count = simulation_hz * duration_seconds,
    max_edges = 160
};

typedef struct Edge
{
    int a;
    int b;
    const char* kind;
    float rest_length;
    float hertz;
} Edge;

typedef struct Result
{
    bool finite;
    float max_speed;
    float max_stretch_ratio;
    float min_height;
    int edge_count;
} Result;

static int node_index(int column, int row)
{
    return column * rows + row;
}

static b3Vec3 subtract_pos(b3Pos a, b3Pos b)
{
    return (b3Vec3){a.x - b.x, a.y - b.y, a.z - b.z};
}

static float length_vec(b3Vec3 value)
{
    return sqrtf(value.x * value.x + value.y * value.y + value.z * value.z);
}

static void append_edge(Edge* edges, int* count, int a, int b, const char* kind,
                        float hertz, const b3Pos* rest_positions)
{
    if (*count >= max_edges)
    {
        fprintf(stderr, "soft ribbon edge capacity exceeded\n");
        exit(EXIT_FAILURE);
    }
    Edge* edge = edges + *count;
    edge->a = a;
    edge->b = b;
    edge->kind = kind;
    edge->hertz = hertz;
    edge->rest_length = length_vec(subtract_pos(rest_positions[b], rest_positions[a]));
    *count += 1;
}

static int build_edges(Edge* edges, const b3Pos* rest_positions)
{
    int count = 0;
    for (int column = 0; column < columns; ++column)
    {
        for (int row = 0; row < rows; ++row)
        {
            if (column + 1 < columns)
            {
                append_edge(edges, &count, node_index(column, row),
                            node_index(column + 1, row), "warp", 7.5f, rest_positions);
            }
            if (row + 1 < rows)
            {
                append_edge(edges, &count, node_index(column, row),
                            node_index(column, row + 1), "weft", 7.5f, rest_positions);
            }
            if (column + 1 < columns && row + 1 < rows)
            {
                append_edge(edges, &count, node_index(column, row),
                            node_index(column + 1, row + 1), "shear", 6.0f,
                            rest_positions);
                append_edge(edges, &count, node_index(column + 1, row),
                            node_index(column, row + 1), "shear", 6.0f, rest_positions);
            }
            if (column + 2 < columns)
            {
                append_edge(edges, &count, node_index(column, row),
                            node_index(column + 2, row), "bend", 3.5f, rest_positions);
            }
        }
    }
    return count;
}

static bool ensure_directory(const char* path)
{
    return mkdir(path, 0755) == 0 || errno == EEXIST;
}

static Result run_simulation(FILE* motion, FILE* topology)
{
    const float spacing = 0.8f;
    const float width_spacing = 0.45f;
    const float floor_height = 0.0f;
    b3Pos rest_positions[node_count];
    b3BodyId bodies[node_count];
    Edge edges[max_edges];

    for (int column = 0; column < columns; ++column)
    {
        for (int row = 0; row < rows; ++row)
        {
            int index = node_index(column, row);
            rest_positions[index] = (b3Pos){-4.4f + spacing * (float)column, 5.2f,
                                            width_spacing * (float)(row - 1)};
        }
    }
    int edge_count = build_edges(edges, rest_positions);

    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = (b3Vec3){0.0f, -9.8f, 0.0f};
    world_def.enableSleep = false;
    world_def.workerCount = 1;
    b3WorldId world = b3CreateWorld(&world_def);

    b3BodyDef ground_def = b3DefaultBodyDef();
    ground_def.position = (b3Pos){0.0f, floor_height - 0.3f, 0.0f};
    b3BodyId ground = b3CreateBody(world, &ground_def);
    // The initial kick swings the free end well out of the ribbon's resting
    // z-range. Keep the stage broad enough that the contact is intentional,
    // rather than accidentally testing the platform edge.
    b3BoxHull ground_hull = b3MakeBoxHull(12.0f, 0.3f, 12.0f);
    b3ShapeDef ground_shape = b3DefaultShapeDef();
    ground_shape.baseMaterial.friction = 0.75f;
    ground_shape.baseMaterial.restitution = 0.08f;
    ground_shape.filter.categoryBits = 0x1;
    ground_shape.filter.maskBits = 0x2;
    b3CreateHullShape(ground, &ground_shape, &ground_hull.base);

    b3Sphere sphere = {{0.0f, 0.0f, 0.0f}, 0.11f};
    b3ShapeDef node_shape = b3DefaultShapeDef();
    node_shape.density = 0.85f;
    node_shape.baseMaterial.friction = 0.5f;
    node_shape.baseMaterial.restitution = 0.05f;
    node_shape.filter.categoryBits = 0x2;
    node_shape.filter.maskBits = 0x1;
    node_shape.filter.groupIndex = -63;

    for (int column = 0; column < columns; ++column)
    {
        for (int row = 0; row < rows; ++row)
        {
            int index = node_index(column, row);
            b3BodyDef body_def = b3DefaultBodyDef();
            body_def.type = column == 0 ? b3_staticBody : b3_dynamicBody;
            body_def.position = rest_positions[index];
            body_def.linearDamping = 0.08f;
            body_def.angularDamping = 0.3f;
            body_def.enableSleep = false;
            bodies[index] = b3CreateBody(world, &body_def);
            b3CreateSphereShape(bodies[index], &node_shape, &sphere);
        }
    }

    for (int i = 0; i < edge_count; ++i)
    {
        Edge* edge = edges + i;
        b3DistanceJointDef joint_def = b3DefaultDistanceJointDef();
        joint_def.base.bodyIdA = bodies[edge->a];
        joint_def.base.bodyIdB = bodies[edge->b];
        joint_def.base.collideConnected = false;
        joint_def.length = edge->rest_length;
        joint_def.enableSpring = true;
        joint_def.hertz = edge->hertz;
        joint_def.dampingRatio = strcmp(edge->kind, "bend") == 0 ? 0.42f : 0.3f;
        joint_def.lowerSpringForce = -2500.0f;
        joint_def.upperSpringForce = 2500.0f;
        b3CreateDistanceJoint(world, &joint_def);
    }

    for (int row = 0; row < rows; ++row)
    {
        float across = (float)(row - 1);
        b3Body_SetLinearVelocity(bodies[node_index(columns - 1, row)],
                                 (b3Vec3){-0.8f, 1.5f + 0.35f * across,
                                          3.8f - 1.3f * across});
    }

    if (topology != NULL)
    {
        fprintf(topology, "edge,a,b,kind,rest_length_m,hertz\n");
        for (int i = 0; i < edge_count; ++i)
        {
            fprintf(topology, "%d,%d,%d,%s,%.9g,%.9g\n", i, edges[i].a, edges[i].b,
                    edges[i].kind, (double)edges[i].rest_length, (double)edges[i].hertz);
        }
    }
    if (motion != NULL)
    {
        fprintf(motion, "frame,time_s,node,pinned,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s\n");
    }

    Result result = {.finite = true,
                     .max_speed = 0.0f,
                     .max_stretch_ratio = 1.0f,
                     .min_height = INFINITY,
                     .edge_count = edge_count};
    int frame = 0;
    for (int step = 0; step <= step_count; ++step)
    {
        if (step % (simulation_hz / sample_hz) == 0)
        {
            for (int i = 0; i < node_count; ++i)
            {
                b3Pos position = b3Body_GetPosition(bodies[i]);
                b3Vec3 velocity = b3Body_GetLinearVelocity(bodies[i]);
                float speed = length_vec(velocity);
                result.finite = result.finite && isfinite(position.x) && isfinite(position.y) &&
                                isfinite(position.z) && isfinite(speed);
                result.max_speed = fmaxf(result.max_speed, speed);
                result.min_height = fminf(result.min_height, position.y);
                if (motion != NULL)
                {
                    fprintf(motion, "%d,%.9g,%d,%d,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g\n",
                            frame, (double)step / simulation_hz, i, i < rows ? 1 : 0,
                            (double)position.x, (double)position.y, (double)position.z,
                            (double)velocity.x, (double)velocity.y, (double)velocity.z);
                }
            }
            for (int i = 0; i < edge_count; ++i)
            {
                float current = length_vec(subtract_pos(b3Body_GetPosition(bodies[edges[i].b]),
                                                        b3Body_GetPosition(bodies[edges[i].a])));
                result.max_stretch_ratio =
                    fmaxf(result.max_stretch_ratio, current / edges[i].rest_length);
            }
            frame += 1;
        }
        if (step < step_count)
        {
            b3World_Step(world, 1.0f / simulation_hz, 4);
        }
    }

    b3DestroyWorld(world);
    return result;
}

int main(int argc, char** argv)
{
    bool self_test = argc == 2 && strcmp(argv[1], "--self-test") == 0;
    if (argc > 2 || (argc == 2 && !self_test))
    {
        fprintf(stderr, "usage: %s [--self-test]\n", argv[0]);
        return EXIT_FAILURE;
    }

    FILE* motion = NULL;
    FILE* topology = NULL;
    if (!self_test)
    {
        if (!ensure_directory("outputs"))
        {
            perror("outputs");
            return EXIT_FAILURE;
        }
        motion = fopen("outputs/soft_ribbon_motion.csv", "w");
        topology = fopen("outputs/soft_ribbon_topology.csv", "w");
        if (motion == NULL || topology == NULL)
        {
            perror("soft ribbon outputs");
            if (motion != NULL)
                fclose(motion);
            if (topology != NULL)
                fclose(topology);
            return EXIT_FAILURE;
        }
    }

    clock_t started = clock();
    Result result = run_simulation(motion, topology);
    double cpu_ms = 1000.0 * (double)(clock() - started) / CLOCKS_PER_SEC;
    if (motion != NULL)
        fclose(motion);
    if (topology != NULL)
        fclose(topology);

    if (!self_test)
    {
        FILE* performance = fopen("outputs/performance.json", "w");
        if (performance == NULL)
        {
            perror("outputs/performance.json");
            return EXIT_FAILURE;
        }
        fprintf(performance,
                "{\n  \"simulation_cpu_ms\": %.6f,\n  \"simulated_seconds\": %d,\n"
                "  \"steps\": %d,\n  \"substeps_per_step\": 4,\n"
                "  \"realtime_factor\": %.6f\n}\n",
                cpu_ms, duration_seconds, step_count,
                cpu_ms > 0.0 ? 1000.0 * duration_seconds / cpu_ms : 0.0);
        fclose(performance);
    }

    bool healthy = result.finite && result.max_speed < 100.0f &&
                   result.max_stretch_ratio < 2.0f && result.min_height > -0.2f;
    printf("soft ribbon: nodes=%d edges=%d finite=%s max_speed=%.4g "
           "max_stretch=%.4g min_height=%.4g\n",
           node_count, result.edge_count, result.finite ? "yes" : "no",
           (double)result.max_speed, (double)result.max_stretch_ratio,
           (double)result.min_height);
    return healthy ? EXIT_SUCCESS : EXIT_FAILURE;
}
