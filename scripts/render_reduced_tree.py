#!/usr/bin/env python3
"""Render a small reduced-coordinate wind and collapse model on a SeedThree tree.

This is deliberately not a JGS2 implementation.  It uses a few generalized
coordinates (two wind modes and one hinge angle) and a height-weighted basis to
deform the imported tree.  The result is a cheap, legible prototype for testing
the scene contract before investing in a tetrahedral elastodynamics backend.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import render_motion as studio  # noqa: E402
from render_layout import MANIFEST_PATH, append_collection, look_at, reset_scene  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--asset-id", default="seedthree_white_oak_1737")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--duration", type=float, default=4.0)
    parser.add_argument("--cut-time", type=float, default=1.65)
    parser.add_argument("--wind-strength", type=float, default=1.0)
    parser.add_argument("--fall-target-degrees", type=float, default=86.0)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def smoothstep(value: float) -> float:
    value = clamp(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


@dataclass
class ReducedState:
    """Three generalized coordinates and their velocities."""

    wind_x: float = 0.0
    wind_y: float = 0.0
    hinge_angle: float = 0.0
    wind_vx: float = 0.0
    wind_vy: float = 0.0
    hinge_velocity: float = 0.0


class ReducedTreeModes:
    """A stable toy modal integrator, not a full FEM solver.

    Wind is a pair of damped oscillators.  After the cut time the trunk loses
    its restoring spring and a seeded gravity-like hinge torque tips the tree.
    """

    def __init__(self, dt: float, cut_time: float, wind_strength: float, target_degrees: float):
        self.dt = dt
        self.cut_time = cut_time
        self.wind_strength = wind_strength
        self.target = math.radians(target_degrees)
        self.state = ReducedState()

    def advance(self, time_s: float) -> ReducedState:
        dt = self.dt
        s = self.state
        gust = 0.5 * math.sin(time_s * 1.7) + 0.25 * math.sin(time_s * 4.3 + 0.7)
        target_x = self.wind_strength * 0.34 * gust
        target_y = self.wind_strength * 0.18 * math.sin(time_s * 1.15 + 1.4)
        s.wind_vx += ((target_x - s.wind_x) * 10.0 - s.wind_vx * 3.8) * dt
        s.wind_vy += ((target_y - s.wind_y) * 9.0 - s.wind_vy * 3.4) * dt
        s.wind_x += s.wind_vx * dt
        s.wind_y += s.wind_vy * dt

        if time_s < self.cut_time:
            hinge_accel = -8.5 * s.hinge_angle - 3.0 * s.hinge_velocity
        else:
            # A small initial perturbation stands in for the cut / impact.  The
            # torque increases with the lever arm, then damping makes it settle.
            seed = math.radians(5.0)
            gravity_torque = 5.3 * math.sin(s.hinge_angle + seed)
            hinge_accel = gravity_torque - 0.75 * s.hinge_angle - 1.7 * s.hinge_velocity
        s.hinge_velocity += hinge_accel * dt
        s.hinge_angle += s.hinge_velocity * dt
        if s.hinge_angle > self.target:
            s.hinge_angle = self.target
            s.hinge_velocity = min(0.0, s.hinge_velocity)
        return s


def add_ground() -> None:
    bpy.ops.mesh.primitive_plane_add(size=52, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Reduced tree ground"
    ground.data.materials.append(
        studio.make_material("Reduced tree meadow", (0.045, 0.12, 0.028, 1), 0.0, 0.94)
    )


def add_lighting() -> None:
    world = bpy.context.scene.world or bpy.data.worlds.new("Reduced Tree World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.035, 0.055, 1)
    background.inputs["Strength"].default_value = 0.52
    studio.add_area_light("Reduced tree key", (7, -10, 17), 1900, 9, (1.0, 0.72, 0.45))
    studio.add_area_light("Reduced tree fill", (-9, -3, 11), 1450, 11, (0.3, 0.52, 1.0))
    studio.add_area_light("Reduced tree rim", (4, 7, 13), 1200, 7, (1.0, 0.33, 0.14))


def add_camera() -> None:
    data = bpy.data.cameras.new("Reduced tree camera")
    camera = bpy.data.objects.new("Reduced tree camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (22.0, -28.0, 13.0)
    look_at(camera, Vector((2.0, 0.0, 7.0)), Vector((0.0, 0.0, 1.0)))
    data.lens = 42
    data.dof.use_dof = True
    data.dof.focus_distance = 22
    data.dof.aperture_fstop = 5.6
    bpy.context.scene.camera = camera


def load_tree(manifest_path: Path, asset_id: str) -> tuple[object, object, object, list[object]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = {asset["id"]: asset for asset in manifest["assets"]}
    asset = assets[asset_id]
    objects = append_collection(asset)
    root = next((obj for obj in objects if obj.name == f"{asset_id}_root"), None)
    if root is None:
        raise RuntimeError(f"asset {asset_id} has no source root")
    motion_root = bpy.data.objects.new("Reduced tree motion root", None)
    bpy.context.scene.collection.objects.link(motion_root)
    root.parent = motion_root
    root.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()

    meshes = [obj for obj in objects if obj.type == "MESH"]
    branch = max(meshes, key=lambda obj: len(obj.data.vertices))
    leaves = [obj for obj in meshes if obj != branch]
    return motion_root, root, branch, leaves


def setup_rest_state(root: object, branch: object, leaves: list[object]) -> dict:
    root_inverse = root.matrix_world.inverted()
    branch_root_matrix = root_inverse @ branch.matrix_world
    branch_points = [
        root_inverse @ branch.matrix_world @ vertex.co.copy() for vertex in branch.data.vertices
    ]
    leaf_records = []
    for obj in leaves:
        local_matrix = root_inverse @ obj.matrix_world
        location, rotation, scale = local_matrix.decompose()
        leaf_records.append(
            {
                "object": obj,
                "location": location.copy(),
                "rotation": rotation.copy(),
                "scale": scale.copy(),
            }
        )

    all_points = branch_points + [record["location"] for record in leaf_records]
    z_min = min(point.z for point in branch_points)
    z_max = max(point.z for point in all_points)
    base_points = [point for point in branch_points if point.z <= z_min + 1.0]
    pivot = Vector(
        (
            sum(point.x for point in base_points) / len(base_points),
            sum(point.y for point in base_points) / len(base_points),
            z_min,
        )
    )
    return {
        "root_inverse": root_inverse,
        "branch_root_matrix": branch_root_matrix,
        "branch_points": branch_points,
        "leaf_records": leaf_records,
        "z_min": z_min,
        "z_span": max(1e-6, z_max - z_min),
        "pivot": pivot,
    }


def deform_point(
    point: Vector, state: ReducedState, rest: dict, phase: float = 0.0
) -> tuple[Vector, float]:
    pivot = rest["pivot"]
    height = clamp((point.z - rest["z_min"]) / rest["z_span"], 0.0, 1.0)
    weight = height**1.35
    relative = point - pivot
    fall_rotation = Matrix.Rotation(state.hinge_angle * weight, 4, "Y")
    result = pivot + (fall_rotation @ relative)
    gust = math.sin(phase + state.hinge_angle * 0.3)
    result.x += state.wind_x * weight + 0.06 * state.wind_x * gust * weight * weight
    result.y += state.wind_y * weight
    result.z += 0.025 * math.sin(phase * 1.7) * state.wind_x * weight
    # Cheap contact sanity: the base and the fallen canopy do not tunnel below
    # the floor. This is intentionally not a replacement for Box3D contact.
    result.z = max(result.z, pivot.z + 0.015)
    return result, height


def apply_state(root: object, branch: object, rest: dict, state: ReducedState, frame: int) -> None:
    branch_inverse = rest["branch_root_matrix"].inverted()
    for vertex, point in zip(branch.data.vertices, rest["branch_points"], strict=True):
        deformed, _ = deform_point(point, state, rest, point.x * 0.23 + point.y * 0.17)
        vertex.co = branch_inverse @ deformed
    branch.data.update()

    for record in rest["leaf_records"]:
        obj = record["object"]
        deformed, height = deform_point(
            record["location"],
            state,
            rest,
            record["location"].x * 0.23 + record["location"].y * 0.17,
        )
        flutter = 0.10 * math.sin(frame * 0.23 + record["location"].x * 4.0)
        wind_rotation = Matrix.Rotation(flutter * height, 4, "Z")
        fall_rotation = Matrix.Rotation(state.hinge_angle * height**1.35, 4, "Y")
        rotation = (fall_rotation @ wind_rotation).to_quaternion() @ record["rotation"]
        local = Matrix.Translation(deformed) @ rotation.to_matrix().to_4x4()
        local = local @ Matrix.Diagonal(
            (record["scale"].x, record["scale"].y, record["scale"].z, 1.0)
        )
        obj.matrix_world = root.matrix_world @ local


def render(args: argparse.Namespace) -> dict:
    reset_scene()
    motion_root, root, branch, leaves = load_tree(args.manifest, args.asset_id)
    rest = setup_rest_state(root, branch, leaves)
    # Move the source's centered root so its lowest branch vertex starts on the floor.
    motion_root.location.z = -(root.matrix_world.translation.z + rest["pivot"].z)
    bpy.context.view_layer.update()
    add_ground()
    add_lighting()
    add_camera()

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.fps = args.fps
    scene.frame_start = 1
    frames = round(args.duration * args.fps) + 1
    scene.frame_end = frames
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    with suppress_type_error():
        scene.view_settings.look = "AgX - Medium High Contrast"
    frame_dir = args.output.with_name(f"{args.output.stem}_frames")
    frame_dir.mkdir(parents=True, exist_ok=True)

    modes = ReducedTreeModes(
        1.0 / args.fps, args.cut_time, args.wind_strength, args.fall_target_degrees
    )
    for index in range(frames):
        time_s = index / args.fps
        state = modes.advance(time_s) if index else modes.state
        scene.frame_set(index + 1)
        apply_state(root, branch, rest, state, index)
        scene.render.filepath = str(frame_dir / f"frame_{index + 1:04d}.png")
        bpy.ops.render.render(write_still=True)

    receipt = {
        "schema": "reduced-tree-motion-receipt/1",
        "created": datetime.now(UTC).isoformat(),
        "asset_id": args.asset_id,
        "source_manifest": str(args.manifest.resolve()),
        "output": str(args.output.resolve()),
        "frames_directory": str(frame_dir.resolve()),
        "frames": frames,
        "fps": args.fps,
        "duration_s": args.duration,
        "model": "height-weighted reduced coordinates",
        "generalized_coordinates": ["wind_x_m", "wind_y_m", "hinge_angle_rad"],
        "cut_time_s": args.cut_time,
        "wind_strength": args.wind_strength,
        "fall_target_degrees": args.fall_target_degrees,
        "paper_inspiration": "broad reduced-coordinate inspiration from arXiv:2506.06494v1",
        "paper_method_implemented": False,
        "fem": False,
        "material_aware_local_subspaces": False,
        "cubature": False,
        "deformation_feedback_into_box3d": False,
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )
    return receipt


class suppress_type_error:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return exc_type is TypeError


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    receipt = render(args)
    print(
        json.dumps({"output": receipt["output"], "frames": receipt["frames"], "status": "rendered"})
    )


if __name__ == "__main__":
    main()
