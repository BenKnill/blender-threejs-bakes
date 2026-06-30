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

from asset_texture_report import inspect_current_file  # noqa: E402 -- Blender --python path setup.
from btlib.keyframes import layout_with_pose  # noqa: E402 -- Blender --python omits script dir.
from btlib.texture_paths import (  # noqa: E402 -- Blender --python path setup.
    default_texture_roots,
    index_texture_basenames,
)
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
EFFECT_TEXTURE_DIR = ROOT / "assets" / "effects"

EFFECT_RENDERERS = {
    "cuda_flame": {
        "source": EFFECT_TEXTURE_DIR / "cuda_flame",
        "pattern": "plume_card_*.png",
        "shader": "emission",
        "alpha_mode": "brightness",
        "alpha_low": 0.18,
        "alpha_high": 0.44,
        "rolls": (0, 32, -32, 70, -70),
        "radius_y": 0.34,
        "radius_z": 0.46,
        "radius_step": 0.03,
        "strength": 3.8,
        "strength_step": -0.25,
        "mode": "cuda plume cards with scene depth",
    },
    "cuda_blue_plume": {
        "source": EFFECT_TEXTURE_DIR / "cuda_blue_plume",
        "pattern": "blue_plume_card_*.png",
        "shader": "emission",
        "alpha_mode": "image",
        "rolls": (0, 35, -35, 72, -72),
        "radius_y": 0.27,
        "radius_z": 0.34,
        "radius_step": 0.02,
        "strength": 5.2,
        "strength_step": -0.2,
        "mode": "cuda blue plasma plume cards with scene depth",
    },
    "cuda_cloud_billow": {
        "source": EFFECT_TEXTURE_DIR / "cuda_cloud_billow",
        "pattern": "cloud_card_*.png",
        "shader": "emission",
        "alpha_mode": "image",
        "rolls": (0, 38, -38, 84),
        "radius_y": 0.52,
        "radius_z": 0.42,
        "radius_step": 0.035,
        "strength": 0.62,
        "strength_step": 0.0,
        "mode": "cuda billow cloud cards with scene depth",
    },
    "cuda_chromosphere_lace": {
        "source": EFFECT_TEXTURE_DIR / "cuda_chromosphere_lace",
        "pattern": "chromosphere_lace_*.png",
        "shader": "emission",
        "alpha_mode": "brightness",
        "alpha_low": 0.18,
        "alpha_high": 0.5,
        "rolls": (0, 90, 45, -45),
        "radius_y": 0.62,
        "radius_z": 0.62,
        "radius_step": 0.0,
        "strength": 2.8,
        "strength_step": -0.12,
        "mode": "cuda chromosphere lace field cards with scene depth",
    },
    "cuda_spark_shower": {
        "source": EFFECT_TEXTURE_DIR / "cuda_spark_shower",
        "pattern": "spark_card_*.png",
        "shader": "emission",
        "alpha_mode": "image",
        "rolls": (0, 24, -24),
        "radius_y": 0.36,
        "radius_z": 0.24,
        "radius_step": 0.04,
        "strength": 7.0,
        "strength_step": -0.8,
        "mode": "cuda z-aware spark shower cards",
    },
}

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
    asset_ids = [
        safe_name(item.get("asset_id") or item.get("effect_id", ""))
        for item in layout.get("instances", [])
    ]
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


def place_instance(instance: dict, asset: dict, texture_index: dict[str, list[Path]]) -> dict:
    before_images = set(bpy.data.images)
    objects = append_collection(asset)
    texture_report = inspect_current_file(
        texture_index,
        relink=True,
        images_to_check=set(bpy.data.images) - before_images,
    )
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
        "texture_warnings": {
            "missing_count": texture_report["missing_count"],
            "relinked_count": texture_report["relinked_count"],
            "missing": [
                {
                    "basename": item["basename"],
                    "path": item["path"],
                    "candidate_count": item.get("candidate_count", 0),
                }
                for item in texture_report["missing"]
            ],
        },
    }


def make_effect_mat(name: str, image_path: Path | None, spec: dict, strength: float):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    mat.show_transparent_back = True
    if hasattr(mat, "use_screen_refraction"):
        mat.use_screen_refraction = False

    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    if spec["shader"] == "diffuse":
        visible = nodes.new("ShaderNodeBsdfDiffuse")
    else:
        visible = nodes.new("ShaderNodeEmission")
        visible.inputs["Strength"].default_value = strength
    mix = nodes.new("ShaderNodeMixShader")

    if image_path:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(image_path), check_existing=True)
        tex.extension = "CLIP"
        if spec["alpha_mode"] == "image":
            links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
        else:
            rgb_to_bw = nodes.new("ShaderNodeRGBToBW")
            ramp = nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].position = spec.get("alpha_low", 0.2)
            ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 0.0)
            ramp.color_ramp.elements[1].position = spec.get("alpha_high", 0.44)
            ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
            links.new(tex.outputs["Color"], rgb_to_bw.inputs["Color"])
            links.new(rgb_to_bw.outputs["Val"], ramp.inputs["Fac"])
            links.new(ramp.outputs["Color"], mix.inputs["Fac"])
        links.new(tex.outputs["Color"], visible.inputs["Color"])
    else:
        visible.inputs["Color"].default_value = (1.0, 0.45, 0.12, 1.0)
        mix.inputs["Fac"].default_value = 0.55

    visible_output = visible.outputs["BSDF"] if spec["shader"] == "diffuse" else visible.outputs["Emission"]
    links.new(transparent.outputs["BSDF"], mix.inputs[1])
    links.new(visible_output, mix.inputs[2])
    links.new(mix.outputs["Shader"], output.inputs["Surface"])
    return mat


def add_effect_card(name: str, matrix: Matrix, mat, roll_deg: float, radius_y: float, radius_z: float):
    roll = math.radians(roll_deg)
    cy = math.cos(roll)
    sy = math.sin(roll)

    def point(x: float, y: float, z: float) -> Vector:
        rotated = Vector((x, y * cy - z * sy, y * sy + z * cy))
        return matrix @ rotated

    verts = [
        point(-0.5, -radius_y, -radius_z),
        point(0.5, -radius_y, -radius_z),
        point(0.5, radius_y, radius_z),
        point(-0.5, radius_y, radius_z),
    ]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata([tuple(v) for v in verts], [], [(0, 1, 2, 3)])
    mesh.update()
    mesh.uv_layers.new(name="UVMap")
    # Local +X is the tight/nozzle end; local -X is the expanding plume tail.
    for loop, uv in zip(mesh.uv_layers.active.data, [(0, 0), (1, 0), (1, 1), (0, 1)], strict=True):
        loop.uv = uv

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.visible_shadow = False
    obj.data.materials.append(mat)
    return obj


def place_effect(instance: dict, effect_frame: int = 0) -> dict:
    effect_id = instance["effect_id"]
    if effect_id not in EFFECT_RENDERERS:
        raise ValueError(f"unknown effect_id: {effect_id}")

    spec = EFFECT_RENDERERS[effect_id]
    matrix = three_matrix_to_blender(instance)
    source_dir = spec["source"]
    card_paths = sorted(source_dir.glob(spec["pattern"])) if source_dir.exists() else []
    params = instance.get("effect_params") or {}
    frame_offset = int(params.get("frame_offset", 0))
    frame_stride = max(1, int(params.get("frame_stride", 2)))
    cards = []
    card_images = []
    for index, roll in enumerate(spec["rolls"]):
        if card_paths:
            card_index = (index * frame_stride + 1 + effect_frame + frame_offset) % len(card_paths)
            image_path = card_paths[card_index]
            card_images.append(image_path.name)
        else:
            image_path = None
        mat = make_effect_mat(
            f"{instance['instance_id']} {effect_id} card {index:02d}",
            image_path,
            spec,
            spec["strength"] + index * spec["strength_step"],
        )
        obj = add_effect_card(
            f"{instance['instance_id']} {effect_id} card {index:02d}",
            matrix,
            mat,
            roll,
            spec["radius_y"] + index * spec["radius_step"],
            spec["radius_z"] + index * spec["radius_step"],
        )
        cards.append(obj.name)

    return {
        "instance_id": instance["instance_id"],
        "effect_id": effect_id,
        "matrix_world": matrix_rows(matrix),
        "objects": cards,
        "source": str(source_dir),
        "card_count": len(card_paths),
        "card_images": card_images,
        "effect_frame": effect_frame,
        "mode": spec["mode"],
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
    if hasattr(scene.cycles, "transparent_max_bounces"):
        scene.cycles.transparent_max_bounces = max(scene.cycles.transparent_max_bounces, 64)
    scene.render.resolution_x = int(render.get("width", 1920))
    scene.render.resolution_y = int(render.get("height", 1080))
    scene.render.filepath = str(out_path)


def render_layout(
    layout_path: Path,
    manifest_path: Path,
    render_dir: Path,
    pose: str = "base",
    effect_frame: int = 0,
) -> dict:
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    validate_layout(layout)
    layout = layout_with_pose(layout, pose)
    validate_layout(layout)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = {asset["id"]: asset for asset in manifest["assets"]}

    reset_scene()
    placements = []
    effects = []
    texture_roots = default_texture_roots(ROOT)
    texture_index = index_texture_basenames(texture_roots)
    for instance in layout.get("instances", []):
        if instance.get("effect_id"):
            effects.append(place_effect(instance, effect_frame))
        else:
            placements.append(place_instance(instance, assets[instance["asset_id"]], texture_index))
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
        "pose": pose,
        "manifest": str(manifest_path),
        "output": str(out_path),
        "timestamp": datetime.now(UTC).isoformat(),
        "samples": bpy.context.scene.cycles.samples,
        "effect_frame": effect_frame,
        "assets": sorted({item["asset_id"] for item in layout.get("instances", []) if item.get("asset_id")}),
        "effects": effects,
        "lighting": lighting,
        "placements": placements,
        "texture_roots": [str(path) for path in texture_roots],
        "missing_texture_warning_count": sum(
            placement["texture_warnings"]["missing_count"] for placement in placements
        ),
        "relinked_texture_count": sum(
            placement["texture_warnings"]["relinked_count"] for placement in placements
        ),
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
    parser.add_argument("--pose", choices=("base", "a", "b"), default="base")
    parser.add_argument("--effect-frame", type=int, default=0)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    render_layout(args.layout, args.manifest, args.output_dir, args.pose, args.effect_frame)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
