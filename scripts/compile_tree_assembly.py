#!/usr/bin/env python3
"""Compile a small articulated tree assembly into a native-aligned B3SCENE."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

JOINT_ANCHOR_TOLERANCE_M = 1e-4
JOINT_AXIS_TOLERANCE_RAD = 1e-4


def finite(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def vec(value: Any, size: int, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != size or not all(finite(item) for item in value):
        raise ValueError(f"{label} must contain {size} finite numbers")
    return [float(item) for item in value]


def quat(value: Any, label: str) -> list[float]:
    result = vec(value, 4, label)
    norm = math.sqrt(sum(component * component for component in result))
    if norm <= 1e-8 or not math.isclose(norm, 1.0, rel_tol=0, abs_tol=1e-3):
        raise ValueError(f"{label} must be a normalized, non-zero quaternion")
    return [component / norm for component in result]


def rotate_vector(rotation: list[float], vector: list[float]) -> list[float]:
    """Rotate a vector by an XYZW unit quaternion."""
    x, y, z, w = rotation
    vx, vy, vz = vector
    tx = 2.0 * (y * vz - z * vy)
    ty = 2.0 * (z * vx - x * vz)
    tz = 2.0 * (x * vy - y * vx)
    return [
        vx + w * tx + (y * tz - z * ty),
        vy + w * ty + (z * tx - x * tz),
        vz + w * tz + (x * ty - y * tx),
    ]


def multiply_quaternions(left: list[float], right: list[float]) -> list[float]:
    lx, ly, lz, lw = left
    rx, ry, rz, rw = right
    return [
        lw * rx + lx * rw + ly * rz - lz * ry,
        lw * ry - lx * rz + ly * rw + lz * rx,
        lw * rz + lx * ry - ly * rx + lz * rw,
        lw * rw - lx * rx - ly * ry - lz * rz,
    ]


def validate_joint_frame(
    joint: dict[str, Any], bodies: dict[str, dict[str, Any]], native_v2: bool
) -> None:
    body_a = bodies[joint["body_a"]]
    body_b = bodies[joint["body_b"]]
    rotation_a = quat(body_a.get("rotation", [0.0, 0.0, 0.0, 1.0]), "body rotation")
    rotation_b = quat(body_b.get("rotation", [0.0, 0.0, 0.0, 1.0]), "body rotation")
    position_a = vec(body_a["position"], 3, "body position")
    position_b = vec(body_b["position"], 3, "body position")
    anchor_a = vec(joint["anchor_a"], 3, "joint anchor_a")
    anchor_b = vec(joint["anchor_b"], 3, "joint anchor_b")
    world_a = [a + b for a, b in zip(position_a, rotate_vector(rotation_a, anchor_a), strict=True)]
    world_b = [a + b for a, b in zip(position_b, rotate_vector(rotation_b, anchor_b), strict=True)]
    separation = math.dist(world_a, world_b)
    if separation > JOINT_ANCHOR_TOLERANCE_M:
        raise ValueError(
            f"joint {joint['id']} initial anchor separation {separation:.9g} m exceeds "
            f"{JOINT_ANCHOR_TOLERANCE_M:.9g} m"
        )

    if not native_v2:
        return
    frame_a = quat(
        joint.get("frame_a_quaternion", [0.0, 0.0, 0.0, 1.0]),
        f"joint {joint['id']} frame_a_quaternion",
    )
    frame_b = quat(
        joint.get("frame_b_quaternion", [0.0, 0.0, 0.0, 1.0]),
        f"joint {joint['id']} frame_b_quaternion",
    )
    axis_a = rotate_vector(multiply_quaternions(rotation_a, frame_a), [0.0, 0.0, 1.0])
    axis_b = rotate_vector(multiply_quaternions(rotation_b, frame_b), [0.0, 0.0, 1.0])
    dot = max(-1.0, min(1.0, sum(a * b for a, b in zip(axis_a, axis_b, strict=True))))
    angle = math.acos(dot)
    if angle > JOINT_AXIS_TOLERANCE_RAD:
        raise ValueError(
            f"joint {joint['id']} initial axis misalignment {angle:.9g} rad exceeds "
            f"{JOINT_AXIS_TOLERANCE_RAD:.9g} rad"
        )


def integral_ratio(numerator: float, denominator: float, label: str) -> int:
    ratio = numerator / denominator
    rounded = round(ratio)
    if rounded < 1 or not math.isclose(ratio, rounded, rel_tol=0, abs_tol=1e-8):
        raise ValueError(f"{label} must be an integer ratio; got {ratio:.12g}")
    return rounded


def validate(spec: dict[str, Any]) -> None:
    schema = spec.get("schema")
    if schema not in {"tree-assembly/1", "tree-assembly/2"}:
        raise ValueError("assembly schema must be 'tree-assembly/1' or 'tree-assembly/2'")
    native_v2 = schema == "tree-assembly/2"
    fps = spec.get("fps")
    duration = spec.get("duration_s")
    step = spec.get("fixed_step_s")
    if (
        not finite(fps)
        or fps <= 0
        or not finite(duration)
        or duration <= 0
        or not finite(step)
        or step <= 0
    ):
        raise ValueError("fps, duration_s, and fixed_step_s must be positive")
    if not isinstance(spec.get("substeps"), int) or spec["substeps"] < 1:
        raise ValueError("substeps must be a positive integer")
    vec(spec.get("gravity_m_s2"), 3, "gravity_m_s2")
    ground = spec.get("ground")
    if not isinstance(ground, dict):
        raise ValueError("ground must be an object")
    for key in ("height_m", "half_extent_m", "friction", "restitution"):
        if not finite(ground.get(key)):
            raise ValueError(f"ground.{key} must be finite")
    if (
        ground["half_extent_m"] <= 0
        or ground["friction"] < 0
        or not 0 <= ground["restitution"] <= 1
    ):
        raise ValueError("ground dimensions/material values are invalid")
    bodies = spec.get("bodies")
    if not isinstance(bodies, list) or not bodies:
        raise ValueError("bodies must be a non-empty list")
    ids: dict[str, int] = {}
    bodies_by_id: dict[str, dict[str, Any]] = {}
    for index, body in enumerate(bodies):
        if not isinstance(body, dict) or not isinstance(body.get("id"), str) or body["id"] in ids:
            raise ValueError("body ids must be unique strings")
        ids[body["id"]] = index
        bodies_by_id[body["id"]] = body
        if native_v2:
            if body.get("body_type") not in {"static", "dynamic"}:
                raise ValueError(f"body {body['id']} body_type must be 'static' or 'dynamic'")
            is_dynamic = body["body_type"] == "dynamic"
        else:
            if not isinstance(body.get("dynamic"), bool):
                raise ValueError(f"body {body['id']} dynamic must be boolean")
            is_dynamic = body["dynamic"]
        if any(item <= 0 for item in vec(body.get("half"), 3, f"body {body['id']} half")):
            raise ValueError(f"body {body['id']} half extents must be positive")
        vec(body.get("position"), 3, f"body {body['id']} position")
        quat(body.get("rotation", [0.0, 0.0, 0.0, 1.0]), f"body {body['id']} rotation")
        vec(body.get("linear_velocity", [0.0, 0.0, 0.0]), 3, f"body {body['id']} linear_velocity")
        vec(body.get("angular_velocity", [0.0, 0.0, 0.0]), 3, f"body {body['id']} angular_velocity")
        for key in ("density", "friction", "restitution"):
            if not is_dynamic and key in body:
                raise ValueError(f"static body {body['id']} must not specify {key}")
        if is_dynamic and (not finite(body.get("density", 0)) or body.get("density", 0) <= 0):
            raise ValueError(f"dynamic body {body['id']} needs positive density")
    joints = spec.get("joints")
    if not isinstance(joints, list):
        raise ValueError("joints must be a list")
    joint_ids: set[str] = set()
    for joint in joints:
        if (
            not isinstance(joint, dict)
            or not isinstance(joint.get("id"), str)
            or joint["id"] in joint_ids
        ):
            raise ValueError("joint ids must be unique strings")
        joint_ids.add(joint["id"])
        if joint.get("body_a") not in ids or joint.get("body_b") not in ids:
            raise ValueError(f"joint {joint['id']} references an unknown body")
        vec(joint.get("anchor_a"), 3, f"joint {joint['id']} anchor_a")
        vec(joint.get("anchor_b"), 3, f"joint {joint['id']} anchor_b")
        for key in ("hertz", "damping_ratio", "lower_angle", "upper_angle"):
            if not finite(joint.get(key)):
                raise ValueError(f"joint {joint['id']} {key} must be finite")
        if native_v2:
            quat(
                joint.get("frame_a_quaternion", [0.0, 0.0, 0.0, 1.0]),
                f"joint {joint['id']} frame_a_quaternion",
            )
            quat(
                joint.get("frame_b_quaternion", [0.0, 0.0, 0.0, 1.0]),
                f"joint {joint['id']} frame_b_quaternion",
            )
            vec(
                joint.get("release_angular_impulse", [0.0, 0.0, 0.0]),
                3,
                f"joint {joint['id']} release_angular_impulse",
            )
            for key in ("enable_spring", "enable_limit", "collide_connected"):
                if key in joint and not isinstance(joint[key], bool):
                    raise ValueError(f"joint {joint['id']} {key} must be boolean")
            if "target_angle" in joint and not finite(joint["target_angle"]):
                raise ValueError(f"joint {joint['id']} target_angle must be finite")
        else:
            vec(
                joint.get("release_angular_velocity", [0.0, 0.0, 0.0]),
                3,
                f"joint {joint['id']} release_angular_velocity",
            )
        if not isinstance(joint.get("release_step"), int) or joint["release_step"] < -1:
            raise ValueError(f"joint {joint['id']} release_step must be -1 or non-negative")
        validate_joint_frame(joint, bodies_by_id, native_v2)


def compile_spec(spec: dict[str, Any]) -> str:
    validate(spec)
    bodies = spec["bodies"]
    body_ids = {body["id"]: index for index, body in enumerate(bodies)}
    step = float(spec["fixed_step_s"])
    total_steps = integral_ratio(float(spec["duration_s"]), step, "duration/fixed step")
    sample_every = integral_ratio(1 / float(spec["fps"]), step, "sample interval/fixed step")
    ground = spec["ground"]
    world = [
        "world",
        *spec["gravity_m_s2"],
        step,
        spec["substeps"],
        total_steps,
        sample_every,
        ground["height_m"],
        ground["half_extent_m"],
        ground["friction"],
        ground["restitution"],
        len(bodies),
        len(spec["joints"]),
    ]
    native_v2 = spec["schema"] == "tree-assembly/2"
    lines = [f"B3SCENE {3 if native_v2 else 2}", " ".join(map(str, world))]
    for body in bodies:
        if native_v2:
            dynamic = 1 if body["body_type"] == "dynamic" else 0
        else:
            dynamic = 1 if body["dynamic"] else 0
        density = body.get("density", 0.0)
        friction = body.get("friction", ground["friction"])
        restitution = body.get("restitution", ground["restitution"])
        lines.append(
            " ".join(
                map(
                    str,
                    [
                        "body",
                        body["id"],
                        dynamic,
                        *body["half"],
                        *body["position"],
                        *quat(
                            body.get("rotation", [0.0, 0.0, 0.0, 1.0]),
                            f"body {body['id']} rotation",
                        ),
                        *body.get("linear_velocity", [0.0, 0.0, 0.0]),
                        *body.get("angular_velocity", [0.0, 0.0, 0.0]),
                        density,
                        friction,
                        restitution,
                    ],
                )
            )
        )
    for joint in spec["joints"]:
        if native_v2:
            fields = [
                "joint",
                joint["id"],
                "revolute",
                body_ids[joint["body_a"]],
                body_ids[joint["body_b"]],
                *joint["anchor_a"],
                *joint["anchor_b"],
                *quat(
                    joint.get("frame_a_quaternion", [0.0, 0.0, 0.0, 1.0]),
                    f"joint {joint['id']} frame_a_quaternion",
                ),
                *quat(
                    joint.get("frame_b_quaternion", [0.0, 0.0, 0.0, 1.0]),
                    f"joint {joint['id']} frame_b_quaternion",
                ),
                joint["hertz"],
                joint["damping_ratio"],
                joint["lower_angle"],
                joint["upper_angle"],
                int(joint.get("enable_spring", True)),
                joint["release_step"],
                *joint.get("release_angular_impulse", [0.0, 0.0, 0.0]),
                joint.get("target_angle", 0.0),
                int(joint.get("enable_limit", True)),
                int(joint.get("collide_connected", False)),
            ]
        else:
            fields = [
                "joint",
                joint["id"],
                "revolute",
                body_ids[joint["body_a"]],
                body_ids[joint["body_b"]],
                *joint["anchor_a"],
                *joint["anchor_b"],
                joint["hertz"],
                joint["damping_ratio"],
                joint["lower_angle"],
                joint["upper_angle"],
                1,
                joint["release_step"],
                *joint.get("release_angular_velocity", [0.0, 0.0, 0.0]),
            ]
        lines.append(" ".join(map(str, fields)))
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assembly", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        spec = json.loads(args.assembly.read_text(encoding="utf-8"))
        text = compile_spec(spec)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(exc)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    print(f"compiled articulated Box3D input: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
