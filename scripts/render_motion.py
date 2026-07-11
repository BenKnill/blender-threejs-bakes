#!/usr/bin/env python3
"""Render a sampled motion clip with full-fidelity assets in a small Eevee studio."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy  # noqa: E402 -- Blender does not add --python's directory to sys.path

from btlib.texture_paths import default_texture_roots, index_texture_basenames  # noqa: E402
from compile_scene import resolve_world_poses  # noqa: E402 -- shared pure scene math
from render_layout import (  # noqa: E402 -- SCRIPT_DIR must be installed first
    MANIFEST_PATH,
    look_at,
    place_instance,
    reset_scene,
    setup_camera,
    three_matrix_to_blender,
    three_point_to_blender,
)
from scene_math import (  # noqa: E402 -- installed with SCRIPT_DIR
    add,
    multiply_quat,
    normalize_quat,
    rotate_vec,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("layout", type=Path)
    parser.add_argument("motion", type=Path)
    parser.add_argument("scene", type=Path)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--output", type=Path, required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def make_material(
    name: str, base_color: tuple[float, float, float, float], metallic: float, roughness: float
):
    material = bpy.data.materials.new(name)
    material.diffuse_color = base_color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    return material


def add_studio() -> None:
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, -0.2), scale=(8, 8, 0.2))
    platform = bpy.context.object
    platform.name = "Studio Platform"
    platform.data.materials.append(make_material("Slate", (0.055, 0.09, 0.14, 1), 0.1, 0.28))
    bevel = platform.modifiers.new("Soft platform edges", "BEVEL")
    bevel.width = 0.18
    bevel.segments = 4

    world = bpy.context.scene.world or bpy.data.worlds.new("Studio World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.008, 0.014, 0.026, 1)
    background.inputs["Strength"].default_value = 0.45

    add_area_light("Warm Key", (5, -5, 10), 1800, 5.5, (1.0, 0.72, 0.5))
    add_area_light("Cool Fill", (-6, -1, 5), 1100, 4.0, (0.28, 0.5, 1.0))
    add_area_light("Amber Rim", (2, 5, 8), 1400, 3.0, (1.0, 0.32, 0.12))


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    direction = -light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def style_instance(instance_id: str, index: int) -> None:
    colors = [
        (0.42, 0.12, 0.025, 1),
        (0.22, 0.32, 0.5, 1),
        (0.5, 0.24, 0.035, 1),
    ]
    material = make_material(f"Crate Studio {index + 1}", colors[index % len(colors)], 0.08, 0.34)
    root = bpy.data.objects[instance_id]
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(material)


def keyframe_motion(layout: dict, motion: dict) -> None:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    instance_scales = {
        instance["instance_id"]: instance.get("scale", [1, 1, 1])
        for instance in layout["instances"]
    }
    for frame in motion["frames"]:
        blender_frame = frame["index"] + 1
        for entity_id, state in frame["entities"].items():
            obj = bpy.data.objects.get(entity_id)
            if obj is None:
                raise ValueError(f"motion entity has no placed instance: {entity_id}")
            matrix = three_matrix_to_blender(
                {
                    "position": state["position_m"],
                    "quaternion": state["orientation_xyzw"],
                    "scale": instance_scales[entity_id],
                }
            )
            location, rotation, scale = matrix.decompose()
            obj.location = location
            obj.rotation_mode = "QUATERNION"
            obj.rotation_quaternion = rotation
            obj.scale = scale
            obj.keyframe_insert("location", frame=blender_frame)
            obj.keyframe_insert("rotation_quaternion", frame=blender_frame)


def configure_camera(scene_description: dict, layout: dict) -> None:
    setup_camera(layout)
    camera_entity = next(
        entity
        for entity in scene_description["entities"]
        if entity["id"] == "hero_camera" and entity["kind"] == "camera"
    )
    optics = camera_entity["camera"]
    camera = bpy.context.scene.camera
    camera.data.dof.use_dof = True
    camera.data.dof.focus_distance = optics.get("focus_distance_m", 10)
    camera.data.dof.aperture_fstop = optics.get("aperture_fstop", 4)
    bpy.context.scene.view_settings.exposure = optics.get("exposure_stops", 0) + 0.65


def keyframe_camera(scene_description: dict, motion: dict) -> None:
    entity = next(
        item
        for item in scene_description["entities"]
        if item["id"] == "hero_camera" and item["kind"] == "camera"
    )
    camera = bpy.context.scene.camera
    world_poses = resolve_world_poses(scene_description["entities"])
    initial_position, initial_orientation = world_poses[entity["id"]]
    linear_velocity = entity["motion"]["linear_velocity_m_s"]
    angular_velocity = entity["motion"]["angular_velocity_rad_s"]
    angular_speed = math.sqrt(sum(value * value for value in angular_velocity))

    for frame in motion["frames"]:
        time = frame["time_s"]
        position = [initial_position[axis] + linear_velocity[axis] * time for axis in range(3)]
        orientation = initial_orientation
        if angular_speed > 0:
            half_angle = 0.5 * angular_speed * time
            factor = math.sin(half_angle) / angular_speed
            delta = (
                angular_velocity[0] * factor,
                angular_velocity[1] * factor,
                angular_velocity[2] * factor,
                math.cos(half_angle),
            )
            orientation = normalize_quat(multiply_quat(delta, initial_orientation))
        forward = rotate_vec(orientation, (0, 0, -1))
        up = rotate_vec(orientation, (0, 1, 0))
        camera.location = three_point_to_blender(position)
        look_at(
            camera,
            three_point_to_blender(add(tuple(position), forward)),
            three_point_to_blender(up),
        )
        camera.rotation_mode = "QUATERNION"
        blender_frame = frame["index"] + 1
        camera.keyframe_insert("location", frame=blender_frame)
        camera.keyframe_insert("rotation_quaternion", frame=blender_frame)


def frames_directory(output: Path) -> Path:
    return output.with_name(f"{output.stem}_frames")


def configure_output(layout: dict, motion: dict, output: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = layout["render"]["width"]
    scene.render.resolution_y = layout["render"]["height"]
    scene.render.resolution_percentage = 100
    scene.render.fps = round(1 / motion["sample_interval_s"])
    scene.frame_start = 1
    scene.frame_end = len(motion["frames"])
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    frame_dir = frames_directory(output)
    frame_dir.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(frame_dir / "frame_")
    with suppress(TypeError):
        scene.view_settings.look = "AgX - Medium High Contrast"


def write_receipt(args: argparse.Namespace, layout: dict, motion: dict) -> None:
    receipt = {
        "schema": "motion-render-receipt/1",
        "created": datetime.now(UTC).isoformat(),
        "layout": str(args.layout.resolve()),
        "motion": str(args.motion.resolve()),
        "scene": str(args.scene.resolve()),
        "output": str(args.output.resolve()),
        "frames_directory": str(frames_directory(args.output).resolve()),
        "engine": "BLENDER_EEVEE",
        "frames": len(motion["frames"]),
        "fps": round(1 / motion["sample_interval_s"]),
        "assets": sorted({item["asset_id"] for item in layout["instances"]}),
        "motion_sha256": hashlib.sha256(args.motion.read_bytes()).hexdigest(),
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    args = parse_args()
    layout = load_json(args.layout)
    motion = load_json(args.motion)
    scene_description = load_json(args.scene)
    manifest = load_json(args.manifest)
    assets = {asset["id"]: asset for asset in manifest["assets"]}
    texture_index = index_texture_basenames(default_texture_roots(MANIFEST_PATH.parents[1]))

    reset_scene()
    for index, instance in enumerate(layout["instances"]):
        place_instance(instance, assets[instance["asset_id"]], texture_index)
        style_instance(instance["instance_id"], index)
    add_studio()
    configure_camera(scene_description, layout)
    keyframe_motion(layout, motion)
    keyframe_camera(scene_description, motion)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_output(layout, motion, args.output)
    bpy.ops.render.render(animation=True)
    write_receipt(args, layout, motion)
    print(
        json.dumps(
            {"output": str(args.output), "frames": len(motion["frames"]), "status": "rendered"}
        )
    )


if __name__ == "__main__":
    main()
