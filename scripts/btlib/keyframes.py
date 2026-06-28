"""Pure keyframe pose helpers for first/last-frame shot layouts."""

from __future__ import annotations

import copy
import math
from typing import Any

from btlib.geometry import Vec3, cross, normalize, sub


def layout_with_pose(layout: dict[str, Any], pose_name: str) -> dict[str, Any]:
    if pose_name == "base":
        return copy.deepcopy(layout)
    keyframes = layout.get("keyframes") or {}
    if pose_name not in ("a", "b"):
        raise ValueError(f"unknown pose: {pose_name}")
    posed = copy.deepcopy(layout)
    pose = keyframes.get(pose_name) or {}
    apply_instance_overrides(posed, pose.get("instances") or {})
    if "camera" in pose:
        posed["camera"] = {**posed["camera"], **pose["camera"]}
    if pose.get("camera_move"):
        posed["camera"] = camera_after_move(posed["camera"], pose["camera_move"])
    posed["name"] = f"{layout['name']}_{pose_name}"
    posed["schema"] = 2
    posed.pop("keyframes", None)
    return posed


def apply_instance_overrides(layout: dict[str, Any], overrides: dict[str, dict]) -> None:
    by_id = {instance["instance_id"]: instance for instance in layout["instances"]}
    for instance_id, transform in overrides.items():
        if instance_id not in by_id:
            raise ValueError(f"keyframe references unknown instance_id: {instance_id}")
        instance = by_id[instance_id]
        for key in ("position", "quaternion", "scale"):
            if key in transform:
                instance[key] = transform[key]


def camera_after_move(camera: dict[str, Any], move: dict[str, Any]) -> dict[str, Any]:
    preset = move.get("preset")
    if preset in ("push_in", "pull_out"):
        amount = float(move.get("amount", 0.25))
        if preset == "pull_out":
            amount = -amount
        return move_along_view(camera, amount)
    if preset in ("orbit_left", "orbit_right"):
        degrees = float(move.get("degrees", 20))
        if preset == "orbit_right":
            degrees = -degrees
        return orbit_camera(camera, degrees)
    if preset == "crane_up":
        amount = float(move.get("amount", 1.0))
        return offset_camera(camera, [0, amount, 0], move_target=True)
    if preset == "dolly":
        amount = float(move.get("amount", 1.0))
        right = camera_right(camera)
        return offset_camera(camera, [axis * amount for axis in right], move_target=True)
    if preset == "whip":
        return orbit_camera(camera, float(move.get("degrees", 45)))
    raise ValueError(f"unknown camera_move preset: {preset}")


def move_along_view(camera: dict[str, Any], fraction: float) -> dict[str, Any]:
    position = as_vec(camera["position"])
    target = as_vec(camera["target"])
    delta = sub(target, position)
    return {**camera, "position": [position[index] + delta[index] * fraction for index in range(3)]}


def orbit_camera(camera: dict[str, Any], degrees: float) -> dict[str, Any]:
    position = as_vec(camera["position"])
    target = as_vec(camera["target"])
    relative = sub(position, target)
    radians = math.radians(degrees)
    cos_t = math.cos(radians)
    sin_t = math.sin(radians)
    rotated = [
        relative[0] * cos_t + relative[2] * sin_t,
        relative[1],
        -relative[0] * sin_t + relative[2] * cos_t,
    ]
    return {**camera, "position": [target[index] + rotated[index] for index in range(3)]}


def offset_camera(camera: dict[str, Any], offset: Vec3, move_target: bool) -> dict[str, Any]:
    moved = {
        **camera,
        "position": [camera["position"][index] + offset[index] for index in range(3)],
    }
    if move_target:
        moved["target"] = [camera["target"][index] + offset[index] for index in range(3)]
    return moved


def camera_right(camera: dict[str, Any]) -> Vec3:
    forward = normalize(sub(camera["target"], camera["position"]))
    up = normalize(camera.get("up", [0, 1, 0]))
    return normalize(cross(forward, up))


def as_vec(values: list[float]) -> Vec3:
    return [float(value) for value in values]
