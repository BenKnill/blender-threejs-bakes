// SPDX-License-Identifier: MIT

#include "box3d/box3d.h"

#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>

enum
{
    guide_columns = 4,
    guide_rows = 4,
    guide_count = guide_columns * guide_rows,
    links_per_guide = 8,
    body_count = guide_count * links_per_guide,
    joint_count = body_count,
    simulation_hz = 60,
    sample_hz = 15,
    phase_seconds = 6,
    duration_seconds = phase_seconds * 2,
    step_count = simulation_hz * duration_seconds,
    substeps_per_step = 4,
    azimuth_bins = 24
};

static const float pi_f = 3.14159265358979323846f;
static const float link_half_length = 0.14f;
static const float link_radius = 0.028f;
static const float guide_spacing = 0.068f;

typedef struct JointEndpoints
{
    b3BodyId parent;
    b3BodyId child;
    b3Vec3 local_a;
    b3Vec3 local_b;
} JointEndpoints;

typedef struct PhaseMetrics
{
    double displacement_sum;
    double alignment_sum;
    int sample_count;
    int alignment_count;
    float max_displacement;
    uint32_t azimuth_mask;
} PhaseMetrics;

typedef struct Result
{
    const char* id;
    bool finite;
    uint64_t trajectory_digest;
    double cpu_ms;
    float max_speed;
    float max_angular_speed;
    float max_joint_gap;
    float max_tip_displacement;
    int max_active_contacts;
    int contact_begins;
    int contact_ends;
    PhaseMetrics strong;
    PhaseMetrics moderate;
} Result;

static int body_index(int guide, int link)
{
    return guide * links_per_guide + link;
}

static b3Vec3 add_vec(b3Vec3 a, b3Vec3 b)
{
    return (b3Vec3){a.x + b.x, a.y + b.y, a.z + b.z};
}

static b3Vec3 subtract_vec(b3Vec3 a, b3Vec3 b)
{
    return (b3Vec3){a.x - b.x, a.y - b.y, a.z - b.z};
}

static b3Vec3 scale_vec(b3Vec3 value, float scale)
{
    return (b3Vec3){value.x * scale, value.y * scale, value.z * scale};
}

static float dot_vec(b3Vec3 a, b3Vec3 b)
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

static float length_vec(b3Vec3 value)
{
    return sqrtf(dot_vec(value, value));
}

static b3Vec3 normalize_vec(b3Vec3 value)
{
    float length = length_vec(value);
    return length > 1.0e-8f ? scale_vec(value, 1.0f / length) : b3Vec3_zero;
}

static b3Vec3 subtract_pos(b3Pos a, b3Pos b)
{
    return (b3Vec3){a.x - b.x, a.y - b.y, a.z - b.z};
}

static bool ensure_directory(const char* path)
{
    return mkdir(path, 0755) == 0 || errno == EEXIST;
}

static uint64_t fnv1a_i64(uint64_t hash, int64_t value)
{
    uint64_t encoded = (uint64_t)value;
    for (int byte = 0; byte < 8; ++byte)
    {
        hash ^= (encoded >> (8 * byte)) & UINT64_C(0xff);
        hash *= UINT64_C(1099511628211);
    }
    return hash;
}

static uint64_t hash_position(uint64_t hash, b3Pos position)
{
    hash = fnv1a_i64(hash, llround((double)position.x * 1.0e6));
    hash = fnv1a_i64(hash, llround((double)position.y * 1.0e6));
    return fnv1a_i64(hash, llround((double)position.z * 1.0e6));
}

static b3Vec3 wind_at_time(float time_s, bool enabled)
{
    if (!enabled)
    {
        return b3Vec3_zero;
    }
    float phase_time = time_s < phase_seconds ? time_s : time_s - phase_seconds;
    float speed = time_s < phase_seconds ? 6.0f : 3.25f;
    float angle = 2.0f * pi_f * phase_time / phase_seconds;
    return (b3Vec3){speed * cosf(angle), 0.0f, speed * sinf(angle)};
}

static b3Vec3 aerodynamic_force(b3BodyId body, b3Vec3 wind, int guide)
{
    const float air_density = 1.225f;
    const float normal_drag = 1.15f;
    const float axial_drag = 0.08f;
    const float projected_area = 2.0f * link_radius * 2.0f * link_half_length;
    b3Vec3 velocity = b3Body_GetLinearVelocity(body);
    b3Vec3 relative = subtract_vec(wind, velocity);
    b3Vec3 axis = normalize_vec(b3Body_GetWorldVector(body, (b3Vec3){0.0f, 1.0f, 0.0f}));
    b3Vec3 axial = scale_vec(axis, dot_vec(relative, axis));
    b3Vec3 normal = subtract_vec(relative, axial);
    b3Vec3 normal_force = scale_vec(normal, normal_drag * length_vec(normal));
    b3Vec3 axial_force = scale_vec(axial, axial_drag * length_vec(axial));
    float guide_variation = 0.92f + 0.16f * (float)((guide * 7) % 11) / 10.0f;
    return scale_vec(add_vec(normal_force, axial_force),
                     0.5f * air_density * projected_area * guide_variation);
}

static void record_phase_sample(PhaseMetrics* metrics, b3Vec3 mean_tip_offset,
                                b3Vec3 wind)
{
    float displacement = hypotf(mean_tip_offset.x, mean_tip_offset.z);
    metrics->displacement_sum += displacement;
    metrics->sample_count += 1;
    metrics->max_displacement = fmaxf(metrics->max_displacement, displacement);
    if (displacement > 0.025f)
    {
        float angle = atan2f(mean_tip_offset.z, mean_tip_offset.x);
        if (angle < 0.0f)
        {
            angle += 2.0f * pi_f;
        }
        int bin = (int)floorf(angle * azimuth_bins / (2.0f * pi_f));
        if (bin >= azimuth_bins)
        {
            bin = azimuth_bins - 1;
        }
        metrics->azimuth_mask |= UINT32_C(1) << bin;
        b3Vec3 horizontal_wind = {wind.x, 0.0f, wind.z};
        float wind_length = length_vec(horizontal_wind);
        if (wind_length > 1.0e-6f)
        {
            metrics->alignment_sum +=
                dot_vec(mean_tip_offset, horizontal_wind) / (displacement * wind_length);
            metrics->alignment_count += 1;
        }
    }
}

static int bit_count(uint32_t value)
{
    int count = 0;
    while (value != 0)
    {
        value &= value - 1;
        count += 1;
    }
    return count;
}

static Result run_simulation(const char* id, bool wind_enabled, FILE* motion)
{
    b3BodyId roots[guide_count];
    b3BodyId bodies[body_count];
    b3Pos rest_tips[guide_count];
    JointEndpoints endpoints[joint_count];

    b3WorldDef world_def = b3DefaultWorldDef();
    world_def.gravity = (b3Vec3){0.0f, -9.81f, 0.0f};
    world_def.enableSleep = false;
    world_def.workerCount = 1;
    world_def.hitEventThreshold = 0.05f;
    b3WorldId world = b3CreateWorld(&world_def);

    b3Capsule capsule = {{0.0f, -link_half_length, 0.0f},
                         {0.0f, link_half_length, 0.0f}, link_radius};

    int endpoint_count = 0;
    for (int row = 0; row < guide_rows; ++row)
    {
        for (int column = 0; column < guide_columns; ++column)
        {
            int guide = row * guide_columns + column;
            float root_x = guide_spacing * ((float)column - 0.5f * (guide_columns - 1));
            float root_z = guide_spacing * ((float)row - 0.5f * (guide_rows - 1));
            float root_y = 2.55f + 0.008f * (float)((guide * 5) % 3);

            b3BodyDef root_def = b3DefaultBodyDef();
            root_def.position = (b3Pos){root_x, root_y, root_z};
            roots[guide] = b3CreateBody(world, &root_def);
            rest_tips[guide] =
                (b3Pos){root_x, root_y - 2.0f * link_half_length * links_per_guide, root_z};

            b3BodyId parent = roots[guide];
            for (int link = 0; link < links_per_guide; ++link)
            {
                int index = body_index(guide, link);
                b3BodyDef body_def = b3DefaultBodyDef();
                body_def.type = b3_dynamicBody;
                body_def.position = (b3Pos){root_x,
                                            root_y - link_half_length -
                                                2.0f * link_half_length * link,
                                            root_z};
                body_def.linearDamping = 0.035f;
                body_def.angularDamping = 0.08f;
                body_def.enableSleep = false;
                bodies[index] = b3CreateBody(world, &body_def);

                b3ShapeDef shape_def = b3DefaultShapeDef();
                shape_def.density = 25.0f;
                shape_def.baseMaterial.friction = 0.3f;
                shape_def.baseMaterial.restitution = 0.0f;
                shape_def.enableContactEvents = true;
                shape_def.enableHitEvents = true;
                shape_def.filter.categoryBits = UINT64_C(0x2);
                shape_def.filter.maskBits = UINT64_C(0x2);
                shape_def.filter.groupIndex = -(guide + 1);
                b3CreateCapsuleShape(bodies[index], &shape_def, &capsule);

                b3SphericalJointDef joint_def = b3DefaultSphericalJointDef();
                joint_def.base.bodyIdA = parent;
                joint_def.base.bodyIdB = bodies[index];
                joint_def.base.collideConnected = false;
                joint_def.base.localFrameA =
                    link == 0
                        ? (b3Transform){b3Vec3_zero, b3Quat_identity}
                        : (b3Transform){{0.0f, -link_half_length, 0.0f}, b3Quat_identity};
                joint_def.base.localFrameB =
                    (b3Transform){{0.0f, link_half_length, 0.0f}, b3Quat_identity};
                joint_def.enableSpring = true;
                joint_def.hertz = link == 0 ? 2.4f : 1.35f;
                joint_def.dampingRatio = link == 0 ? 0.48f : 0.32f;
                joint_def.targetRotation = b3Quat_identity;
                joint_def.enableConeLimit = true;
                joint_def.coneAngle = 75.0f * pi_f / 180.0f;
                joint_def.enableTwistLimit = true;
                joint_def.lowerTwistAngle = -35.0f * pi_f / 180.0f;
                joint_def.upperTwistAngle = 35.0f * pi_f / 180.0f;
                b3CreateSphericalJoint(world, &joint_def);

                endpoints[endpoint_count++] =
                    (JointEndpoints){.parent = parent,
                                     .child = bodies[index],
                                     .local_a = joint_def.base.localFrameA.p,
                                     .local_b = joint_def.base.localFrameB.p};
                parent = bodies[index];
            }
        }
    }

    if (motion != NULL)
    {
        fprintf(motion,
                "condition,frame,time_s,guide,link,x_m,y_m,z_m,qx,qy,qz,qw,wind_x_m_s,wind_z_m_s\n");
    }

    Result result = {.id = id,
                     .finite = true,
                     .trajectory_digest = UINT64_C(1469598103934665603),
                     .cpu_ms = 0.0,
                     .max_speed = 0.0f,
                     .max_angular_speed = 0.0f,
                     .max_joint_gap = 0.0f,
                     .max_tip_displacement = 0.0f,
                     .max_active_contacts = 0,
                     .contact_begins = 0,
                     .contact_ends = 0,
                     .strong = {0},
                     .moderate = {0}};

    int sample_stride = simulation_hz / sample_hz;
    int frame = 0;
    clock_t started = clock();
    for (int step = 0; step <= step_count; ++step)
    {
        float time_s = (float)step / simulation_hz;
        b3Vec3 wind = wind_at_time(time_s, wind_enabled);

        if (step % sample_stride == 0)
        {
            b3Vec3 mean_tip_offset = b3Vec3_zero;
            for (int guide = 0; guide < guide_count; ++guide)
            {
                b3BodyId tip_body = bodies[body_index(guide, links_per_guide - 1)];
                b3Pos tip =
                    b3Body_GetWorldPoint(tip_body, (b3Vec3){0.0f, -link_half_length, 0.0f});
                b3Vec3 offset = subtract_pos(tip, rest_tips[guide]);
                mean_tip_offset = add_vec(mean_tip_offset, offset);
                float displacement = hypotf(offset.x, offset.z);
                result.max_tip_displacement = fmaxf(result.max_tip_displacement, displacement);
            }
            mean_tip_offset = scale_vec(mean_tip_offset, 1.0f / guide_count);
            record_phase_sample(time_s < phase_seconds ? &result.strong : &result.moderate,
                                mean_tip_offset, wind);

            for (int guide = 0; guide < guide_count; ++guide)
            {
                for (int link = 0; link < links_per_guide; ++link)
                {
                    b3BodyId body = bodies[body_index(guide, link)];
                    b3Pos position = b3Body_GetPosition(body);
                    b3Quat rotation = b3Body_GetRotation(body);
                    b3Vec3 velocity = b3Body_GetLinearVelocity(body);
                    b3Vec3 angular_velocity = b3Body_GetAngularVelocity(body);
                    float speed = length_vec(velocity);
                    float angular_speed = length_vec(angular_velocity);
                    result.finite = result.finite && isfinite(position.x) &&
                                    isfinite(position.y) && isfinite(position.z) &&
                                    isfinite(speed) && isfinite(angular_speed);
                    result.max_speed = fmaxf(result.max_speed, speed);
                    result.max_angular_speed =
                        fmaxf(result.max_angular_speed, angular_speed);
                    result.trajectory_digest =
                        hash_position(result.trajectory_digest, position);
                    if (motion != NULL)
                    {
                        fprintf(motion,
                                "%s,%d,%.9g,%d,%d,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g\n",
                                id, frame, (double)time_s, guide, link,
                                (double)position.x, (double)position.y, (double)position.z,
                                (double)rotation.v.x, (double)rotation.v.y,
                                (double)rotation.v.z, (double)rotation.s, (double)wind.x,
                                (double)wind.z);
                    }
                }
            }
            frame += 1;
        }

        for (int joint = 0; joint < endpoint_count; ++joint)
        {
            b3Pos a = b3Body_GetWorldPoint(endpoints[joint].parent, endpoints[joint].local_a);
            b3Pos b = b3Body_GetWorldPoint(endpoints[joint].child, endpoints[joint].local_b);
            result.max_joint_gap = fmaxf(result.max_joint_gap, length_vec(subtract_pos(a, b)));
        }

        int contact_count_sum = 0;
        b3ContactData contact_data[body_count];
        for (int index = 0; index < body_count; ++index)
        {
            int capacity = b3Body_GetContactCapacity(bodies[index]);
            if (capacity > body_count)
            {
                result.finite = false;
                capacity = body_count;
            }
            contact_count_sum +=
                b3Body_GetContactData(bodies[index], contact_data, capacity);
        }
        result.max_active_contacts =
            result.max_active_contacts > contact_count_sum / 2
                ? result.max_active_contacts
                : contact_count_sum / 2;

        if (step == step_count)
        {
            break;
        }

        for (int guide = 0; guide < guide_count; ++guide)
        {
            for (int link = 0; link < links_per_guide; ++link)
            {
                b3BodyId body = bodies[body_index(guide, link)];
                b3Vec3 force = aerodynamic_force(body, wind, guide);
                b3Body_ApplyForceToCenter(body, force, true);
            }
        }
        b3World_Step(world, 1.0f / simulation_hz, substeps_per_step);
        b3ContactEvents events = b3World_GetContactEvents(world);
        result.contact_begins += events.beginCount;
        result.contact_ends += events.endCount;
    }
    result.cpu_ms = 1000.0 * (double)(clock() - started) / CLOCKS_PER_SEC;

    b3DestroyWorld(world);
    return result;
}

static double phase_mean_displacement(const PhaseMetrics* metrics)
{
    return metrics->sample_count > 0 ? metrics->displacement_sum / metrics->sample_count : 0.0;
}

static double phase_mean_alignment(const PhaseMetrics* metrics)
{
    return metrics->alignment_count > 0 ? metrics->alignment_sum / metrics->alignment_count : 0.0;
}

static void write_result_json(FILE* output, const Result* result, bool trailing_comma)
{
    fprintf(output,
            "    \"%s\": {\n"
            "      \"trajectory_digest\": \"%016" PRIx64 "\",\n"
            "      \"simulation_cpu_ms\": %.6f,\n"
            "      \"realtime_factor\": %.6f,\n"
            "      \"finite\": %s,\n"
            "      \"max_speed_m_s\": %.9g,\n"
            "      \"max_angular_speed_rad_s\": %.9g,\n"
            "      \"max_joint_gap_m\": %.9g,\n"
            "      \"max_horizontal_tip_displacement_m\": %.9g,\n"
            "      \"max_active_contacts\": %d,\n"
            "      \"contact_begins\": %d,\n"
            "      \"contact_ends\": %d,\n"
            "      \"strong_orbit\": {\"wind_speed_m_s\": 6.0, "
            "\"mean_horizontal_tip_displacement_m\": %.9g, \"max_horizontal_tip_displacement_m\": %.9g, "
            "\"mean_wind_alignment\": %.9g, \"azimuth_bins_visited\": %d},\n"
            "      \"moderate_orbit\": {\"wind_speed_m_s\": 3.25, "
            "\"mean_horizontal_tip_displacement_m\": %.9g, \"max_horizontal_tip_displacement_m\": %.9g, "
            "\"mean_wind_alignment\": %.9g, \"azimuth_bins_visited\": %d}\n"
            "    }%s\n",
            result->id, result->trajectory_digest, result->cpu_ms,
            result->cpu_ms > 0.0 ? 1000.0 * duration_seconds / result->cpu_ms : 0.0,
            result->finite ? "true" : "false", (double)result->max_speed,
            (double)result->max_angular_speed, (double)result->max_joint_gap,
            (double)result->max_tip_displacement, result->max_active_contacts,
            result->contact_begins, result->contact_ends,
            phase_mean_displacement(&result->strong), (double)result->strong.max_displacement,
            phase_mean_alignment(&result->strong), bit_count(result->strong.azimuth_mask),
            phase_mean_displacement(&result->moderate),
            (double)result->moderate.max_displacement,
            phase_mean_alignment(&result->moderate), bit_count(result->moderate.azimuth_mask),
            trailing_comma ? "," : "");
}

static bool result_is_healthy(const Result* result)
{
    return result->finite && result->max_speed < 100.0f &&
           result->max_angular_speed < 500.0f && result->max_joint_gap < 0.012f;
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
    if (!self_test)
    {
        if (!ensure_directory("outputs"))
        {
            perror("outputs");
            return EXIT_FAILURE;
        }
        motion = fopen("outputs/hair_box3d_swatch_motion.csv", "w");
        if (motion == NULL)
        {
            perror("outputs/hair_box3d_swatch_motion.csv");
            return EXIT_FAILURE;
        }
    }

    Result calm = run_simulation("calm_control", false, NULL);
    Result wind = run_simulation("rotating_wind", true, motion);
    if (motion != NULL)
    {
        fclose(motion);
    }

    Result repeat = {0};
    bool deterministic = true;
    if (self_test)
    {
        repeat = run_simulation("rotating_wind_repeat", true, NULL);
        deterministic = repeat.trajectory_digest == wind.trajectory_digest;
    }

    double calm_mean = phase_mean_displacement(&calm.strong);
    double wind_strong_mean = phase_mean_displacement(&wind.strong);
    double wind_moderate_mean = phase_mean_displacement(&wind.moderate);
    bool visibly_driven = wind_strong_mean > calm_mean + 0.12 &&
                          wind_moderate_mean > calm_mean + 0.06;
    bool orbit_coverage = bit_count(wind.strong.azimuth_mask) >= 18 &&
                          bit_count(wind.moderate.azimuth_mask) >= 14;
    bool contacts_observed = wind.max_active_contacts > 0 && wind.contact_begins > 0 &&
                             wind.contact_ends > 0;
    bool healthy = result_is_healthy(&calm) && result_is_healthy(&wind) &&
                   visibly_driven && orbit_coverage && contacts_observed && deterministic;

    if (!self_test)
    {
        FILE* receipt = fopen("outputs/receipt.json", "w");
        if (receipt == NULL)
        {
            perror("outputs/receipt.json");
            return EXIT_FAILURE;
        }
        fprintf(receipt,
                "{\n"
                "  \"schema\": \"hair-box3d-swatch-receipt/1\",\n"
                "  \"configuration\": {\"guides\": %d, \"links_per_guide\": %d, "
                "\"dynamic_capsules\": %d, \"spherical_joints\": %d, "
                "\"simulation_hz\": %d, \"substeps_per_step\": %d, "
                "\"duration_s\": %d, \"phase_duration_s\": %d},\n"
                "  \"conditions\": {\n",
                guide_count, links_per_guide, body_count, joint_count, simulation_hz,
                substeps_per_step, duration_seconds, phase_seconds);
        write_result_json(receipt, &calm, true);
        write_result_json(receipt, &wind, false);
        fprintf(receipt,
                "  },\n"
                "  \"gates\": {\n"
                "    \"finite_and_bounded\": %s,\n"
                "    \"wind_displacement_exceeds_calm\": %s,\n"
                "    \"contact_manifolds_observed\": %s,\n"
                "    \"strong_orbit_visits_at_least_18_of_24_bins\": %s,\n"
                "    \"moderate_orbit_visits_at_least_14_of_24_bins\": %s\n"
                "  },\n"
                "  \"claim_boundary\": \"Native reduced-guide experiment; no browser/WASM integration, dense hydration, or custom stiction yet.\"\n"
                "}\n",
                result_is_healthy(&calm) && result_is_healthy(&wind) ? "true" : "false",
                visibly_driven ? "true" : "false",
                contacts_observed ? "true" : "false",
                bit_count(wind.strong.azimuth_mask) >= 18 ? "true" : "false",
                bit_count(wind.moderate.azimuth_mask) >= 14 ? "true" : "false");
        fclose(receipt);
    }

    printf("hair Box3D swatch: bodies=%d joints=%d calm_mean=%.4g "
           "strong_mean=%.4g moderate_mean=%.4g bins=%d/%d contacts=%d "
           "joint_gap=%.4g digest=%016" PRIx64 " deterministic=%s gate=%s\n",
           body_count, joint_count, calm_mean, wind_strong_mean, wind_moderate_mean,
           bit_count(wind.strong.azimuth_mask), bit_count(wind.moderate.azimuth_mask),
           wind.max_active_contacts, (double)wind.max_joint_gap, wind.trajectory_digest,
           deterministic ? "yes" : "no", healthy ? "pass" : "fail");
    return healthy ? EXIT_SUCCESS : EXIT_FAILURE;
}
