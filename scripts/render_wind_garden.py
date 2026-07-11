#!/usr/bin/env python3
"""Render the recorded Box3D wind garden as a stylized tree and fiber study."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import render_motion as studio  # noqa: E402
from render_layout import look_at, reset_scene  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("motion", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def to_blender(position: list[float]) -> Vector:
    return Vector((position[0], -position[2], position[1]))


def material(name: str, color: tuple[float, float, float, float], emission: float = 0.0):
    result = studio.make_material(name, color, 0.02, 0.48)
    principled = result.node_tree.nodes.get("Principled BSDF")
    if emission:
        principled.inputs["Emission Color"].default_value = color
        principled.inputs["Emission Strength"].default_value = emission
    return result


def add_stage() -> None:
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    ground = bpy.context.object
    ground.name = "Wind garden floor"
    ground.data.materials.append(material("Blue grass", (0.018, 0.075, 0.062, 1)))

    world = bpy.context.scene.world or bpy.data.worlds.new("Wind Garden World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.006, 0.018, 0.035, 1)
    background.inputs["Strength"].default_value = 0.34
    studio.add_area_light("Moon key", (2, -8, 13), 1500, 8, (0.35, 0.62, 1.0))
    studio.add_area_light("Leaf rim", (-7, 3, 9), 1200, 6, (0.18, 1.0, 0.48))
    studio.add_area_light("Fiber glow", (7, 1, 10), 1250, 5, (1.0, 0.38, 0.08))

    data = bpy.data.cameras.new("Wind garden camera")
    camera = bpy.data.objects.new("Wind garden camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (13.5, -18.5, 9.5)
    look_at(camera, Vector((0.2, 0.0, 3.3)), Vector((0.0, 0.0, 1.0)))
    data.lens = 51
    data.dof.use_dof = True
    data.dof.focus_distance = 21
    data.dof.aperture_fstop = 7.5
    bpy.context.scene.camera = camera


def keyframe_segment(obj, a: Vector, b: Vector, frame: int, radius: float) -> None:
    delta = b - a
    obj.location = (a + b) * 0.5
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.scale = (radius, radius, delta.length)
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_quaternion", frame=frame)
    obj.keyframe_insert("scale", frame=frame)


def build_garden(motion: dict) -> None:
    node_materials = {
        "trunk": material("Warm bark", (0.30, 0.105, 0.025, 1)),
        "branch": material("Young branch", (0.21, 0.36, 0.075, 1)),
        "leaf": material("Emerald tips", (0.02, 0.72, 0.27, 1), 0.65),
        "hair_root": material("Fiber roots", (1.0, 0.03, 0.22, 1), 0.9),
        "hair": material("Golden fibers", (1.0, 0.36, 0.015, 1), 0.45),
    }
    edge_materials = {
        "trunk": node_materials["trunk"],
        "branch": node_materials["branch"],
        "hair": node_materials["hair"],
    }
    visible_edges = [edge for edge in motion["edges"] if "bend" not in edge["kind"]]
    first_nodes = motion["frames"][0]["nodes"]
    node_objects = []
    for node in first_nodes:
        radius = node["radius_m"] * (1.35 if node["kind"] == "leaf" else 0.85)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius)
        obj = bpy.context.object
        obj.name = f"Garden {node['kind']} {node['id']:03d}"
        obj.data.materials.append(node_materials[node["kind"]])
        node_objects.append(obj)

    edge_objects = []
    for index, edge in enumerate(visible_edges):
        bpy.ops.mesh.primitive_cylinder_add(vertices=7, radius=1, depth=1)
        obj = bpy.context.object
        obj.name = f"Garden {edge['kind']} {index:03d}"
        obj.data.materials.append(edge_materials[edge["kind"]])
        edge_objects.append(obj)

    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    for sample in motion["frames"]:
        frame = sample["index"] + 1
        positions = {node["id"]: to_blender(node["position_m"]) for node in sample["nodes"]}
        for node, obj in zip(sample["nodes"], node_objects, strict=True):
            obj.location = positions[node["id"]]
            obj.keyframe_insert("location", frame=frame)
        for edge, obj in zip(visible_edges, edge_objects, strict=True):
            radius = {"trunk": 0.075, "branch": 0.042, "hair": 0.018}[edge["kind"]]
            keyframe_segment(obj, positions[edge["a"]], positions[edge["b"]], frame, radius)


def configure_output(motion: dict, output: Path) -> Path:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 405
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = len(motion["frames"])
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.look = "AgX - Medium High Contrast"
    frame_dir = output.with_name(f"{output.stem}_frames")
    frame_dir.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(frame_dir / "frame_")
    return frame_dir


def main() -> None:
    args = parse_args()
    motion = json.loads(args.motion.read_text(encoding="utf-8"))
    reset_scene()
    add_stage()
    build_garden(motion)
    frame_dir = configure_output(motion, args.output)
    bpy.ops.render.render(animation=True)
    receipt = {
        "schema": "wind-garden-render-receipt/1",
        "created": datetime.now(UTC).isoformat(),
        "engine": "BLENDER_EEVEE",
        "motion": str(args.motion.resolve()),
        "motion_sha256": hashlib.sha256(args.motion.read_bytes()).hexdigest(),
        "frames": len(motion["frames"]),
        "frames_directory": str(frame_dir.resolve()),
        "output": str(args.output.resolve()),
        "hidden_constraint_edges": ["tree_bend", "hair_bend"],
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
