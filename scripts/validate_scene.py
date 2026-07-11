#!/usr/bin/env python3
"""Validate the dependency-free semantic core of a scene-state/1 document."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
KINDS = {"asset", "camera"}
BODY_TYPES = {"static", "dynamic", "kinematic"}
ENTITY_KEYS = {"id", "kind", "frame", "pose", "motion", "asset", "camera", "physics"}


class SceneErrors:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def add(self, path: str, message: str) -> None:
        self.messages.append(f"{path}: {message}")

    def require_keys(self, value: dict[str, Any], keys: set[str], path: str) -> None:
        for key in sorted(keys - value.keys()):
            self.add(path, f"missing required field {key!r}")

    def reject_unknown(self, value: dict[str, Any], keys: set[str], path: str) -> None:
        for key in sorted(value.keys() - keys):
            self.add(path, f"unknown field {key!r}")


def is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def check_vec(value: Any, size: int, path: str, errors: SceneErrors) -> bool:
    if not isinstance(value, list) or len(value) != size:
        errors.add(path, f"must be an array of {size} finite numbers")
        return False
    if not all(is_number(component) for component in value):
        errors.add(path, f"must be an array of {size} finite numbers")
        return False
    return True


def check_positive(value: Any, path: str, errors: SceneErrors) -> None:
    if not is_number(value) or value <= 0:
        errors.add(path, "must be a positive finite number")


def check_pose(entity: dict[str, Any], path: str, errors: SceneErrors) -> None:
    pose = entity.get("pose")
    if not isinstance(pose, dict):
        errors.add(f"{path}.pose", "must be an object")
        return
    errors.require_keys(pose, {"position_m", "orientation_xyzw"}, f"{path}.pose")
    errors.reject_unknown(pose, {"position_m", "orientation_xyzw", "scale_xyz"}, f"{path}.pose")
    check_vec(pose.get("position_m"), 3, f"{path}.pose.position_m", errors)
    quaternion = pose.get("orientation_xyzw")
    if check_vec(quaternion, 4, f"{path}.pose.orientation_xyzw", errors):
        norm = math.sqrt(sum(component * component for component in quaternion))
        if abs(norm - 1.0) > 1e-4:
            errors.add(f"{path}.pose.orientation_xyzw", f"must be normalized; norm is {norm:.8g}")
    if "scale_xyz" in pose:
        scale = pose["scale_xyz"]
        if check_vec(scale, 3, f"{path}.pose.scale_xyz", errors) and any(
            value <= 0 for value in scale
        ):
            errors.add(f"{path}.pose.scale_xyz", "must contain positive values")


def check_motion(entity: dict[str, Any], path: str, errors: SceneErrors) -> None:
    motion = entity.get("motion")
    if not isinstance(motion, dict):
        errors.add(f"{path}.motion", "must be an object")
        return
    required = {"linear_velocity_m_s", "angular_velocity_rad_s"}
    errors.require_keys(motion, required, f"{path}.motion")
    errors.reject_unknown(motion, required, f"{path}.motion")
    check_vec(motion.get("linear_velocity_m_s"), 3, f"{path}.motion.linear_velocity_m_s", errors)
    check_vec(
        motion.get("angular_velocity_rad_s"), 3, f"{path}.motion.angular_velocity_rad_s", errors
    )


def check_kind_payload(entity: dict[str, Any], path: str, errors: SceneErrors) -> None:
    kind = entity.get("kind")
    payloads = {"asset", "camera"}
    for payload in payloads - {kind}:
        if payload in entity:
            errors.add(path, f"kind {kind!r} cannot contain {payload!r}")

    if kind == "asset":
        asset = entity.get("asset")
        if not isinstance(asset, dict) or set(asset) != {"asset_id"} or not asset.get("asset_id"):
            errors.add(f"{path}.asset", "must contain exactly one non-empty asset_id")
    elif kind == "camera":
        check_camera(entity.get("camera"), f"{path}.camera", errors)


def check_camera(value: Any, path: str, errors: SceneErrors) -> None:
    if not isinstance(value, dict):
        errors.add(path, "must be an object")
        return
    allowed = {
        "focal_length_mm",
        "sensor_width_mm",
        "focus_distance_m",
        "aperture_fstop",
        "exposure_stops",
        "look_at",
    }
    errors.require_keys(value, {"focal_length_mm", "sensor_width_mm"}, path)
    errors.reject_unknown(value, allowed, path)
    for key in ("focal_length_mm", "sensor_width_mm"):
        check_positive(value.get(key), f"{path}.{key}", errors)
    for key in ("focus_distance_m", "aperture_fstop"):
        if key in value:
            check_positive(value[key], f"{path}.{key}", errors)
    if "exposure_stops" in value and not is_number(value["exposure_stops"]):
        errors.add(f"{path}.exposure_stops", "must be a finite number")
    if "look_at" in value:
        look_at = value["look_at"]
        if not isinstance(look_at, dict):
            errors.add(f"{path}.look_at", "must be an object")
        else:
            errors.require_keys(look_at, {"target_position_m"}, f"{path}.look_at")
            errors.reject_unknown(
                look_at, {"target_position_m", "up_direction_xyz"}, f"{path}.look_at"
            )
            check_vec(
                look_at.get("target_position_m"), 3, f"{path}.look_at.target_position_m", errors
            )
            if "up_direction_xyz" in look_at:
                up = look_at["up_direction_xyz"]
                if check_vec(up, 3, f"{path}.look_at.up_direction_xyz", errors) and not any(up):
                    errors.add(f"{path}.look_at.up_direction_xyz", "must not be the zero vector")


def check_physics(value: Any, path: str, errors: SceneErrors) -> None:
    if not isinstance(value, dict):
        errors.add(path, "must be an object")
        return
    allowed = {
        "body_type",
        "collider",
        "density_kg_m3",
        "friction",
        "restitution",
        "linear_damping",
        "angular_damping",
        "gravity_scale",
        "sleep_threshold_m_s",
        "enable_sleep",
        "is_awake",
        "is_bullet",
        "is_enabled",
        "allow_fast_rotation",
        "enable_contact_recycling",
        "motion_locks",
    }
    errors.require_keys(value, {"body_type", "collider"}, path)
    errors.reject_unknown(value, allowed, path)
    if value.get("body_type") not in BODY_TYPES:
        errors.add(f"{path}.body_type", f"must be one of {sorted(BODY_TYPES)}")
    if not isinstance(value.get("collider"), str) or not value["collider"]:
        errors.add(f"{path}.collider", "must be a non-empty string")
    if value.get("body_type") == "dynamic":
        check_positive(value.get("density_kg_m3"), f"{path}.density_kg_m3", errors)
    if "friction" in value and (not is_number(value["friction"]) or value["friction"] < 0):
        errors.add(f"{path}.friction", "must be a finite number greater than or equal to zero")
    if "restitution" in value and (
        not is_number(value["restitution"]) or not 0 <= value["restitution"] <= 1
    ):
        errors.add(f"{path}.restitution", "must be a finite number from zero through one")
    for key in ("linear_damping", "angular_damping", "sleep_threshold_m_s"):
        if key in value and (not is_number(value[key]) or value[key] < 0):
            errors.add(f"{path}.{key}", "must be a finite number greater than or equal to zero")
    if "gravity_scale" in value and not is_number(value["gravity_scale"]):
        errors.add(f"{path}.gravity_scale", "must be a finite number")
    for key in (
        "enable_sleep",
        "is_awake",
        "is_bullet",
        "is_enabled",
        "allow_fast_rotation",
        "enable_contact_recycling",
    ):
        if key in value and not isinstance(value[key], bool):
            errors.add(f"{path}.{key}", "must be boolean")
    if "motion_locks" in value:
        locks = value["motion_locks"]
        lock_keys = {"linear_x", "linear_y", "linear_z", "angular_x", "angular_y", "angular_z"}
        if not isinstance(locks, dict):
            errors.add(f"{path}.motion_locks", "must be an object")
        else:
            errors.reject_unknown(locks, lock_keys, f"{path}.motion_locks")
            for key in lock_keys & locks.keys():
                if not isinstance(locks[key], bool):
                    errors.add(f"{path}.motion_locks.{key}", "must be boolean")


def check_hierarchy(entities: list[dict[str, Any]], errors: SceneErrors) -> None:
    ids = {entity.get("id") for entity in entities if isinstance(entity.get("id"), str)}
    parents: dict[str, str] = {}
    for index, entity in enumerate(entities):
        entity_id = entity.get("id")
        frame = entity.get("frame")
        if frame != "world" and frame not in ids:
            errors.add(f"entities[{index}].frame", f"unknown reference frame {frame!r}")
        if isinstance(entity_id, str) and isinstance(frame, str) and frame != "world":
            parents[entity_id] = frame

    for start in parents:
        seen: set[str] = set()
        current = start
        while current in parents:
            if current in seen:
                errors.add(f"entities[{start}].frame", "reference-frame hierarchy contains a cycle")
                break
            seen.add(current)
            current = parents[current]


def validate_scene(scene: Any) -> list[str]:
    errors = SceneErrors()
    if not isinstance(scene, dict):
        return ["scene: must be an object"]
    errors.require_keys(scene, {"schema", "space", "entities"}, "scene")
    errors.reject_unknown(scene, {"schema", "space", "entities"}, "scene")
    if scene.get("schema") != "scene-state/1":
        errors.add("scene.schema", "must be 'scene-state/1'")
    if scene.get("space") != "threejs_yup":
        errors.add("scene.space", "must be 'threejs_yup'")

    entities = scene.get("entities")
    if not isinstance(entities, list) or not entities:
        errors.add("scene.entities", "must be a non-empty array")
        return errors.messages

    seen_ids: set[str] = set()
    valid_entities: list[dict[str, Any]] = []
    for index, entity in enumerate(entities):
        path = f"entities[{index}]"
        if not isinstance(entity, dict):
            errors.add(path, "must be an object")
            continue
        valid_entities.append(entity)
        errors.require_keys(entity, {"id", "kind", "frame", "pose", "motion"}, path)
        errors.reject_unknown(entity, ENTITY_KEYS, path)
        entity_id = entity.get("id")
        if not isinstance(entity_id, str) or not ID_PATTERN.fullmatch(entity_id):
            errors.add(f"{path}.id", "must match ^[a-z][a-z0-9_]*$")
        elif entity_id in seen_ids:
            errors.add(f"{path}.id", f"duplicate entity id {entity_id!r}")
        else:
            seen_ids.add(entity_id)
        if entity.get("kind") not in KINDS:
            errors.add(f"{path}.kind", f"must be one of {sorted(KINDS)}")
        if not isinstance(entity.get("frame"), str) or not entity["frame"]:
            errors.add(f"{path}.frame", "must be 'world' or an entity id")
        check_pose(entity, path, errors)
        check_motion(entity, path, errors)
        check_kind_payload(entity, path, errors)
        if "physics" in entity:
            check_physics(entity["physics"], f"{path}.physics", errors)

    check_hierarchy(valid_entities, errors)
    return errors.messages


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene", type=Path)
    args = parser.parse_args()
    try:
        scene = json.loads(args.scene.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"{args.scene}: {exc}")
        return 2

    messages = validate_scene(scene)
    if messages:
        for message in messages:
            print(message)
        return 1
    print(f"valid scene: {args.scene} ({len(scene['entities'])} entities)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
