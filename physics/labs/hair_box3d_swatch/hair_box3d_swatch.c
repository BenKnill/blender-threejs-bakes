// SPDX-License-Identifier: MIT

#include "box3d/box3d.h"
#include "hair_stiction.h"

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
    azimuth_bins = 24,
    max_contact_candidates = 2048,
    stiction_memory_capacity = 1024,
    stiction_memory_ttl_steps = 3
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

typedef struct BodyTag
{
    int guide;
    int link;
} BodyTag;

typedef struct ContactCandidate
{
    b3ContactId contact_id;
    uint32_t feature_id;
    b3BodyId body_a;
    b3BodyId body_b;
    BodyTag* tag_a;
    BodyTag* tag_b;
    b3Pos point;
    b3Vec3 normal;
    float normal_impulse;
} ContactCandidate;

typedef struct StictionEntry
{
    uint8_t state;
    b3ContactId contact_id;
    uint32_t feature_id;
    int last_seen_step;
    int age_steps;
    bool sticking;
} StictionEntry;

typedef struct StictionMemory
{
    StictionEntry entries[stiction_memory_capacity];
    int active_count;
    int tombstone_count;
    int max_active_count;
    int captures;
    int releases;
    int stick_services;
    int slip_services;
    int expirations;
    int evictions;
    int candidate_drops;
    int invalid_solves;
    int energy_injection_violations;
    int maximum_age_steps;
    double axial_impulse_sum;
    double transverse_impulse_sum;
    double dissipated_energy_proxy;
    double relative_speed_before_sum;
    double relative_speed_after_sum;
    int impulse_services;
} StictionMemory;

typedef struct PhaseMetrics
{
    double displacement_sum;
    double alignment_sum;
    double horizontal_spread_sum;
    int sample_count;
    int alignment_count;
    float max_displacement;
    float max_horizontal_spread;
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
    bool stiction_enabled;
    StictionMemory stiction;
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

static b3Vec3 cross_vec(b3Vec3 a, b3Vec3 b)
{
    return (b3Vec3){a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z,
                    a.x * b.y - a.y * b.x};
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

static b3Vec3 point_velocity_response(b3BodyId body_a, b3BodyId body_b,
                                      b3Pos point, b3Vec3 impulse_direction)
{
    b3Vec3 response = scale_vec(
        impulse_direction,
        b3Body_GetInverseMass(body_a) + b3Body_GetInverseMass(body_b));
    b3Vec3 radius_a = subtract_pos(point, b3Body_GetWorldCenter(body_a));
    b3Vec3 radius_b = subtract_pos(point, b3Body_GetWorldCenter(body_b));
    b3Vec3 angular_a = b3MulMV(b3Body_GetWorldInverseRotationalInertia(body_a),
                               cross_vec(radius_a, impulse_direction));
    b3Vec3 angular_b = b3MulMV(b3Body_GetWorldInverseRotationalInertia(body_b),
                               cross_vec(radius_b, impulse_direction));
    response = add_vec(response, cross_vec(angular_a, radius_a));
    return add_vec(response, cross_vec(angular_b, radius_b));
}

static int compare_contact_candidates(const void* left_pointer,
                                      const void* right_pointer)
{
    const ContactCandidate* left = left_pointer;
    const ContactCandidate* right = right_pointer;
    if (left->contact_id.index1 != right->contact_id.index1)
    {
        return left->contact_id.index1 < right->contact_id.index1 ? -1 : 1;
    }
    if (left->contact_id.generation != right->contact_id.generation)
    {
        return left->contact_id.generation < right->contact_id.generation ? -1 : 1;
    }
    if (left->feature_id != right->feature_id)
    {
        return left->feature_id < right->feature_id ? -1 : 1;
    }
    return 0;
}

static uint32_t stiction_key_hash(b3ContactId contact_id, uint32_t feature_id)
{
    uint32_t value = (uint32_t)contact_id.index1 * UINT32_C(0x9e3779b1);
    value ^= contact_id.generation * UINT32_C(0x85ebca6b);
    value ^= feature_id * UINT32_C(0xc2b2ae35);
    value ^= value >> 16;
    return value;
}

static bool stiction_key_equal(const StictionEntry* entry, b3ContactId contact_id,
                               uint32_t feature_id)
{
    return entry->state == 1 && B3_ID_EQUALS(entry->contact_id, contact_id) &&
           entry->feature_id == feature_id;
}

static StictionEntry* stiction_memory_entry(StictionMemory* memory,
                                            b3ContactId contact_id,
                                            uint32_t feature_id, int step,
                                            bool* created)
{
    uint32_t start =
        stiction_key_hash(contact_id, feature_id) & (stiction_memory_capacity - 1);
    int first_tombstone = -1;
    for (int probe = 0; probe < stiction_memory_capacity; ++probe)
    {
        int index = (int)((start + (uint32_t)probe) & (stiction_memory_capacity - 1));
        StictionEntry* entry = memory->entries + index;
        if (stiction_key_equal(entry, contact_id, feature_id))
        {
            *created = false;
            return entry;
        }
        if (entry->state == 2 && first_tombstone < 0)
        {
            first_tombstone = index;
        }
        if (entry->state == 0)
        {
            int target = first_tombstone >= 0 ? first_tombstone : index;
            entry = memory->entries + target;
            if (entry->state == 2)
            {
                memory->tombstone_count -= 1;
            }
            *entry = (StictionEntry){.state = 1,
                                     .contact_id = contact_id,
                                     .feature_id = feature_id,
                                     .last_seen_step = step,
                                     .age_steps = 0,
                                     .sticking = false};
            memory->active_count += 1;
            memory->max_active_count =
                memory->max_active_count > memory->active_count
                    ? memory->max_active_count
                    : memory->active_count;
            *created = true;
            return entry;
        }
    }

    if (first_tombstone >= 0)
    {
        StictionEntry* entry = memory->entries + first_tombstone;
        memory->tombstone_count -= 1;
        *entry = (StictionEntry){.state = 1,
                                 .contact_id = contact_id,
                                 .feature_id = feature_id,
                                 .last_seen_step = step,
                                 .age_steps = 0,
                                 .sticking = false};
        memory->active_count += 1;
        memory->max_active_count =
            memory->max_active_count > memory->active_count
                ? memory->max_active_count
                : memory->active_count;
        *created = true;
        return entry;
    }

    int oldest = 0;
    for (int index = 1; index < stiction_memory_capacity; ++index)
    {
        if (memory->entries[index].last_seen_step <
            memory->entries[oldest].last_seen_step)
        {
            oldest = index;
        }
    }
    memory->evictions += 1;
    StictionEntry* entry = memory->entries + oldest;
    *entry = (StictionEntry){.state = 1,
                             .contact_id = contact_id,
                             .feature_id = feature_id,
                             .last_seen_step = step,
                             .age_steps = 0,
                             .sticking = false};
    *created = true;
    return entry;
}

static void expire_stiction_memory(StictionMemory* memory, int step)
{
    for (int index = 0; index < stiction_memory_capacity; ++index)
    {
        StictionEntry* entry = memory->entries + index;
        if (entry->state != 1 || step - entry->last_seen_step <= stiction_memory_ttl_steps)
        {
            continue;
        }
        entry->state = 2;
        entry->sticking = false;
        memory->active_count -= 1;
        memory->tombstone_count += 1;
        memory->expirations += 1;
    }
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
                                float horizontal_spread, b3Vec3 wind)
{
    float displacement = hypotf(mean_tip_offset.x, mean_tip_offset.z);
    metrics->displacement_sum += displacement;
    metrics->sample_count += 1;
    metrics->horizontal_spread_sum += horizontal_spread;
    metrics->max_displacement = fmaxf(metrics->max_displacement, displacement);
    metrics->max_horizontal_spread =
        fmaxf(metrics->max_horizontal_spread, horizontal_spread);
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

static const HairStictionCoefficients stiction_coefficients = {
    .static_axial = 0.16f,
    .static_transverse = 0.92f,
    .kinetic_axial = 0.10f,
    .kinetic_transverse = 0.62f,
    .capture_speed = 0.12f,
    .release_speed = 0.30f,
};

static int collect_contact_candidates(const b3ShapeId* shapes,
                                      ContactCandidate* candidates,
                                      StictionMemory* memory, bool* finite)
{
    int candidate_count = 0;
    b3ContactData contact_data[body_count];
    for (int shape_index = 0; shape_index < body_count; ++shape_index)
    {
        int capacity = b3Shape_GetContactCapacity(shapes[shape_index]);
        if (capacity > body_count)
        {
            *finite = false;
            capacity = body_count;
        }
        int count =
            b3Shape_GetContactData(shapes[shape_index], contact_data, capacity);
        for (int contact_index = 0; contact_index < count; ++contact_index)
        {
            b3ContactData* contact = contact_data + contact_index;
            if (!B3_ID_EQUALS(contact->shapeIdA, shapes[shape_index]))
            {
                continue;
            }
            BodyTag* tag_a = b3Shape_GetUserData(contact->shapeIdA);
            BodyTag* tag_b = b3Shape_GetUserData(contact->shapeIdB);
            if (tag_a == NULL || tag_b == NULL || tag_a->guide == tag_b->guide)
            {
                continue;
            }
            b3BodyId body_a = b3Shape_GetBody(contact->shapeIdA);
            b3BodyId body_b = b3Shape_GetBody(contact->shapeIdB);
            b3Pos center_a = b3Body_GetWorldCenter(body_a);
            for (int manifold_index = 0; manifold_index < contact->manifoldCount;
                 ++manifold_index)
            {
                const b3Manifold* manifold = contact->manifolds + manifold_index;
                for (int point_index = 0; point_index < manifold->pointCount;
                     ++point_index)
                {
                    const b3ManifoldPoint* point = manifold->points + point_index;
                    if (point->totalNormalImpulse <= 1.0e-7f)
                    {
                        continue;
                    }
                    if (candidate_count >= max_contact_candidates)
                    {
                        memory->candidate_drops += 1;
                        continue;
                    }
                    candidates[candidate_count++] =
                        (ContactCandidate){.contact_id = contact->contactId,
                                           .feature_id = point->featureId,
                                           .body_a = body_a,
                                           .body_b = body_b,
                                           .tag_a = tag_a,
                                           .tag_b = tag_b,
                                           .point = b3OffsetPos(center_a, point->anchorA),
                                           .normal = manifold->normal,
                                           .normal_impulse =
                                               point->totalNormalImpulse};
                }
            }
        }
    }
    qsort(candidates, (size_t)candidate_count, sizeof(ContactCandidate),
          compare_contact_candidates);
    int unique_count = 0;
    for (int read = 0; read < candidate_count; ++read)
    {
        if (unique_count > 0 &&
            B3_ID_EQUALS(candidates[unique_count - 1].contact_id,
                         candidates[read].contact_id) &&
            candidates[unique_count - 1].feature_id == candidates[read].feature_id)
        {
            if (candidates[read].normal_impulse >
                candidates[unique_count - 1].normal_impulse)
            {
                candidates[unique_count - 1] = candidates[read];
            }
            continue;
        }
        candidates[unique_count++] = candidates[read];
    }
    return unique_count;
}

static b3Vec3 contact_axial_direction(const ContactCandidate* candidate)
{
    b3Vec3 axis_a = normalize_vec(b3Body_GetWorldVector(
        candidate->body_a, (b3Vec3){0.0f, 1.0f, 0.0f}));
    b3Vec3 axis_b = normalize_vec(b3Body_GetWorldVector(
        candidate->body_b, (b3Vec3){0.0f, 1.0f, 0.0f}));
    if (dot_vec(axis_a, axis_b) < 0.0f)
    {
        axis_b = scale_vec(axis_b, -1.0f);
    }
    b3Vec3 tangent = normalize_vec(add_vec(axis_a, axis_b));
    b3Vec3 axial = subtract_vec(
        tangent, scale_vec(candidate->normal, dot_vec(tangent, candidate->normal)));
    if (length_vec(axial) > 1.0e-6f)
    {
        return normalize_vec(axial);
    }
    b3Vec3 reference = fabsf(candidate->normal.y) < 0.85f
                           ? (b3Vec3){0.0f, 1.0f, 0.0f}
                           : (b3Vec3){1.0f, 0.0f, 0.0f};
    return normalize_vec(cross_vec(reference, candidate->normal));
}

static void apply_stiction_candidates(ContactCandidate* candidates,
                                      int candidate_count,
                                      StictionMemory* memory, int step)
{
    for (int index = 0; index < candidate_count; ++index)
    {
        ContactCandidate* candidate = candidates + index;
        bool created = false;
        StictionEntry* entry = stiction_memory_entry(
            memory, candidate->contact_id, candidate->feature_id, step, &created);
        bool was_sticking = !created && entry->sticking;
        entry->age_steps = created || entry->last_seen_step != step - 1
                               ? 1
                               : entry->age_steps + 1;
        entry->last_seen_step = step;
        memory->maximum_age_steps =
            memory->maximum_age_steps > entry->age_steps
                ? memory->maximum_age_steps
                : entry->age_steps;

        b3Vec3 axial = contact_axial_direction(candidate);
        b3Vec3 transverse = normalize_vec(cross_vec(candidate->normal, axial));
        b3Vec3 velocity_a =
            b3Body_GetWorldPointVelocity(candidate->body_a, candidate->point);
        b3Vec3 velocity_b =
            b3Body_GetWorldPointVelocity(candidate->body_b, candidate->point);
        b3Vec3 relative = subtract_vec(velocity_b, velocity_a);
        relative = subtract_vec(
            relative,
            scale_vec(candidate->normal, dot_vec(relative, candidate->normal)));

        b3Vec3 response_axial = point_velocity_response(
            candidate->body_a, candidate->body_b, candidate->point, axial);
        b3Vec3 response_transverse = point_velocity_response(
            candidate->body_a, candidate->body_b, candidate->point, transverse);
        float coupling =
            0.5f * (dot_vec(transverse, response_axial) +
                    dot_vec(axial, response_transverse));
        HairStictionInput input = {
            .relative_axial_speed = dot_vec(relative, axial),
            .relative_transverse_speed = dot_vec(relative, transverse),
            .effective_axial = dot_vec(axial, response_axial),
            .effective_transverse = dot_vec(transverse, response_transverse),
            .effective_coupling = coupling,
            .normal_impulse = candidate->normal_impulse,
            .was_sticking = was_sticking,
        };
        HairStictionOutput output =
            hair_stiction_solve(&stiction_coefficients, &input);
        if (!output.valid)
        {
            entry->sticking = false;
            memory->invalid_solves += 1;
            continue;
        }

        if (!was_sticking && output.sticking)
        {
            memory->captures += 1;
        }
        else if (was_sticking && !output.sticking)
        {
            memory->releases += 1;
        }
        entry->sticking = output.sticking;
        if (output.sticking)
        {
            memory->stick_services += 1;
        }
        else
        {
            memory->slip_services += 1;
        }

        b3Vec3 impulse =
            add_vec(scale_vec(axial, output.applied_axial_impulse),
                    scale_vec(transverse, output.applied_transverse_impulse));
        b3Body_ApplyLinearImpulse(candidate->body_a, scale_vec(impulse, -1.0f),
                                  candidate->point, true);
        b3Body_ApplyLinearImpulse(candidate->body_b, impulse, candidate->point, true);

        memory->axial_impulse_sum += fabs(output.applied_axial_impulse);
        memory->transverse_impulse_sum += fabs(output.applied_transverse_impulse);
        memory->relative_speed_before_sum +=
            hypot(input.relative_axial_speed, input.relative_transverse_speed);
        memory->relative_speed_after_sum +=
            hypot(output.post_axial_speed, output.post_transverse_speed);
        memory->dissipated_energy_proxy += fmax(0.0, -(double)output.energy_change);
        memory->impulse_services += 1;
        if (output.energy_change > 1.0e-6f)
        {
            memory->energy_injection_violations += 1;
        }
    }
    expire_stiction_memory(memory, step);
}

static bool stiction_operator_self_test(void)
{
    if (!hair_stiction_coefficients_valid(&stiction_coefficients))
    {
        return false;
    }
    HairStictionInput stick_input = {.relative_axial_speed = 0.03f,
                                     .relative_transverse_speed = -0.05f,
                                     .effective_axial = 4.0f,
                                     .effective_transverse = 5.0f,
                                     .effective_coupling = 0.25f,
                                     .normal_impulse = 0.5f,
                                     .was_sticking = false};
    HairStictionOutput stick =
        hair_stiction_solve(&stiction_coefficients, &stick_input);
    if (!stick.valid || !stick.sticking ||
        fabsf(stick.post_axial_speed) > 1.0e-5f ||
        fabsf(stick.post_transverse_speed) > 1.0e-5f ||
        stick.energy_change > 1.0e-7f)
    {
        return false;
    }

    HairStictionInput slip_input = stick_input;
    slip_input.relative_axial_speed = 1.2f;
    slip_input.relative_transverse_speed = -2.4f;
    slip_input.was_sticking = true;
    HairStictionOutput slip =
        hair_stiction_solve(&stiction_coefficients, &slip_input);
    float slip_ellipse =
        hypotf(slip.applied_axial_impulse /
                   (stiction_coefficients.kinetic_axial * slip_input.normal_impulse),
               slip.applied_transverse_impulse /
                   (stiction_coefficients.kinetic_transverse *
                    slip_input.normal_impulse));
    if (!slip.valid || slip.sticking || slip.kinetic_scale > 1.0f ||
        slip.kinetic_scale <= 0.0f || slip_ellipse > 1.00001f ||
        slip.energy_change > 1.0e-6f)
    {
        return false;
    }

    HairStictionInput hysteresis_input = stick_input;
    hysteresis_input.relative_axial_speed = 0.20f;
    hysteresis_input.relative_transverse_speed = 0.0f;
    hysteresis_input.normal_impulse = 10.0f;
    HairStictionOutput new_contact =
        hair_stiction_solve(&stiction_coefficients, &hysteresis_input);
    hysteresis_input.was_sticking = true;
    HairStictionOutput remembered_contact =
        hair_stiction_solve(&stiction_coefficients, &hysteresis_input);
    if (!new_contact.valid || new_contact.sticking || !remembered_contact.sticking)
    {
        return false;
    }

    HairStictionCoefficients zero_kinetic = stiction_coefficients;
    zero_kinetic.kinetic_axial = 0.0f;
    zero_kinetic.kinetic_transverse = 0.0f;
    HairStictionOutput zero_slip =
        hair_stiction_solve(&zero_kinetic, &slip_input);
    if (!zero_slip.valid || zero_slip.sticking || zero_slip.kinetic_scale != 0.0f ||
        zero_slip.applied_axial_impulse != 0.0f ||
        zero_slip.applied_transverse_impulse != 0.0f)
    {
        return false;
    }

    b3Vec3 impulse = {0.12f, -0.31f, 0.08f};
    b3Vec3 linear_balance = add_vec(scale_vec(impulse, -1.0f), impulse);
    b3Pos point = {0.7f, -0.2f, 1.3f};
    b3Vec3 angular_balance =
        add_vec(cross_vec((b3Vec3){point.x, point.y, point.z},
                          scale_vec(impulse, -1.0f)),
                cross_vec((b3Vec3){point.x, point.y, point.z}, impulse));
    return length_vec(linear_balance) < 1.0e-8f &&
           length_vec(angular_balance) < 1.0e-8f;
}

static Result run_simulation(const char* id, bool wind_enabled,
                             bool stiction_enabled, FILE* motion,
                             bool write_motion_header)
{
    b3BodyId roots[guide_count];
    b3BodyId bodies[body_count];
    b3ShapeId shapes[body_count];
    BodyTag tags[body_count];
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
                tags[index] = (BodyTag){.guide = guide, .link = link};
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
                shape_def.userData = tags + index;
                shape_def.density = 25.0f;
                shape_def.baseMaterial.friction = 0.3f;
                shape_def.baseMaterial.restitution = 0.0f;
                shape_def.enableContactEvents = true;
                shape_def.enableHitEvents = true;
                shape_def.filter.categoryBits = UINT64_C(0x2);
                shape_def.filter.maskBits = UINT64_C(0x2);
                shape_def.filter.groupIndex = -(guide + 1);
                shapes[index] =
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

    if (motion != NULL && write_motion_header)
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
                     .stiction_enabled = stiction_enabled,
                     .stiction = {0},
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
            b3Vec3 tip_offsets[guide_count];
            for (int guide = 0; guide < guide_count; ++guide)
            {
                b3BodyId tip_body = bodies[body_index(guide, links_per_guide - 1)];
                b3Pos tip =
                    b3Body_GetWorldPoint(tip_body, (b3Vec3){0.0f, -link_half_length, 0.0f});
                b3Vec3 offset = subtract_pos(tip, rest_tips[guide]);
                tip_offsets[guide] = offset;
                mean_tip_offset = add_vec(mean_tip_offset, offset);
                float displacement = hypotf(offset.x, offset.z);
                result.max_tip_displacement = fmaxf(result.max_tip_displacement, displacement);
            }
            mean_tip_offset = scale_vec(mean_tip_offset, 1.0f / guide_count);
            float spread_squared_sum = 0.0f;
            for (int guide = 0; guide < guide_count; ++guide)
            {
                float dx = tip_offsets[guide].x - mean_tip_offset.x;
                float dz = tip_offsets[guide].z - mean_tip_offset.z;
                spread_squared_sum += dx * dx + dz * dz;
            }
            float horizontal_spread =
                sqrtf(spread_squared_sum / (float)guide_count);
            record_phase_sample(time_s < phase_seconds ? &result.strong : &result.moderate,
                                mean_tip_offset, horizontal_spread, wind);

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
        if (stiction_enabled)
        {
            ContactCandidate candidates[max_contact_candidates];
            int candidate_count = collect_contact_candidates(
                shapes, candidates, &result.stiction, &result.finite);
            apply_stiction_candidates(candidates, candidate_count,
                                      &result.stiction, step + 1);
        }
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

static double phase_mean_horizontal_spread(const PhaseMetrics* metrics)
{
    return metrics->sample_count > 0
               ? metrics->horizontal_spread_sum / metrics->sample_count
               : 0.0;
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
            "\"mean_horizontal_tip_spread_m\": %.9g, \"max_horizontal_tip_spread_m\": %.9g, "
            "\"mean_wind_alignment\": %.9g, \"azimuth_bins_visited\": %d},\n"
            "      \"moderate_orbit\": {\"wind_speed_m_s\": 3.25, "
            "\"mean_horizontal_tip_displacement_m\": %.9g, \"max_horizontal_tip_displacement_m\": %.9g, "
            "\"mean_horizontal_tip_spread_m\": %.9g, \"max_horizontal_tip_spread_m\": %.9g, "
            "\"mean_wind_alignment\": %.9g, \"azimuth_bins_visited\": %d},\n"
            "      \"stiction\": {\"enabled\": %s, \"memory_capacity\": %d, "
            "\"max_active_entries\": %d, \"captures\": %d, \"releases\": %d, "
            "\"stick_services\": %d, \"slip_services\": %d, \"expirations\": %d, "
            "\"evictions\": %d, \"candidate_drops\": %d, \"invalid_solves\": %d, "
            "\"maximum_age_steps\": %d, \"axial_impulse_sum_n_s\": %.9g, "
            "\"transverse_impulse_sum_n_s\": %.9g, \"dissipated_energy_proxy_j\": %.9g, "
            "\"mean_relative_speed_before_m_s\": %.9g, \"mean_predicted_speed_after_m_s\": %.9g, "
            "\"energy_injection_violations\": %d}\n"
            "    }%s\n",
            result->id, result->trajectory_digest, result->cpu_ms,
            result->cpu_ms > 0.0 ? 1000.0 * duration_seconds / result->cpu_ms : 0.0,
            result->finite ? "true" : "false", (double)result->max_speed,
            (double)result->max_angular_speed, (double)result->max_joint_gap,
            (double)result->max_tip_displacement, result->max_active_contacts,
            result->contact_begins, result->contact_ends,
            phase_mean_displacement(&result->strong), (double)result->strong.max_displacement,
            phase_mean_horizontal_spread(&result->strong),
            (double)result->strong.max_horizontal_spread,
            phase_mean_alignment(&result->strong), bit_count(result->strong.azimuth_mask),
            phase_mean_displacement(&result->moderate),
            (double)result->moderate.max_displacement,
            phase_mean_horizontal_spread(&result->moderate),
            (double)result->moderate.max_horizontal_spread,
            phase_mean_alignment(&result->moderate), bit_count(result->moderate.azimuth_mask),
            result->stiction_enabled ? "true" : "false", stiction_memory_capacity,
            result->stiction.max_active_count, result->stiction.captures,
            result->stiction.releases, result->stiction.stick_services,
            result->stiction.slip_services, result->stiction.expirations,
            result->stiction.evictions, result->stiction.candidate_drops,
            result->stiction.invalid_solves, result->stiction.maximum_age_steps,
            result->stiction.axial_impulse_sum,
            result->stiction.transverse_impulse_sum,
            result->stiction.dissipated_energy_proxy,
            result->stiction.impulse_services > 0
                ? result->stiction.relative_speed_before_sum /
                      result->stiction.impulse_services
                : 0.0,
            result->stiction.impulse_services > 0
                ? result->stiction.relative_speed_after_sum /
                      result->stiction.impulse_services
                : 0.0,
            result->stiction.energy_injection_violations,
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

    Result calm =
        run_simulation("calm_control", false, false, NULL, false);
    Result wind = run_simulation("rotating_wind_box3d", true, false, motion, true);
    Result stiction =
        run_simulation("rotating_wind_stiction", true, true, motion, false);
    if (motion != NULL)
    {
        fclose(motion);
    }

    Result repeat = {0};
    bool deterministic = true;
    if (self_test)
    {
        repeat = run_simulation("rotating_wind_stiction_repeat", true, true, NULL,
                                false);
        deterministic = repeat.trajectory_digest == stiction.trajectory_digest;
    }

    double calm_mean = phase_mean_displacement(&calm.strong);
    double wind_strong_mean = phase_mean_displacement(&wind.strong);
    double wind_moderate_mean = phase_mean_displacement(&wind.moderate);
    double stiction_strong_mean = phase_mean_displacement(&stiction.strong);
    double stiction_moderate_mean = phase_mean_displacement(&stiction.moderate);
    bool visibly_driven = wind_strong_mean > calm_mean + 0.12 &&
                          wind_moderate_mean > calm_mean + 0.06;
    bool orbit_coverage = bit_count(wind.strong.azimuth_mask) >= 18 &&
                          bit_count(wind.moderate.azimuth_mask) >= 14;
    bool contacts_observed = wind.max_active_contacts > 0 && wind.contact_begins > 0 &&
                             wind.contact_ends > 0;
    bool baseline_preserved =
        wind.trajectory_digest == UINT64_C(0xeb3ebea59ffbb5af);
    bool stiction_persistent = stiction.stiction.captures > 0 &&
                               stiction.stiction.releases > 0 &&
                               stiction.stiction.stick_services > 0 &&
                               stiction.stiction.slip_services > 0 &&
                               stiction.stiction.maximum_age_steps > 1;
    bool stiction_bounded =
        stiction.stiction.max_active_count <= stiction_memory_capacity &&
        stiction.stiction.candidate_drops == 0 && stiction.stiction.evictions == 0 &&
        stiction.stiction.energy_injection_violations == 0;
    bool stiction_dissipates =
        stiction.stiction.impulse_services > 0 &&
        stiction.stiction.relative_speed_after_sum <
            stiction.stiction.relative_speed_before_sum;
    bool stiction_moves = stiction_strong_mean > 0.8 &&
                          stiction_moderate_mean > 0.5 &&
                          bit_count(stiction.strong.azimuth_mask) >= 18 &&
                          bit_count(stiction.moderate.azimuth_mask) >= 14;
    bool stiction_cost_bounded = stiction.cpu_ms < 4.0 * wind.cpu_ms;
    bool operator_contracts = stiction_operator_self_test();
    bool healthy = result_is_healthy(&calm) && result_is_healthy(&wind) &&
                   result_is_healthy(&stiction) && visibly_driven && orbit_coverage &&
                   contacts_observed && baseline_preserved && stiction_persistent &&
                   stiction_bounded && stiction_dissipates && stiction_moves &&
                   stiction_cost_bounded && operator_contracts && deterministic;

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
                "  \"schema\": \"hair-box3d-swatch-receipt/2\",\n"
                "  \"configuration\": {\"guides\": %d, \"links_per_guide\": %d, "
                "\"dynamic_capsules\": %d, \"spherical_joints\": %d, "
                "\"simulation_hz\": %d, \"substeps_per_step\": %d, "
                "\"duration_s\": %d, \"phase_duration_s\": %d, "
                "\"stiction_memory_capacity\": %d, \"stiction_memory_ttl_steps\": %d, "
                "\"static_axial\": %.9g, \"static_transverse\": %.9g, "
                "\"kinetic_axial\": %.9g, \"kinetic_transverse\": %.9g, "
                "\"capture_speed_m_s\": %.9g, \"release_speed_m_s\": %.9g},\n"
                "  \"conditions\": {\n",
                guide_count, links_per_guide, body_count, joint_count, simulation_hz,
                substeps_per_step, duration_seconds, phase_seconds,
                stiction_memory_capacity, stiction_memory_ttl_steps,
                (double)stiction_coefficients.static_axial,
                (double)stiction_coefficients.static_transverse,
                (double)stiction_coefficients.kinetic_axial,
                (double)stiction_coefficients.kinetic_transverse,
                (double)stiction_coefficients.capture_speed,
                (double)stiction_coefficients.release_speed);
        write_result_json(receipt, &calm, true);
        write_result_json(receipt, &wind, true);
        write_result_json(receipt, &stiction, false);
        fprintf(receipt,
                "  },\n"
                "  \"comparison\": {\"stiction_cpu_overhead_ratio\": %.9g, "
                "\"strong_tip_displacement_ratio\": %.9g, "
                "\"moderate_tip_displacement_ratio\": %.9g, "
                "\"strong_tip_spread_ratio\": %.9g, "
                "\"moderate_tip_spread_ratio\": %.9g},\n"
                "  \"gates\": {\n"
                "    \"finite_and_bounded\": %s,\n"
                "    \"wind_displacement_exceeds_calm\": %s,\n"
                "    \"contact_manifolds_observed\": %s,\n"
                "    \"baseline_digest_preserved\": %s,\n"
                "    \"persistent_stick_and_slip_observed\": %s,\n"
                "    \"memory_and_energy_bounds_hold\": %s,\n"
                "    \"mean_predicted_tangential_speed_reduced\": %s,\n"
                "    \"stiction_groom_remains_visibly_driven\": %s,\n"
                "    \"stiction_cpu_overhead_below_4x\": %s,\n"
                "    \"executable_operator_contracts\": %s,\n"
                "    \"strong_orbit_visits_at_least_18_of_24_bins\": %s,\n"
                "    \"moderate_orbit_visits_at_least_14_of_24_bins\": %s\n"
                "  },\n"
                "  \"claim_boundary\": \"Native reduced-guide A/B with a bounded post-step contact impulse operator; no browser/WASM integration, dense hydration, calibrated fiber fit, or proof that C refines HOL Light.\"\n"
                "}\n",
                wind.cpu_ms > 0.0 ? stiction.cpu_ms / wind.cpu_ms : 0.0,
                wind_strong_mean > 0.0 ? stiction_strong_mean / wind_strong_mean : 0.0,
                wind_moderate_mean > 0.0
                    ? stiction_moderate_mean / wind_moderate_mean
                    : 0.0,
                phase_mean_horizontal_spread(&wind.strong) > 0.0
                    ? phase_mean_horizontal_spread(&stiction.strong) /
                          phase_mean_horizontal_spread(&wind.strong)
                    : 0.0,
                phase_mean_horizontal_spread(&wind.moderate) > 0.0
                    ? phase_mean_horizontal_spread(&stiction.moderate) /
                          phase_mean_horizontal_spread(&wind.moderate)
                    : 0.0,
                result_is_healthy(&calm) && result_is_healthy(&wind) ? "true" : "false",
                visibly_driven ? "true" : "false",
                contacts_observed ? "true" : "false",
                baseline_preserved ? "true" : "false",
                stiction_persistent ? "true" : "false",
                stiction_bounded ? "true" : "false",
                stiction_dissipates ? "true" : "false",
                stiction_moves ? "true" : "false",
                stiction_cost_bounded ? "true" : "false",
                operator_contracts ? "true" : "false",
                bit_count(wind.strong.azimuth_mask) >= 18 ? "true" : "false",
                bit_count(wind.moderate.azimuth_mask) >= 14 ? "true" : "false");
        fclose(receipt);
    }

    printf("hair Box3D swatch: bodies=%d joints=%d calm_mean=%.4g "
           "baseline=%.4g/%.4g stiction=%.4g/%.4g bins=%d/%d "
           "memory=%d captures=%d releases=%d stick/slip=%d/%d overhead=%.3gx "
           "joint_gap=%.4g digest=%016" PRIx64 " deterministic=%s gate=%s\n",
           body_count, joint_count, calm_mean, wind_strong_mean, wind_moderate_mean,
           stiction_strong_mean, stiction_moderate_mean,
           bit_count(wind.strong.azimuth_mask), bit_count(wind.moderate.azimuth_mask),
           stiction.stiction.max_active_count, stiction.stiction.captures,
           stiction.stiction.releases, stiction.stiction.stick_services,
           stiction.stiction.slip_services,
           wind.cpu_ms > 0.0 ? stiction.cpu_ms / wind.cpu_ms : 0.0,
           (double)stiction.max_joint_gap, stiction.trajectory_digest,
           deterministic ? "yes" : "no", healthy ? "pass" : "fail");
    return healthy ? EXIT_SUCCESS : EXIT_FAILURE;
}
