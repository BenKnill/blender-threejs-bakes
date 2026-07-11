"""Pure transform math for scene-state compilation."""

from __future__ import annotations

import math
from collections.abc import Sequence

Vec3 = tuple[float, float, float]
Quat = tuple[float, float, float, float]


def vec3(values: Sequence[float]) -> Vec3:
    return (float(values[0]), float(values[1]), float(values[2]))


def quat(values: Sequence[float]) -> Quat:
    return (float(values[0]), float(values[1]), float(values[2]), float(values[3]))


def add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def subtract(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a: Vec3, b: Vec3) -> Vec3:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def normalize_vec3(value: Vec3) -> Vec3:
    length = math.sqrt(sum(component * component for component in value))
    if length == 0:
        raise ValueError("cannot normalize a zero vector")
    return tuple(component / length for component in value)  # type: ignore[return-value]


def scale(value: Vec3, factor: float) -> Vec3:
    return (value[0] * factor, value[1] * factor, value[2] * factor)


def normalize_quat(value: Quat) -> Quat:
    length = math.sqrt(sum(component * component for component in value))
    if length == 0:
        raise ValueError("cannot normalize a zero quaternion")
    return tuple(component / length for component in value)  # type: ignore[return-value]


def multiply_quat(a: Quat, b: Quat) -> Quat:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    )


def rotate_vec(value: Quat, vector: Vec3) -> Vec3:
    qx, qy, qz, qw = normalize_quat(value)
    vx, vy, vz = vector
    tx = 2 * (qy * vz - qz * vy)
    ty = 2 * (qz * vx - qx * vz)
    tz = 2 * (qx * vy - qy * vx)
    return (
        vx + qw * tx + qy * tz - qz * ty,
        vy + qw * ty + qz * tx - qx * tz,
        vz + qw * tz + qx * ty - qy * tx,
    )


def compose_pose(
    parent_position: Vec3,
    parent_orientation: Quat,
    local_position: Vec3,
    local_orientation: Quat,
) -> tuple[Vec3, Quat]:
    position = add(parent_position, rotate_vec(parent_orientation, local_position))
    orientation = normalize_quat(multiply_quat(parent_orientation, local_orientation))
    return position, orientation


def look_at_quaternion(position: Vec3, target: Vec3, up: Vec3) -> Quat:
    """Return a Three.js-space quaternion looking down local -Z."""
    forward = normalize_vec3(subtract(target, position))
    back = tuple(-component for component in forward)
    projected_up = subtract(
        up, scale(back, sum(component * back[index] for index, component in enumerate(up)))
    )
    y_axis = normalize_vec3(projected_up)
    x_axis = normalize_vec3(cross(y_axis, back))
    # Re-orthogonalize after normalization so the matrix-to-quaternion path is stable.
    y_axis = normalize_vec3(cross(back, x_axis))
    m00, m01, m02 = x_axis[0], y_axis[0], back[0]
    m10, m11, m12 = x_axis[1], y_axis[1], back[1]
    m20, m21, m22 = x_axis[2], y_axis[2], back[2]
    trace = m00 + m11 + m22
    if trace > 0:
        factor = 0.5 / math.sqrt(trace + 1.0)
        return normalize_quat(
            ((m21 - m12) * factor, (m02 - m20) * factor, (m10 - m01) * factor, 0.25 / factor)
        )
    if m00 > m11 and m00 > m22:
        factor = 2.0 * math.sqrt(1.0 + m00 - m11 - m22)
        return normalize_quat(
            ((m21 - m12) / factor, 0.25 * factor, (m01 + m10) / factor, (m02 + m20) / factor)
        )
    if m11 > m22:
        factor = 2.0 * math.sqrt(1.0 + m11 - m00 - m22)
        return normalize_quat(
            ((m02 - m20) / factor, (m01 + m10) / factor, 0.25 * factor, (m12 + m21) / factor)
        )
    factor = 2.0 * math.sqrt(1.0 + m22 - m00 - m11)
    return normalize_quat(
        ((m10 - m01) / factor, (m02 + m20) / factor, (m12 + m21) / factor, 0.25 * factor)
    )


def vertical_fov_deg(focal_length_mm: float, sensor_width_mm: float, aspect: float) -> float:
    if focal_length_mm <= 0 or sensor_width_mm <= 0 or aspect <= 0:
        raise ValueError("focal length, sensor width, and aspect must be positive")
    sensor_height_mm = sensor_width_mm / aspect
    return math.degrees(2 * math.atan(sensor_height_mm / (2 * focal_length_mm)))
