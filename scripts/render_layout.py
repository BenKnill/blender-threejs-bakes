#!/usr/bin/env python3
"""Render a Three.js layout JSON with full-fidelity Blender source assets."""

from __future__ import annotations

import argparse
import json
import math
import sys
import traceback
from datetime import UTC, datetime
from pathlib import Path

import bpy
import mathutils
from mathutils import Matrix, Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from btlib.validate import validate_layout  # noqa: E402 -- Blender --python omits script dir.
from lighting_model import (  # noqa: E402 -- Blender --python omits the script dir from sys.path.
    color_tuple,
    default_lighting,
    merge_lighting,
    sun_direction_three,
)

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "manifest.json"
RENDER_DIR = ROOT / "renders"

C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
C_INV = C.inverted()


def timestamp_prefix() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d_%H-%M-%S-%f")[:-3] + "Z"


def safe_name(value: str) -> str:
    return "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in value).strip(
        "_"
    )


def layout_output_name(layout: dict, layout_path: Path) -> str:
    raw_name = safe_name(layout.get("name") or "")
    if raw_name and raw_name not in {"first_composition", "composition"}:
        return raw_name
    asset_ids = [safe_name(item.get("asset_id", "")) for item in layout.get("instances", [])]
    asset_name = "_".join(dict.fromkeys(asset_id for asset_id in asset_ids if asset_id))
    return asset_name or safe_name(layout_path.stem.replace(".layout", "")) or "render"


def three_point_to_blender(values: list[float]) -> Vector:
    return Vector((values[0], -values[2], values[1]))


def three_direction_to_blender(values: list[float]) -> Vector:
    return (C.to_3x3() @ Vector(values)).normalized()


def three_matrix_to_blender(instance: dict) -> Matrix:
    position = Vector(instance["position"])
    quat = mathutils.Quaternion(
        (
            instance["quaternion"][3],
            instance["quaternion"][0],
            instance["quaternion"][1],
            instance["quaternion"][2],
        )
    )
    scale = Vector(instance["scale"])
    matrix_three = (
        Matrix.Translation(position)
        @ quat.to_matrix().to_4x4()
        @ Matrix.Diagonal((scale.x, scale.y, scale.z, 1))
    )
    return C @ matrix_three @ C_INV


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def append_collection(asset: dict):
    blend_path = Path(asset["source_blend"])
    if not blend_path.is_absolute():
        blend_path = ROOT / blend_path
    collection_name = asset["collection"]
    if not blend_path.exists():
        raise FileNotFoundError(f"Missing source blend for {asset['id']}: {blend_path}")

    with bpy.data.libraries.load(str(blend_path), link=False) as (data_from, data_to):
        if collection_name in data_from.collections:
            data_to.collections = [collection_name]
        elif data_from.collections:
            data_to.collections = [data_from.collections[0]]
        else:
            data_to.objects = list(data_from.objects)

    objects = []
    for collection in data_to.collections:
        if collection:
            bpy.context.scene.collection.children.link(collection)
            objects.extend(collection.all_objects)

    if data_to.objects:
        collection = bpy.data.collections.new(asset["id"])
        bpy.context.scene.collection.children.link(collection)
        for obj in data_to.objects:
            if obj:
                collection.objects.link(obj)
                objects.append(obj)

    return objects


def matrix_rows(matrix: Matrix) -> list[list[float]]:
    return [[round(value, 6) for value in row] for row in matrix]


def place_instance(instance: dict, asset: dict) -> dict:
    objects = append_collection(asset)
    empty = bpy.data.objects.new(instance["instance_id"], None)
    bpy.context.scene.collection.objects.link(empty)
    empty.matrix_world = three_matrix_to_blender(instance)

    root_objects = []
    for obj in objects:
        if obj.parent is None:
            obj.parent = empty
            obj.matrix_parent_inverse = Matrix.Identity(4)
            root_objects.append(obj)

    bpy.context.view_layer.update()

    return {
        "instance_id": instance["instance_id"],
        "asset_id": instance["asset_id"],
        "empty_matrix_world": matrix_rows(empty.matrix_world),
        "root_objects": [
            {
                "name": obj.name,
                "matrix_world": matrix_rows(obj.matrix_world),
            }
            for obj in root_objects
        ],
    }


def look_at(obj, target: Vector, up: Vector) -> None:
    forward = (target - obj.location).normalized()
    z_axis = -forward
    y_axis = up - up.project(z_axis)
    if y_axis.length < 1e-6:
        y_axis = Vector((0, 1, 0)) - Vector((0, 1, 0)).project(z_axis)
    if y_axis.length < 1e-6:
        y_axis = Vector((1, 0, 0)) - Vector((1, 0, 0)).project(z_axis)
    y_axis.normalize()
    x_axis = y_axis.cross(z_axis).normalized()
    y_axis = z_axis.cross(x_axis).normalized()
    obj.matrix_world = Matrix(
        (
            (x_axis.x, y_axis.x, z_axis.x, obj.location.x),
            (x_axis.y, y_axis.y, z_axis.y, obj.location.y),
            (x_axis.z, y_axis.z, z_axis.z, obj.location.z),
            (0, 0, 0, 1),
        )
    )


def setup_camera(layout: dict) -> None:
    camera_data = bpy.data.cameras.new("Render Camera")
    camera = bpy.data.objects.new("Render Camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = three_point_to_blender(layout["camera"]["position"])
    target = three_point_to_blender(layout["camera"]["target"])
    up = three_point_to_blender(layout["camera"].get("up", [0, 1, 0])).normalized()
    look_at(camera, target, up)
    camera_data.sensor_fit = "VERTICAL"
    camera_data.angle_y = math.radians(layout["camera"].get("fov_deg", 45))
    bpy.context.scene.camera = camera


def setup_lighting(layout: dict) -> dict:
    if not layout.get("lighting"):
        return setup_legacy_lighting()
    lighting = merge_lighting(layout)
    setup_world(lighting)
    lighting["sun_direction_blender"] = setup_sun(lighting)
    scene = bpy.context.scene
    scene.view_settings.exposure = float(lighting["exposure"])
    view_transforms = scene.view_settings.bl_rna.properties["view_transform"].enum_items.keys()
    if "AgX" in view_transforms:
        scene.view_settings.view_transform = "AgX"
    return lighting


def setup_legacy_lighting() -> dict:
    lighting = default_lighting()
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.035, 0.04, 0.045)

    light_data = bpy.data.lights.new("Soft Key", type="AREA")
    light_data.energy = 450
    light_data.size = 6
    light = bpy.data.objects.new("Soft Key", light_data)
    light.location = (3, -4, 6)
    bpy.context.scene.collection.objects.link(light)
    return lighting


def setup_sun(lighting: dict) -> list[float]:
    sun = lighting["sun"]
    light_data = bpy.data.lights.new("Layout Sun", type="SUN")
    light_data.energy = max(0.0, float(sun.get("strength", 4)))
    light_data.angle = math.radians(max(0.1, float(sun.get("angle_deg", 1.5))))
    light_data.color = color_tuple(sun.get("color", [1, 0.85, 0.65]))
    light = bpy.data.objects.new("Layout Sun", light_data)
    direction = three_direction_to_blender(sun_direction_three(sun))
    light.location = direction * 10
    bpy.context.scene.collection.objects.link(light)
    look_at(light, Vector((0, 0, 0)), Vector((0, 0, 1)))
    return [round(value, 6) for value in direction]


def setup_world(lighting: dict) -> None:
    world_config = lighting["world"]
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = color_tuple(world_config.get("color", [0.035, 0.04, 0.045]))
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new(type="ShaderNodeOutputWorld")
    background = nodes.new(type="ShaderNodeBackground")
    background.inputs["Strength"].default_value = max(0.0, float(world_config.get("strength", 1)))
    if world_config.get("type") == "sky":
        sky = nodes.new(type="ShaderNodeTexSky")
        configure_sky_texture(sky, lighting["sun"])
        links.new(sky.outputs["Color"], background.inputs["Color"])
    else:
        background.inputs["Color"].default_value = (*world.color, 1)
    links.new(background.outputs["Background"], output.inputs["Surface"])


def configure_sky_texture(sky, sun: dict) -> None:
    if hasattr(sky, "sky_type"):
        sky_types = sky.bl_rna.properties["sky_type"].enum_items.keys()
        if "NISHITA" in sky_types:
            sky.sky_type = "NISHITA"
        elif "MULTIPLE_SCATTERING" in sky_types:
            sky.sky_type = "MULTIPLE_SCATTERING"
    if hasattr(sky, "sun_elevation"):
        sky.sun_elevation = math.radians(float(sun.get("elevation_deg", 10)))
    if hasattr(sky, "sun_rotation"):
        sky.sun_rotation = math.radians(float(sun.get("azimuth_deg", 120)))
    if "Sun Elevation" in sky.inputs:
        sky.inputs["Sun Elevation"].default_value = math.radians(
            float(sun.get("elevation_deg", 10))
        )
    if "Sun Rotation" in sky.inputs:
        sky.inputs["Sun Rotation"].default_value = math.radians(float(sun.get("azimuth_deg", 120)))


def configure_render(layout: dict, out_path: Path) -> None:
    render = layout.get("render", {})
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = int(render.get("samples", 256))
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(render.get("width", 1920))
    scene.render.resolution_y = int(render.get("height", 1080))
    scene.render.filepath = str(out_path)


def render_layout(layout_path: Path, manifest_path: Path, render_dir: Path) -> dict:
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    validate_layout(layout)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = {asset["id"]: asset for asset in manifest["assets"]}

    reset_scene()
    placements = []
    for instance in layout.get("instances", []):
        placements.append(place_instance(instance, assets[instance["asset_id"]]))
    setup_camera(layout)
    lighting = setup_lighting(layout)

    render_dir.mkdir(exist_ok=True)
    name = layout_output_name(layout, layout_path)
    output_stem = f"{timestamp_prefix()}_{name}"
    out_path = render_dir / f"{output_stem}.png"
    configure_render(layout, out_path)
    bpy.ops.render.render(write_still=True)

    receipt = {
        "layout": str(layout_path),
        "manifest": str(manifest_path),
        "output": str(out_path),
        "timestamp": datetime.now(UTC).isoformat(),
        "samples": bpy.context.scene.cycles.samples,
        "assets": sorted({item["asset_id"] for item in layout.get("instances", [])}),
        "lighting": lighting,
        "placements": placements,
    }
    (render_dir / f"{output_stem}.receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n",
        encoding="utf-8",
    )
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("layout", type=Path)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--output-dir", type=Path, default=RENDER_DIR)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    render_layout(args.layout, args.manifest, args.output_dir)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
