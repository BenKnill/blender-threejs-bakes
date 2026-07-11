#!/usr/bin/env python3
"""Render the sampled Box3D soft ribbon as a neon spring lattice in Eevee."""

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
    result = studio.make_material(name, color, 0.08, 0.3)
    principled = result.node_tree.nodes.get("Principled BSDF")
    if emission:
        principled.inputs["Emission Color"].default_value = color
        principled.inputs["Emission Strength"].default_value = emission
    return result


def add_stage() -> None:
    bpy.ops.mesh.primitive_plane_add(size=28, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "Soft ribbon floor"
    floor.data.materials.append(material("Midnight floor", (0.018, 0.028, 0.065, 1)))

    world = bpy.context.scene.world or bpy.data.worlds.new("Soft Ribbon World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.007, 0.025, 1)
    background.inputs["Strength"].default_value = 0.3
    studio.add_area_light("Ribbon key", (2, -7, 11), 1350, 7, (0.25, 0.6, 1.0))
    studio.add_area_light("Ribbon rim", (-5, 4, 8), 1100, 5, (1.0, 0.2, 0.55))
    studio.add_area_light("Ribbon floor glow", (4, 2, 3), 700, 4, (1.0, 0.45, 0.12))

    data = bpy.data.cameras.new("Soft ribbon camera")
    camera = bpy.data.objects.new("Soft ribbon camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (12.8, -14.5, 8.2)
    look_at(camera, Vector((0.0, 0.0, 2.8)), Vector((0.0, 0.0, 1.0)))
    data.lens = 48
    data.dof.use_dof = True
    data.dof.focus_distance = 18
    data.dof.aperture_fstop = 7.0
    bpy.context.scene.camera = camera


def keyframe_segment(obj, a: Vector, b: Vector, frame: int, radius: float) -> None:
    delta = b - a
    length = delta.length
    obj.location = (a + b) * 0.5
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    obj.scale = (radius, radius, length)
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_quaternion", frame=frame)
    obj.keyframe_insert("scale", frame=frame)


def build_lattice(motion: dict) -> None:
    colors = {
        "warp": material("Electric cyan", (0.04, 0.62, 1.0, 1), 1.5),
        "weft": material("Hot amber", (1.0, 0.28, 0.04, 1), 1.2),
        "shear": material("Blue shear", (0.12, 0.2, 0.65, 1), 0.35),
        "bend": material("Violet bend", (0.42, 0.08, 0.72, 1), 0.25),
    }
    free_material = material("Pearl nodes", (0.82, 0.92, 1.0, 1), 0.55)
    pin_material = material("Pinned coral", (1.0, 0.04, 0.18, 1), 1.3)

    node_objects = []
    first_nodes = motion["frames"][0]["nodes"]
    for node in first_nodes:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.12)
        obj = bpy.context.object
        obj.name = f"Ribbon node {node['id']:02d}"
        obj.data.materials.append(pin_material if node["pinned"] else free_material)
        node_objects.append(obj)

    edge_objects = []
    for index, edge in enumerate(motion["edges"]):
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1, depth=1)
        obj = bpy.context.object
        obj.name = f"Ribbon {edge['kind']} {index:03d}"
        obj.data.materials.append(colors[edge["kind"]])
        edge_objects.append(obj)

    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    for sample in motion["frames"]:
        frame = sample["index"] + 1
        positions = {node["id"]: to_blender(node["position_m"]) for node in sample["nodes"]}
        for node, obj in zip(sample["nodes"], node_objects, strict=True):
            obj.location = positions[node["id"]]
            obj.keyframe_insert("location", frame=frame)
        for edge, obj in zip(motion["edges"], edge_objects, strict=True):
            radius = 0.026 if edge["kind"] in {"warp", "weft"} else 0.011
            keyframe_segment(obj, positions[edge["a"]], positions[edge["b"]], frame, radius)


def configure_output(motion: dict, output: Path) -> Path:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = len(motion["frames"])
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
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
    build_lattice(motion)
    frame_dir = configure_output(motion, args.output)
    bpy.ops.render.render(animation=True)
    receipt = {
        "schema": "soft-ribbon-render-receipt/1",
        "created": datetime.now(UTC).isoformat(),
        "engine": "BLENDER_EEVEE",
        "motion": str(args.motion.resolve()),
        "motion_sha256": hashlib.sha256(args.motion.read_bytes()).hexdigest(),
        "frames": len(motion["frames"]),
        "frames_directory": str(frame_dir.resolve()),
        "output": str(args.output.resolve()),
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
