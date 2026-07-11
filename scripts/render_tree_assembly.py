#!/usr/bin/env python3
"""Render a coarse articulated SeedThree tree driven by a Box3D motion clip.

The physics bodies are deliberately few and box-shaped.  The imported branch
mesh and leaf cards are attached to the nearest dynamic body by height band;
this is a visual bridge, not a branch-level FEM or fracture simulation.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import render_motion as studio  # noqa: E402
from render_layout import (  # noqa: E402
    MANIFEST_PATH,
    append_collection,
    look_at,
    reset_scene,
    three_matrix_to_blender,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assembly", type=Path)
    parser.add_argument("motion", type=Path)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--asset-id", default="seedthree_white_oak_1737")
    parser.add_argument("--output", type=Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def add_ground() -> None:
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Articulated tree ground"
    ground.data.materials.append(
        studio.make_material("Articulated meadow", (0.045, 0.12, 0.028, 1), 0.0, 0.94)
    )


def add_lighting() -> None:
    world = bpy.context.scene.world or bpy.data.worlds.new("Articulated Tree World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.035, 0.055, 1)
    background.inputs["Strength"].default_value = 0.5
    studio.add_area_light("Assembly warm key", (8, -11, 18), 2200, 9, (1.0, 0.72, 0.45))
    studio.add_area_light("Assembly cool fill", (-10, -4, 12), 1650, 11, (0.3, 0.52, 1.0))
    studio.add_area_light("Assembly rim", (5, 8, 15), 1450, 8, (1.0, 0.33, 0.14))


def add_camera() -> None:
    data = bpy.data.cameras.new("Articulated tree camera")
    camera = bpy.data.objects.new("Articulated tree camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (24.0, -32.0, 14.0)
    look_at(camera, Vector((0.0, 0.0, 7.2)), Vector((0.0, 0.0, 1.0)))
    data.lens = 48
    data.dof.use_dof = True
    data.dof.focus_distance = 28
    data.dof.aperture_fstop = 5.6
    bpy.context.scene.camera = camera


def matrix_for_body(body: dict) -> Matrix:
    return three_matrix_to_blender(
        {
            "position": body["position"],
            "quaternion": body.get("rotation", [0.0, 0.0, 0.0, 1.0]),
            "scale": [1.0, 1.0, 1.0],
        }
    )


def matrix_for_state(state: dict) -> Matrix:
    return three_matrix_to_blender(
        {
            "position": state["position_m"],
            "quaternion": state["orientation_xyzw"],
            "scale": [1.0, 1.0, 1.0],
        }
    )


def prepare_tree(manifest_path: Path, asset_id: str) -> dict:
    manifest = load_json(manifest_path)
    assets = {asset["id"]: asset for asset in manifest["assets"]}
    if asset_id not in assets:
        raise ValueError(f"manifest has no asset {asset_id}")
    objects = append_collection(assets[asset_id])
    root = next((obj for obj in objects if obj.name == f"{asset_id}_root"), None)
    if root is None:
        raise RuntimeError(f"asset {asset_id} has no source root")
    meshes = [obj for obj in objects if obj.type == "MESH"]
    branch = max(meshes, key=lambda obj: len(obj.data.vertices))
    leaves = [obj for obj in meshes if obj != branch]

    assembly_root = bpy.data.objects.new("Tree assembly root", None)
    bpy.context.scene.collection.objects.link(assembly_root)
    root.parent = assembly_root
    root.matrix_parent_inverse = Matrix.Identity(4)
    root.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()

    # The source blend stores the tree around an arbitrary root origin.  Move
    # the lowest trunk vertices to z=0 while preserving the source materials.
    root_inverse = root.matrix_world.inverted()
    branch_root_points = [
        root_inverse @ branch.matrix_world @ v.co.copy() for v in branch.data.vertices
    ]
    z_min = min(point.z for point in branch_root_points)
    base_points = [point for point in branch_root_points if point.z <= z_min + 1.0]
    pivot = Vector(
        (
            sum(point.x for point in base_points) / len(base_points),
            sum(point.y for point in base_points) / len(base_points),
            z_min,
        )
    )
    assembly_root.location = -pivot
    bpy.context.view_layer.update()

    branch_points = [branch.matrix_world @ v.co.copy() for v in branch.data.vertices]
    branch_inverse = branch.matrix_world.inverted()
    leaf_records = []
    for obj in leaves:
        rest_world = obj.matrix_world.copy()
        leaf_records.append(
            {"object": obj, "rest_world": rest_world, "center": rest_world.translation.copy()}
        )

    return {
        "assembly_root": assembly_root,
        "root": root,
        "branch": branch,
        "leaves": leaves,
        "branch_points": branch_points,
        "branch_inverse": branch_inverse,
        "leaf_records": leaf_records,
        "pivot": pivot,
        "z_min": z_min,
    }


def dynamic_body_indices(assembly: dict) -> list[int]:
    return [
        index
        for index, body in enumerate(assembly["bodies"])
        if body.get("body_type", "dynamic" if body.get("dynamic") else "static") == "dynamic"
    ]


def choose_body(point: Vector, bodies: list[dict], dynamic_indices: list[int]) -> int:
    """Attach a point to a vertical body band, falling back to nearest center."""
    height = point.z
    for index in dynamic_indices:
        body = bodies[index]
        center = float(body["position"][1])
        half_height = float(body["half"][1])
        if center - half_height <= height <= center + half_height:
            return index
    return min(dynamic_indices, key=lambda index: abs(float(bodies[index]["position"][1]) - height))


def build_attachment_data(tree: dict, assembly: dict) -> dict:
    bodies = assembly["bodies"]
    dynamic_indices = dynamic_body_indices(assembly)
    initial_matrices = {index: matrix_for_body(bodies[index]) for index in dynamic_indices}

    branch_attachments = []
    for point in tree["branch_points"]:
        body_index = choose_body(point, bodies, dynamic_indices)
        local = initial_matrices[body_index].inverted() @ point
        branch_attachments.append((body_index, local))

    leaf_attachments = []
    for record in tree["leaf_records"]:
        body_index = choose_body(record["center"], bodies, dynamic_indices)
        local = initial_matrices[body_index].inverted() @ record["rest_world"]
        leaf_attachments.append(
            {"object": record["object"], "body_index": body_index, "local": local}
        )
    return {
        "initial_matrices": initial_matrices,
        "branch_attachments": branch_attachments,
        "leaf_attachments": leaf_attachments,
        "dynamic_indices": dynamic_indices,
    }


def advance_modal_states(states: dict[int, dict[str, float]], frame_time: float, dt: float) -> None:
    """Advance a tiny two-axis visual mode for each physical body.

    This is intentionally local and one-way: it makes foliage breathe and
    lag behind the rigid body pose, but it is not fed back into Box3D.
    """
    for body_index, state in states.items():
        phase = frame_time * (1.45 + body_index * 0.08) + body_index * 0.73
        target_x = 0.045 * math.sin(phase) + 0.018 * math.sin(frame_time * 4.2 + body_index)
        target_y = 0.030 * math.cos(frame_time * 1.1 + body_index * 0.5)
        state["vx"] += ((target_x - state["x"]) * 10.0 - state["vx"] * 3.2) * dt
        state["vy"] += ((target_y - state["y"]) * 8.0 - state["vy"] * 2.8) * dt
        state["x"] += state["vx"] * dt
        state["y"] += state["vy"] * dt


def modal_rotation(point: Vector, body: dict, state: dict[str, float]) -> Matrix:
    """Return a height-weighted two-axis bend in a body's local frame."""
    half_height = max(float(body["half"][1]), 1e-6)
    weight = max(0.0, min(1.0, (point.z + half_height) / (2.0 * half_height)))
    weight = 0.25 + 0.75 * weight
    return Matrix.Rotation(state["x"] * weight, 4, "Y") @ Matrix.Rotation(
        state["y"] * weight, 4, "X"
    )


def apply_frame(
    tree: dict, attachments: dict, frame: dict, modal_states: dict[int, dict[str, float]]
) -> None:
    # Entity insertion order follows the compiler's body order, but use the
    # assembly ids to make the mapping explicit and robust to JSON formatting.
    current = {
        index: matrix_for_state(frame["entities"][body["id"]])
        for index, body in enumerate(tree["assembly"]["bodies"])
        if index in attachments["dynamic_indices"]
    }

    branch = tree["branch"]
    for vertex, (body_index, local) in zip(
        branch.data.vertices, attachments["branch_attachments"], strict=True
    ):
        rotation = modal_rotation(
            local, tree["assembly"]["bodies"][body_index], modal_states[body_index]
        )
        bent_local = rotation @ local
        vertex.co = tree["branch_inverse"] @ (current[body_index] @ bent_local)
    branch.data.update()

    for record in attachments["leaf_attachments"]:
        body_index = record["body_index"]
        bent_local = (
            modal_rotation(
                record["local"].translation,
                tree["assembly"]["bodies"][body_index],
                modal_states[body_index],
            )
            @ record["local"]
        )
        record["object"].matrix_world = current[body_index] @ bent_local


def configure_scene(output: Path, fps: int, frame_count: int) -> Path:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.frame_start = 1
    scene.frame_end = frame_count
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    frame_dir = output.with_name(f"{output.stem}_frames")
    frame_dir.mkdir(parents=True, exist_ok=True)
    with suppress(TypeError):
        scene.view_settings.look = "AgX - Medium High Contrast"
    return frame_dir


def render(args: argparse.Namespace) -> dict:
    assembly = load_json(args.assembly)
    motion = load_json(args.motion)
    if len(motion.get("frames", [])) == 0:
        raise ValueError("motion clip has no frames")
    if motion.get("space") != "threejs_yup":
        raise ValueError("articulated renderer expects a threejs_yup motion clip")

    reset_scene()
    tree = prepare_tree(args.manifest, args.asset_id)
    tree["assembly"] = assembly
    attachments = build_attachment_data(tree, assembly)
    add_ground()
    add_lighting()
    add_camera()
    fps = round(1.0 / float(motion["sample_interval_s"]))
    frame_dir = configure_scene(args.output, fps, len(motion["frames"]))
    modal_states = {
        index: {"x": 0.0, "y": 0.0, "vx": 0.0, "vy": 0.0}
        for index in attachments["dynamic_indices"]
    }

    for frame_index, frame in enumerate(motion["frames"], start=1):
        if frame_index > 1:
            advance_modal_states(modal_states, frame["time_s"], float(motion["sample_interval_s"]))
        bpy.context.scene.frame_set(frame_index)
        apply_frame(tree, attachments, frame, modal_states)
        bpy.context.scene.render.filepath = str(frame_dir / f"frame_{frame_index:04d}.png")
        bpy.ops.render.render(write_still=True)

    receipt = {
        "schema": "articulated-tree-motion-receipt/1",
        "created": datetime.now(UTC).isoformat(),
        "asset_id": args.asset_id,
        "source_manifest": str(args.manifest.resolve()),
        "assembly": str(args.assembly.resolve()),
        "motion": str(args.motion.resolve()),
        "output": str(args.output.resolve()),
        "frames_directory": str(frame_dir.resolve()),
        "frames": len(motion["frames"]),
        "fps": fps,
        "bodies": len(assembly["bodies"]),
        "joints": len(assembly.get("joints", [])),
        "dynamic_bodies": len(attachments["dynamic_indices"]),
        "visual_attachment": "nearest vertical body band; branch vertices and leaf cards follow rigid body transforms",
        "visual_modal_state": "per-body damped two-axis height-weighted bend; visual-only and not fed back into Box3D",
        "physics_boundary": "Box3D rigid boxes and revolute joints; not FEM/JGS2 and no deformation feedback",
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )
    return receipt


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    receipt = render(args)
    print(
        json.dumps({"output": receipt["output"], "frames": receipt["frames"], "status": "rendered"})
    )


if __name__ == "__main__":
    main()
