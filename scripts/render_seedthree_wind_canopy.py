#!/usr/bin/env python3
"""Drive the real SeedThree canopy and an interpolated groom from Box3D wind guides."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import render_motion as studio  # noqa: E402
from render_layout import MANIFEST_PATH, append_collection, look_at, reset_scene  # noqa: E402
from wind_canopy_math import (  # noqa: E402
    blend_polylines,
    nearest_weights,
    resample_polyline,
    weighted_displacement,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("motion", type=Path)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--asset-id", default="seedthree_white_oak_1737")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--duration", type=float, default=4.0)
    parser.add_argument("--fibers-per-gap", type=int, default=11)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def to_blender(values: list[float]) -> Vector:
    return Vector((values[0], -values[2], values[1]))


def load_tree(manifest_path: Path, asset_id: str) -> tuple[object, object, object, list[object]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = {asset["id"]: asset for asset in manifest["assets"]}
    objects = append_collection(assets[asset_id])
    root = next((obj for obj in objects if obj.name == f"{asset_id}_root"), None)
    if root is None:
        raise RuntimeError(f"asset {asset_id} has no source root")
    motion_root = bpy.data.objects.new("SeedThree wind motion root", None)
    bpy.context.scene.collection.objects.link(motion_root)
    root.parent = motion_root
    root.matrix_parent_inverse = Matrix.Identity(4)
    bpy.context.view_layer.update()
    meshes = [obj for obj in objects if obj.type == "MESH"]
    branch = max(meshes, key=lambda obj: len(obj.data.vertices))
    leaves = [obj for obj in meshes if obj != branch]
    return motion_root, root, branch, leaves


def bounds(points: list[Vector]) -> tuple[Vector, Vector]:
    return (
        Vector(tuple(min(point[axis] for point in points) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in points) for axis in range(3))),
    )


def normalized(point: Vector, low: Vector, high: Vector) -> tuple[float, float, float]:
    return tuple((point[axis] - low[axis]) / max(high[axis] - low[axis], 1e-6) for axis in range(3))


def setup_tree_state(root: object, branch: object, leaves: list[object], motion: dict) -> dict:
    root_inverse = root.matrix_world.inverted()
    branch_root_matrix = root_inverse @ branch.matrix_world
    branch_points = [
        root_inverse @ branch.matrix_world @ vertex.co.copy() for vertex in branch.data.vertices
    ]
    leaf_records = []
    for obj in leaves:
        local = root_inverse @ obj.matrix_world
        location, rotation, scale = local.decompose()
        leaf_records.append(
            {
                "object": obj,
                "location": location.copy(),
                "rotation": rotation.copy(),
                "scale": scale.copy(),
            }
        )
    asset_points = branch_points + [record["location"] for record in leaf_records]
    asset_low, asset_high = bounds(asset_points)

    first_nodes = motion["frames"][0]["nodes"]
    guide_nodes = [node for node in first_nodes if node["kind"] in {"trunk", "branch", "leaf"}]
    guide_ids = [node["id"] for node in guide_nodes]
    guide_rest = [to_blender(node["position_m"]) for node in guide_nodes]
    guide_low, guide_high = bounds(guide_rest)
    guide_normalized = [normalized(point, guide_low, guide_high) for point in guide_rest]
    branch_weights = [
        nearest_weights(normalized(point, asset_low, asset_high), guide_normalized, 4)
        for point in branch_points
    ]
    for record in leaf_records:
        record["weights"] = nearest_weights(
            normalized(record["location"], asset_low, asset_high), guide_normalized, 4
        )
    scale = 0.58 * (asset_high.z - asset_low.z) / max(guide_high.z - guide_low.z, 1e-6)
    return {
        "branch_root_matrix": branch_root_matrix,
        "branch_points": branch_points,
        "branch_weights": branch_weights,
        "leaf_records": leaf_records,
        "guide_ids": guide_ids,
        "guide_rest": guide_rest,
        "deformation_scale": scale,
        "asset_low": asset_low,
        "asset_high": asset_high,
    }


def apply_tree_frame(
    root: object, branch: object, state: dict, frame_data: dict, frame: int
) -> None:
    positions = {node["id"]: to_blender(node["position_m"]) for node in frame_data["nodes"]}
    displacements = [
        tuple((positions[node_id] - rest) * state["deformation_scale"])
        for node_id, rest in zip(state["guide_ids"], state["guide_rest"], strict=True)
    ]
    branch_inverse = state["branch_root_matrix"].inverted()
    z_low = state["asset_low"].z
    z_span = state["asset_high"].z - z_low
    for vertex, point, weights in zip(
        branch.data.vertices, state["branch_points"], state["branch_weights"], strict=True
    ):
        height = max(0.0, min(1.0, (point.z - z_low) / max(z_span, 1e-6)))
        displacement = Vector(weighted_displacement(weights, displacements)) * height**1.15
        vertex.co = branch_inverse @ (point + displacement)
    branch.data.update()

    for record in state["leaf_records"]:
        location = record["location"]
        height = max(0.0, min(1.0, (location.z - z_low) / max(z_span, 1e-6)))
        displacement = (
            Vector(weighted_displacement(record["weights"], displacements)) * height**1.15
        )
        flutter = 0.045 * math.sin(frame * 0.31 + location.x * 2.1 + location.y * 1.7)
        rotation = Matrix.Rotation(flutter * height, 4, "Z").to_quaternion() @ record["rotation"]
        local = Matrix.Translation(location + displacement) @ rotation.to_matrix().to_4x4()
        local = local @ Matrix.Diagonal(
            (record["scale"].x, record["scale"].y, record["scale"].z, 1.0)
        )
        record["object"].matrix_world = root.matrix_world @ local


def hair_paths(motion: dict) -> list[list[int]]:
    first = {node["id"]: node for node in motion["frames"][0]["nodes"]}
    adjacency: dict[int, list[int]] = {}
    for edge in motion["edges"]:
        if edge["kind"] != "hair":
            continue
        adjacency.setdefault(edge["a"], []).append(edge["b"])
        adjacency.setdefault(edge["b"], []).append(edge["a"])
    roots = sorted(
        (node_id for node_id, node in first.items() if node["kind"] == "hair_root"),
        key=lambda node_id: first[node_id]["position_m"][2],
    )
    paths = []
    for root in roots:
        path = [root]
        previous = None
        current = root
        while True:
            options = [node for node in adjacency.get(current, []) if node != previous]
            if not options:
                break
            next_node = options[0]
            path.append(next_node)
            previous, current = current, next_node
        paths.append(path)
    return paths


def make_groom(motion: dict, fibers_per_gap: int) -> dict:
    paths = hair_paths(motion)
    fiber_count = (len(paths) - 1) * fibers_per_gap + 1
    copper = studio.make_material("Copper groom", (0.85, 0.12, 0.018, 1), 0.15, 0.3)
    gold = studio.make_material("Gold groom", (1.0, 0.42, 0.025, 1), 0.1, 0.28)
    curves = []
    for index in range(fiber_count):
        data = bpy.data.curves.new(f"Wind groom curve {index:03d}", type="CURVE")
        data.dimensions = "3D"
        data.resolution_u = 1
        data.bevel_depth = 0.018
        data.bevel_resolution = 2
        spline = data.splines.new("POLY")
        spline.points.add(11)
        obj = bpy.data.objects.new(f"Wind groom fiber {index:03d}", data)
        bpy.context.scene.collection.objects.link(obj)
        data.materials.append(gold if index % 3 else copper)
        curves.append((obj, spline))

    target = Vector((7.6, 0.0, 12.2))
    root_positions = [
        to_blender(
            next(node for node in motion["frames"][0]["nodes"] if node["id"] == path[0])[
                "position_m"
            ]
        )
        for path in paths
    ]
    root_center = sum(root_positions, Vector()) / len(root_positions)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32, ring_count=16, location=target + Vector((0, 0, 0.24))
    )
    scalp = bpy.context.object
    scalp.name = "Wind groom cap"
    scalp.scale = (0.72, 2.05, 0.38)
    scalp.data.materials.append(
        studio.make_material("Groom cap", (0.18, 0.008, 0.06, 1), 0.08, 0.42)
    )
    return {
        "paths": paths,
        "curves": curves,
        "target": target,
        "root_center": root_center,
        "scale": 1.32,
        "fibers_per_gap": fibers_per_gap,
    }


def apply_groom_frame(groom: dict, frame_data: dict) -> None:
    positions = {node["id"]: tuple(to_blender(node["position_m"])) for node in frame_data["nodes"]}
    guides = [resample_polyline([positions[node] for node in path], 12) for path in groom["paths"]]
    fibers = []
    for left, right in zip(guides, guides[1:], strict=False):
        for index in range(groom["fibers_per_gap"]):
            fibers.append(blend_polylines(left, right, index / groom["fibers_per_gap"]))
    fibers.append(guides[-1])
    for fiber_index, (points, (_, spline)) in enumerate(zip(fibers, groom["curves"], strict=True)):
        for point_index, (point, spline_point) in enumerate(
            zip(points, spline.points, strict=True)
        ):
            u = point_index / (len(points) - 1)
            position = (Vector(point) - groom["root_center"]) * groom["scale"] + groom["target"]
            position.x += 0.025 * math.sin(fiber_index * 1.73 + u * 7.0) * u
            position.y += 0.018 * math.cos(fiber_index * 2.11 + u * 5.0) * u
            spline_point.co = (*position, 1.0)


def add_stage() -> None:
    bpy.ops.mesh.primitive_plane_add(size=54, location=(0, 0, 0))
    ground = bpy.context.object
    ground.data.materials.append(
        studio.make_material("Wind meadow", (0.018, 0.09, 0.035, 1), 0, 0.82)
    )
    world = bpy.context.scene.world or bpy.data.worlds.new("SeedThree Wind World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.016, 0.04, 1)
    background.inputs["Strength"].default_value = 0.42
    studio.add_area_light("Canopy key", (8, -12, 20), 2100, 10, (1.0, 0.67, 0.42))
    studio.add_area_light("Canopy fill", (-12, -2, 14), 1700, 12, (0.28, 0.55, 1.0))
    studio.add_area_light("Groom rim", (10, 8, 16), 1500, 7, (1.0, 0.2, 0.44))
    data = bpy.data.cameras.new("SeedThree wind camera")
    camera = bpy.data.objects.new("SeedThree wind camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (23.5, -31.0, 15.5)
    look_at(camera, Vector((2.6, 0.0, 8.3)), Vector((0.0, 0.0, 1.0)))
    data.lens = 47
    data.dof.use_dof = True
    data.dof.focus_distance = 31
    data.dof.aperture_fstop = 7.0
    bpy.context.scene.camera = camera


def configure_scene(args: argparse.Namespace, frame_count: int) -> Path:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.fps = args.fps
    scene.frame_start = 1
    scene.frame_end = frame_count
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.look = "AgX - Medium High Contrast"
    frame_dir = args.output.with_name(f"{args.output.stem}_frames")
    frame_dir.mkdir(parents=True, exist_ok=True)
    return frame_dir


def main() -> None:
    args = parse_args()
    motion = json.loads(args.motion.read_text(encoding="utf-8"))
    reset_scene()
    motion_root, root, branch, leaves = load_tree(args.manifest, args.asset_id)
    tree_state = setup_tree_state(root, branch, leaves, motion)
    motion_root.location.z = -(root.matrix_world.translation.z + tree_state["asset_low"].z)
    bpy.context.view_layer.update()
    groom = make_groom(motion, args.fibers_per_gap)
    add_stage()
    frame_count = round(args.duration * args.fps) + 1
    frame_dir = configure_scene(args, frame_count)

    for index in range(frame_count):
        time_s = index / args.fps
        source_index = min(round(time_s / motion["sample_interval_s"]), len(motion["frames"]) - 1)
        frame_data = motion["frames"][source_index]
        apply_tree_frame(root, branch, tree_state, frame_data, index)
        apply_groom_frame(groom, frame_data)
        bpy.context.scene.frame_set(index + 1)
        bpy.context.scene.render.filepath = str(frame_dir / f"frame_{index + 1:04d}.png")
        bpy.ops.render.render(write_still=True)

    receipt = {
        "schema": "seedthree-wind-canopy-render/1",
        "created": datetime.now(UTC).isoformat(),
        "asset_id": args.asset_id,
        "source_manifest": str(args.manifest.resolve()),
        "guide_motion": str(args.motion.resolve()),
        "guide_motion_sha256": hashlib.sha256(args.motion.read_bytes()).hexdigest(),
        "output": str(args.output.resolve()),
        "frames_directory": str(frame_dir.resolve()),
        "frames": frame_count,
        "fps": args.fps,
        "duration_s": args.duration,
        "tree_guide_count": len(tree_state["guide_ids"]),
        "branch_vertex_count": len(tree_state["branch_points"]),
        "foliage_object_count": len(leaves),
        "physical_hair_guides": len(groom["paths"]),
        "render_hairs": len(groom["curves"]),
        "model": "Box3D sparse guides plus visual interpolation",
        "deformation_feedback_into_box3d": False,
        "fem": False,
        "cfd": False,
        "strand_self_contact": False,
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
