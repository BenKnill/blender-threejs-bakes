#!/usr/bin/env python3
"""Compile continuous scene state plus a render job into layout schema 1."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

from scene_math import (
    Quat,
    Vec3,
    add,
    compose_pose,
    look_at_quaternion,
    quat,
    rotate_vec,
    scale,
    vec3,
    vertical_fov_deg,
)
from validate_scene import validate_scene

JOB_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
JOB_KEYS = {"schema", "name", "active_camera", "fps", "duration_s", "output"}
OUTPUT_KEYS = {"width_px", "height_px", "samples"}


def finite_positive(value: Any) -> bool:
    return (
        isinstance(value, int | float)
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > 0
    )


def validate_render_job(job: Any) -> list[str]:
    if not isinstance(job, dict):
        return ["render job must be an object"]
    errors: list[str] = []
    for key in sorted(JOB_KEYS - job.keys()):
        errors.append(f"render job: missing required field {key!r}")
    for key in sorted(job.keys() - JOB_KEYS):
        errors.append(f"render job: unknown field {key!r}")
    if job.get("schema") != "render-job/1":
        errors.append("render job.schema: must be 'render-job/1'")
    if not isinstance(job.get("name"), str) or not JOB_NAME_PATTERN.fullmatch(job["name"]):
        errors.append("render job.name: must match ^[a-z][a-z0-9_]*$")
    if not isinstance(job.get("active_camera"), str) or not job["active_camera"]:
        errors.append("render job.active_camera: must be a non-empty entity id")
    if not finite_positive(job.get("fps")):
        errors.append("render job.fps: must be a positive finite number")
    duration = job.get("duration_s")
    if (
        not isinstance(duration, int | float)
        or isinstance(duration, bool)
        or not math.isfinite(duration)
        or duration < 0
    ):
        errors.append("render job.duration_s: must be a non-negative finite number")

    output = job.get("output")
    if not isinstance(output, dict):
        errors.append("render job.output: must be an object")
        return errors
    for key in sorted(OUTPUT_KEYS - output.keys()):
        errors.append(f"render job.output: missing required field {key!r}")
    for key in sorted(output.keys() - OUTPUT_KEYS):
        errors.append(f"render job.output: unknown field {key!r}")
    for key in OUTPUT_KEYS:
        if (
            not isinstance(output.get(key), int)
            or isinstance(output.get(key), bool)
            or output[key] <= 0
        ):
            errors.append(f"render job.output.{key}: must be a positive integer")
    return errors


def resolve_world_poses(entities: list[dict[str, Any]]) -> dict[str, tuple[Vec3, Quat]]:
    by_id = {entity["id"]: entity for entity in entities}
    resolved: dict[str, tuple[Vec3, Quat]] = {}

    def resolve(entity_id: str) -> tuple[Vec3, Quat]:
        if entity_id in resolved:
            return resolved[entity_id]
        entity = by_id[entity_id]
        local_position = vec3(entity["pose"]["position_m"])
        local_orientation = quat(entity["pose"]["orientation_xyzw"])
        frame = entity["frame"]
        if frame == "world":
            world_pose = local_position, local_orientation
        else:
            parent_position, parent_orientation = resolve(frame)
            world_pose = compose_pose(
                parent_position, parent_orientation, local_position, local_orientation
            )
        resolved[entity_id] = world_pose
        return world_pose

    for entity in entities:
        resolve(entity["id"])
    for entity in entities:
        if entity["kind"] != "camera" or "look_at" not in entity["camera"]:
            continue
        look_at = entity["camera"]["look_at"]
        target = vec3(look_at["target_position_m"])
        position, _ = resolved[entity["id"]]
        up = vec3(look_at.get("up_direction_xyz", [0.0, 1.0, 0.0]))
        resolved[entity["id"]] = (position, look_at_quaternion(position, target, up))
    return resolved


def compile_layout(
    scene: dict[str, Any], job: dict[str, Any], known_asset_ids: set[str] | None = None
) -> dict[str, Any]:
    scene_errors = validate_scene(scene)
    job_errors = validate_render_job(job)
    if scene_errors or job_errors:
        raise ValueError("\n".join([*scene_errors, *job_errors]))

    entities = scene["entities"]
    if known_asset_ids is not None:
        missing_assets = sorted(
            entity["asset"]["asset_id"]
            for entity in entities
            if entity["kind"] == "asset" and entity["asset"]["asset_id"] not in known_asset_ids
        )
        if missing_assets:
            raise ValueError(f"scene assets missing from manifest: {', '.join(missing_assets)}")

    by_id = {entity["id"]: entity for entity in entities}
    camera_id = job["active_camera"]
    camera_entity = by_id.get(camera_id)
    if camera_entity is None or camera_entity["kind"] != "camera":
        raise ValueError(f"render job.active_camera: {camera_id!r} is not a camera entity")

    poses = resolve_world_poses(entities)
    instances = []
    for entity in entities:
        if entity["kind"] != "asset":
            continue
        position, orientation = poses[entity["id"]]
        instances.append(
            {
                "instance_id": entity["id"],
                "asset_id": entity["asset"]["asset_id"],
                "position": list(position),
                "quaternion": list(orientation),
                "scale": list(entity["pose"].get("scale_xyz", [1, 1, 1])),
            }
        )

    width = job["output"]["width_px"]
    height = job["output"]["height_px"]
    camera_position, camera_orientation = poses[camera_id]
    optics = camera_entity["camera"]
    target_distance = optics.get("focus_distance_m", 1.0)
    forward = rotate_vec(camera_orientation, (0.0, 0.0, -1.0))
    up = rotate_vec(camera_orientation, (0.0, 1.0, 0.0))

    return {
        "name": job["name"],
        "schema": 1,
        "space": scene["space"],
        "instances": instances,
        "camera": {
            "position": list(camera_position),
            "target": list(add(camera_position, scale(forward, target_distance))),
            "fov_deg": vertical_fov_deg(
                optics["focal_length_mm"], optics["sensor_width_mm"], width / height
            ),
            "up": list(up),
        },
        "render": {"width": width, "height": height, "samples": job["output"]["samples"]},
    }


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def manifest_asset_ids(manifest: Any) -> set[str]:
    if not isinstance(manifest, dict) or not isinstance(manifest.get("assets"), list):
        raise ValueError("asset manifest must contain an assets array")
    ids = {
        asset.get("id")
        for asset in manifest["assets"]
        if isinstance(asset, dict) and isinstance(asset.get("id"), str) and asset["id"]
    }
    if len(ids) != len(manifest["assets"]):
        raise ValueError("every manifest asset must have a unique non-empty id")
    return ids


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene", type=Path)
    parser.add_argument("render_job", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "assets/manifest.json",
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        asset_ids = manifest_asset_ids(load_json(args.manifest))
        layout = compile_layout(load_json(args.scene), load_json(args.render_job), asset_ids)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(exc)
        return 1

    text = json.dumps(layout, indent=2) + "\n"
    if args.output is None:
        print(text, end="")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
        print(f"compiled layout: {args.output} ({len(layout['instances'])} instances)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
