#!/usr/bin/env python3
"""Compile scene state into the compact input consumed by box3d_scene_runner."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from compile_scene import (
    load_json,
    manifest_asset_ids,
    resolve_world_poses,
    validate_render_job,
)
from validate_scene import validate_scene

SIM_KEYS = {
    "schema",
    "gravity_m_s2",
    "fixed_step_s",
    "substeps",
    "restitution_threshold_m_s",
    "hit_event_threshold_m_s",
    "contact_hertz",
    "contact_damping_ratio",
    "contact_speed_m_s",
    "maximum_linear_speed_m_s",
    "enable_sleep",
    "enable_continuous",
    "ground",
}
SIM_REQUIRED_KEYS = {"schema", "gravity_m_s2", "fixed_step_s", "substeps", "ground"}
GROUND_KEYS = {"height_m", "half_extent_m", "friction", "restitution"}
BODY_TYPE_CODES = {"static": 0, "kinematic": 1, "dynamic": 2}
MOTION_LOCK_KEYS = ("linear_x", "linear_y", "linear_z", "angular_x", "angular_y", "angular_z")


def finite_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def validate_simulation_job(job: Any) -> list[str]:
    if not isinstance(job, dict):
        return ["simulation job must be an object"]
    errors: list[str] = []
    for key in sorted(SIM_REQUIRED_KEYS - job.keys()):
        errors.append(f"simulation job: missing required field {key!r}")
    for key in sorted(job.keys() - SIM_KEYS):
        errors.append(f"simulation job: unknown field {key!r}")
    if job.get("schema") != "simulation-job/1":
        errors.append("simulation job.schema: must be 'simulation-job/1'")
    gravity = job.get("gravity_m_s2")
    if not isinstance(gravity, list) or len(gravity) != 3 or not all(map(finite_number, gravity)):
        errors.append("simulation job.gravity_m_s2: must contain three finite numbers")
    if not finite_number(job.get("fixed_step_s")) or job["fixed_step_s"] <= 0:
        errors.append("simulation job.fixed_step_s: must be positive")
    if (
        not isinstance(job.get("substeps"), int)
        or isinstance(job.get("substeps"), bool)
        or job["substeps"] < 1
    ):
        errors.append("simulation job.substeps: must be a positive integer")
    for key in ("restitution_threshold_m_s", "hit_event_threshold_m_s", "contact_speed_m_s"):
        if key in job and (not finite_number(job[key]) or job[key] < 0):
            errors.append(
                f"simulation job.{key}: must be a finite number greater than or equal to zero"
            )
    for key in ("contact_hertz", "contact_damping_ratio", "maximum_linear_speed_m_s"):
        if key in job and (not finite_number(job[key]) or job[key] <= 0):
            errors.append(f"simulation job.{key}: must be a positive finite number")
    for key in ("enable_sleep", "enable_continuous"):
        if key in job and not isinstance(job[key], bool):
            errors.append(f"simulation job.{key}: must be boolean")
    ground = job.get("ground")
    if not isinstance(ground, dict):
        errors.append("simulation job.ground: must be an object")
        return errors
    for key in sorted(GROUND_KEYS - ground.keys()):
        errors.append(f"simulation job.ground: missing required field {key!r}")
    for key in sorted(ground.keys() - GROUND_KEYS):
        errors.append(f"simulation job.ground: unknown field {key!r}")
    if not finite_number(ground.get("height_m")):
        errors.append("simulation job.ground.height_m: must be finite")
    if not finite_number(ground.get("half_extent_m")) or ground["half_extent_m"] <= 0:
        errors.append("simulation job.ground.half_extent_m: must be positive")
    if not finite_number(ground.get("friction")) or ground["friction"] < 0:
        errors.append("simulation job.ground.friction: must be non-negative")
    restitution = ground.get("restitution")
    if not finite_number(restitution) or not 0 <= restitution <= 1:
        errors.append("simulation job.ground.restitution: must be from zero through one")
    return errors


def three_dimensions(asset: dict[str, Any]) -> list[float]:
    bbox = asset.get("bbox")
    if (
        not isinstance(bbox, list)
        or len(bbox) != 3
        or not all(finite_number(value) and value > 0 for value in bbox)
    ):
        raise ValueError(f"manifest asset {asset.get('id')!r} needs a positive three-axis bbox")
    if asset.get("up_axis") == "Z":
        return [bbox[0], bbox[2], bbox[1]]
    return bbox


def integral_ratio(numerator: float, denominator: float, label: str) -> int:
    ratio = numerator / denominator
    rounded = round(ratio)
    if rounded < 1 or not math.isclose(ratio, rounded, rel_tol=0, abs_tol=1e-8):
        raise ValueError(f"{label} must be an integer ratio; got {ratio:.12g}")
    return rounded


def compile_runner_input(
    scene: dict[str, Any],
    simulation_job: dict[str, Any],
    render_job: dict[str, Any],
    manifest: dict[str, Any],
) -> str:
    errors = [
        *validate_scene(scene),
        *validate_simulation_job(simulation_job),
        *validate_render_job(render_job),
    ]
    if errors:
        raise ValueError("\n".join(errors))
    known_assets = manifest_asset_ids(manifest)
    assets = {asset["id"]: asset for asset in manifest["assets"]}
    poses = resolve_world_poses(scene["entities"])

    step = simulation_job["fixed_step_s"]
    total_steps = integral_ratio(render_job["duration_s"], step, "duration/fixed step")
    sample_every = integral_ratio(1 / render_job["fps"], step, "sample interval/fixed step")

    bodies = []
    for entity in scene["entities"]:
        physics = entity.get("physics")
        if physics is None:
            continue
        if physics["body_type"] == "kinematic":
            raise ValueError(
                f"{entity['id']}: kinematic bodies are a declared native Box3D surface "
                "but the first-pass runner only emits static or dynamic bodies"
            )
        asset_id = entity["asset"]["asset_id"]
        if asset_id not in known_assets:
            raise ValueError(f"scene asset {asset_id!r} is missing from manifest")
        if physics["collider"] != f"{asset_id}.default":
            raise ValueError(
                f"{entity['id']}: first-pass runner only supports {asset_id}.default bbox colliders"
            )
        dimensions = three_dimensions(assets[asset_id])
        scale_xyz = entity["pose"].get("scale_xyz", [1.0, 1.0, 1.0])
        half = [value * scale_xyz[index] / 2 for index, value in enumerate(dimensions)]
        position, orientation = poses[entity["id"]]
        motion = entity["motion"]
        motion_locks = physics.get("motion_locks", {})
        bodies.append(
            [
                entity["id"],
                BODY_TYPE_CODES[physics["body_type"]],
                *half,
                *position,
                *orientation,
                *motion["linear_velocity_m_s"],
                *motion["angular_velocity_rad_s"],
                physics["density_kg_m3"],
                physics.get("friction", 0.6),
                physics.get("restitution", 0),
                physics.get("linear_damping", 0.0),
                physics.get("angular_damping", 0.0),
                physics.get("gravity_scale", 1.0),
                physics.get("sleep_threshold_m_s", 0.05),
                int(physics.get("enable_sleep", True)),
                int(physics.get("is_awake", True)),
                int(physics.get("is_bullet", False)),
                int(physics.get("is_enabled", True)),
                int(physics.get("allow_fast_rotation", False)),
                int(physics.get("enable_contact_recycling", True)),
                *(int(motion_locks.get(key, False)) for key in MOTION_LOCK_KEYS),
            ]
        )
    if not bodies:
        raise ValueError("scene contains no physics bodies")

    gravity = simulation_job["gravity_m_s2"]
    ground = simulation_job["ground"]
    world = [
        "world",
        *gravity,
        step,
        simulation_job["substeps"],
        total_steps,
        sample_every,
        ground["height_m"],
        ground["half_extent_m"],
        ground["friction"],
        ground["restitution"],
        len(bodies),
        0,
        simulation_job.get("restitution_threshold_m_s", 1.0),
        simulation_job.get("hit_event_threshold_m_s", 1.0),
        simulation_job.get("contact_hertz", 30.0),
        simulation_job.get("contact_damping_ratio", 10.0),
        simulation_job.get("contact_speed_m_s", 3.0),
        simulation_job.get("maximum_linear_speed_m_s", 400.0),
        int(simulation_job.get("enable_sleep", True)),
        int(simulation_job.get("enable_continuous", True)),
    ]
    lines = ["B3SCENE 5", " ".join(map(str, world))]
    lines.extend(" ".join(map(str, ["body", *body])) for body in bodies)
    return "\n".join(lines) + "\n"


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene", type=Path)
    parser.add_argument("simulation_job", type=Path)
    parser.add_argument("render_job", type=Path)
    parser.add_argument("--manifest", type=Path, default=root / "assets/manifest.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        text = compile_runner_input(
            load_json(args.scene),
            load_json(args.simulation_job),
            load_json(args.render_job),
            load_json(args.manifest),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(exc)
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, encoding="utf-8")
    print(f"compiled Box3D input: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
