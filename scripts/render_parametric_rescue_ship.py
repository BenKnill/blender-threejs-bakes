#!/usr/bin/env python3
"""Build and render a geometry-first parametric rescue ship conditioning plate."""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import bpy
from mathutils import Vector


@dataclass(frozen=True)
class ShipSpec:
    total_length_m: float = 18.0
    habitat_length_m: float = 5.6
    machinery_length_m: float = 5.0
    propulsion_length_m: float = 6.0
    lifeboat_count: int = 4
    propellant_tank_count: int = 4
    engine_count: int = 5
    section_order: tuple[str, ...] = ("habitation", "machinery", "propulsion")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("renders/parametric_rescue_ship"),
    )
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=800)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--views", default="hero,side,top")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name: str) -> bpy.types.Collection:
    created = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(created)
    return created


def move_to_collection(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    target.objects.link(obj)


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.append(material)


def procedural_material(
    name: str,
    color_a: tuple[float, float, float, float],
    color_b: tuple[float, float, float, float],
    *,
    metallic: float,
    roughness: float,
    texture_scale: float,
    bump_strength: float,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    texcoord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    ramp = nodes.new("ShaderNodeValToRGB")
    bump = nodes.new("ShaderNodeBump")

    noise.inputs["Scale"].default_value = texture_scale
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.72
    ramp.color_ramp.elements[0].color = color_a
    ramp.color_ramp.elements[1].color = color_b
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[1].position = 0.78
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    bump.inputs["Strength"].default_value = bump_strength
    bump.inputs["Distance"].default_value = 0.08

    if emission is not None:
        emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        if emission_input is not None:
            emission_input.default_value = emission
        strength_input = shader.inputs.get("Emission Strength")
        if strength_input is not None:
            strength_input.default_value = emission_strength

    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def solid_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.4,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    return procedural_material(
        name,
        color,
        color,
        metallic=metallic,
        roughness=roughness,
        texture_scale=5.0,
        bump_strength=0.0,
        emission=color if emission_strength else None,
        emission_strength=emission_strength,
    )


def smooth(obj: bpy.types.Object) -> None:
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("soft industrial edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
    assign_material(obj, material)
    move_to_collection(obj, target)
    return obj


def sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48,
        ring_count=24,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    assign_material(obj, material)
    move_to_collection(obj, target)
    return obj


AXIS_ROTATIONS = {
    "X": (0.0, math.pi / 2, 0.0),
    "Y": (math.pi / 2, 0.0, 0.0),
    "Z": (0.0, 0.0, 0.0),
}


def cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    target: bpy.types.Collection,
    *,
    axis: str = "X",
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=40,
        radius=radius,
        depth=depth,
        location=location,
        rotation=AXIS_ROTATIONS[axis],
    )
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    assign_material(obj, material)
    move_to_collection(obj, target)
    return obj


def capsule(
    name: str,
    location: tuple[float, float, float],
    length: float,
    radius: float,
    material: bpy.types.Material,
    target: bpy.types.Collection,
) -> list[bpy.types.Object]:
    x, y, z = location
    body_depth = max(0.2, length - 2 * radius)
    return [
        cylinder(name, location, radius, body_depth, material, target),
        sphere(f"{name} fore cap", (x - body_depth / 2, y, z), (radius,) * 3, material, target),
        sphere(f"{name} aft cap", (x + body_depth / 2, y, z), (radius,) * 3, material, target),
    ]


def ring(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=12,
        location=location,
        rotation=AXIS_ROTATIONS["X"],
    )
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    assign_material(obj, material)
    move_to_collection(obj, target)
    return obj


def cone(
    name: str,
    location: tuple[float, float, float],
    radius_front: float,
    radius_aft: float,
    depth: float,
    material: bpy.types.Material,
    target: bpy.types.Collection,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=48,
        radius1=radius_front,
        radius2=radius_aft,
        depth=depth,
        location=location,
        rotation=AXIS_ROTATIONS["X"],
    )
    obj = bpy.context.object
    obj.name = name
    smooth(obj)
    assign_material(obj, material)
    move_to_collection(obj, target)
    return obj


def build_ship(spec: ShipSpec) -> dict[str, int]:
    habitat = collection("01 HABITATION")
    machinery = collection("02 MACHINERY")
    propulsion = collection("03 PROPULSION")
    studio = collection("STUDIO")

    hull = procedural_material(
        "ceramic white hull",
        (0.42, 0.46, 0.48, 1.0),
        (0.82, 0.86, 0.86, 1.0),
        metallic=0.25,
        roughness=0.34,
        texture_scale=7.5,
        bump_strength=0.18,
    )
    dark = procedural_material(
        "machinery graphite",
        (0.025, 0.035, 0.045, 1.0),
        (0.12, 0.15, 0.17, 1.0),
        metallic=0.7,
        roughness=0.3,
        texture_scale=10.0,
        bump_strength=0.28,
    )
    orange = procedural_material(
        "rescue orange",
        (0.32, 0.055, 0.008, 1.0),
        (1.0, 0.28, 0.015, 1.0),
        metallic=0.15,
        roughness=0.32,
        texture_scale=8.0,
        bump_strength=0.16,
    )
    red = solid_material("section markings", (0.38, 0.025, 0.018, 1.0), roughness=0.42)
    copper = procedural_material(
        "service copper",
        (0.12, 0.025, 0.006, 1.0),
        (0.55, 0.18, 0.035, 1.0),
        metallic=0.82,
        roughness=0.25,
        texture_scale=12.0,
        bump_strength=0.12,
    )
    glass = solid_material(
        "forward observation glass",
        (0.015, 0.11, 0.15, 1.0),
        metallic=0.3,
        roughness=0.2,
        emission_strength=1.4,
    )
    engine_glow = solid_material(
        "engine ion glow",
        (0.02, 0.34, 0.75, 1.0),
        metallic=0.0,
        roughness=0.18,
        emission_strength=7.0,
    )
    matte = solid_material("studio floor", (0.005, 0.008, 0.014, 1.0), roughness=0.72)

    sphere("habitation pressure hull", (-5.6, 0, 0), (3.2, 2.35, 1.55), hull, habitat)
    capsule("dorsal command cupola", (-5.5, 0, 1.55), 2.5, 0.72, orange, habitat)
    box("keel fairing", (-4.9, 0, -1.35), (3.8, 2.2, 0.45), dark, habitat)
    for index, y in enumerate((-1.15, 0.0, 1.15), start=1):
        box(
            f"forward window {index}",
            (-8.32 + 0.08 * abs(y), y, 0.28),
            (0.12, 0.72, 0.44),
            glass,
            habitat,
            rotation=(0.0, 0.0, -0.08 * y),
            bevel=0.06,
        )
    for index, x in enumerate((-6.8, -5.6, -4.4), start=1):
        box(
            f"port observation window {index}",
            (x, -2.29, 0.2),
            (0.72, 0.1, 0.38),
            glass,
            habitat,
            bevel=0.05,
        )
    for index, (x, y) in enumerate(
        ((-6.4, -2.7), (-4.5, -2.75), (-6.4, 2.7), (-4.5, 2.75)),
        start=1,
    ):
        capsule(f"lifeboat {index}", (x, y, -0.15), 2.1, 0.48, orange, habitat)
        cylinder(f"lifeboat {index} white band", (x, y, -0.15), 0.5, 0.16, hull, habitat)
    box("habitat port marking", (-5.4, -2.4, -0.62), (2.0, 0.08, 0.32), red, habitat, bevel=0.02)

    cylinder("winch drum", (-2.75, 0, 2.0), 0.52, 1.5, copper, machinery, axis="Y")
    cylinder("winch cable", (-2.75, 0, 2.0), 0.36, 1.56, dark, machinery, axis="Y")
    for y in (-0.92, 0.92):
        box("winch support", (-2.75, y, 1.55), (0.35, 0.22, 1.0), dark, machinery)

    box("machinery pressure box", (0.0, 0.0, 0.0), (4.8, 4.2, 2.65), dark, machinery, bevel=0.22)
    for x in (-1.45, 0.0, 1.45):
        box(f"service module {x:+.2f}", (x, -1.75, 1.38), (1.05, 0.65, 0.55), hull, machinery)
    for y in (-2.35, 2.35):
        for z in (-1.35, 1.35):
            box("longitudinal truss", (0, y, z), (5.2, 0.16, 0.16), copper, machinery, bevel=0.03)
    for x in (-1.7, 0.0, 1.7):
        box("cross truss", (x, 0, 1.38), (0.16, 4.8, 0.16), copper, machinery, bevel=0.03)
    for y in (-0.55, 0.0, 0.55):
        cylinder("service pipe", (0, y, 1.62), 0.09, 4.5, copper, machinery)
    for side in (-1, 1):
        box(
            "deployable radiator",
            (0.2, side * 3.25, 0.15),
            (3.6, 1.8, 0.12),
            dark,
            machinery,
            rotation=(side * 0.14, 0.0, 0.0),
            bevel=0.04,
        )
        for x in (-1.1, 0.2, 1.5):
            box(
                "radiator copper rib",
                (x, side * 3.25, 0.18),
                (0.08, 1.65, 0.05),
                copper,
                machinery,
                rotation=(side * 0.14, 0.0, 0.0),
                bevel=0.01,
            )
    for x in (-2.55, 2.55):
        ring("section pressure collar", (x, 0, 0), 2.14, 0.15, copper, machinery)
        ring("section collar guard", (x, 0, 0), 2.38, 0.07, hull, machinery)

    box("propulsion spine", (5.55, 0, 0), (5.6, 1.35, 1.1), dark, propulsion, bevel=0.18)
    tank_positions = ((-1.25, -0.78), (1.25, -0.78), (-1.25, 0.78), (1.25, 0.78))
    for index, (y, z) in enumerate(tank_positions, start=1):
        capsule(f"propellant tank {index}", (5.5, y, z), 4.7, 0.65, hull, propulsion)
        for x in (4.45, 6.55):
            cylinder(f"tank {index} red band", (x, y, z), 0.675, 0.15, red, propulsion)
    engine_positions = [(0.0, 0.0), *tank_positions]
    for index, (y, z) in enumerate(engine_positions, start=1):
        radius = 0.9 if index == 1 else 0.68
        cone(f"engine bell {index}", (8.45, y, z), radius * 0.55, radius, 1.35, dark, propulsion)
        cylinder(f"engine glow {index}", (9.14, y, z), radius * 0.62, 0.06, engine_glow, propulsion)
    for side in (-1, 1):
        box(
            "aft heat shield",
            (6.65, side * 2.55, 0.0),
            (2.8, 0.5, 2.3),
            dark,
            propulsion,
            bevel=0.12,
        )

    box("shadow plane", (0, 0, -2.35), (32, 26, 0.2), matte, studio, bevel=0.0)
    return {
        "habitation_objects": len(habitat.objects),
        "machinery_objects": len(machinery.objects),
        "propulsion_objects": len(propulsion.objects),
    }


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    color: tuple[float, float, float],
    energy: float,
    size: float,
) -> None:
    light_data = bpy.data.lights.new(name, type="AREA")
    light_data.color = color
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new(name, light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    look_at(light, (0.0, 0.0, 0.0))


def setup_studio(width: int, height: int, samples: int) -> bpy.types.Object:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("deep studio world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.002, 0.004, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.18

    add_area_light("warm key", (-9, -11, 18), (1.0, 0.64, 0.42), 1550, 8.0)
    add_area_light("cool fill", (-1, -12, 6), (0.27, 0.52, 1.0), 1050, 7.0)
    add_area_light("cyan rim", (10, 8, 15), (0.15, 0.72, 1.0), 1900, 6.0)
    add_area_light("engine bounce", (10, -3, 1), (0.2, 0.5, 1.0), 900, 4.0)

    camera_data = bpy.data.cameras.new("conditioning camera")
    camera = bpy.data.objects.new("conditioning camera", camera_data)
    scene.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 23.0
    scene.camera = camera

    if hasattr(scene, "compositing_node_group"):
        tree = bpy.data.node_groups.new("conditioning compositor", "CompositorNodeTree")
        tree.interface.new_socket(name="Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        scene.compositing_node_group = tree
    else:
        scene.use_nodes = True
        tree = scene.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    render_layers = nodes.new("CompositorNodeRLayers")
    glare = nodes.new("CompositorNodeGlare")
    if "Type" in glare.inputs:
        glare.inputs["Type"].default_value = "Fog Glow"
        glare.inputs["Quality"].default_value = "High"
        glare.inputs["Threshold"].default_value = 1.2
        glare.inputs["Size"].default_value = 0.25
    else:
        glare.glare_type = "FOG_GLOW"
        glare.quality = "HIGH"
        glare.threshold = 1.2
        glare.size = 6
    composite = nodes.new(
        "NodeGroupOutput" if hasattr(scene, "compositing_node_group") else "CompositorNodeComposite"
    )
    links.new(render_layers.outputs["Image"], glare.inputs["Image"])
    links.new(glare.outputs["Image"], composite.inputs["Image"])
    return camera


VIEW_CONFIG = {
    "hero": ((-20.0, -25.0, 16.0), (0.2, 0.0, 0.15), 23.0),
    "side": ((-1.0, -31.0, 5.0), (0.1, 0.0, 0.0), 21.0),
    "top": ((0.0, 0.0, 33.0), (0.0, 0.0, 0.0), 21.0),
}


def render_views(camera: bpy.types.Object, output_dir: Path, views: list[str]) -> list[dict]:
    rendered = []
    for view in views:
        if view not in VIEW_CONFIG:
            raise ValueError(f"unknown view: {view}")
        location, target, ortho_scale = VIEW_CONFIG[view]
        camera.location = location
        camera.data.ortho_scale = ortho_scale
        look_at(camera, target)
        output = output_dir / f"rescue_ship_{view}.png"
        bpy.context.scene.render.filepath = str(output)
        started = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        rendered.append(
            {
                "view": view,
                "path": str(output),
                "wall_seconds": time.perf_counter() - started,
                "size_bytes": output.stat().st_size,
            }
        )
    return rendered


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    views = [view.strip() for view in args.views.split(",") if view.strip()]
    spec = ShipSpec()
    started = time.perf_counter()
    reset_scene()
    counts = build_ship(spec)
    camera = setup_studio(args.width, args.height, args.samples)
    blend_path = output_dir / "parametric_rescue_ship.blend"
    renders = render_views(camera, output_dir, views)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    receipt = {
        "schema": "parametric-rescue-ship/1",
        "design_intent": "geometry-first conditioning plate for later image generation",
        "non_claims": [
            "not an engineering-qualified pressure vessel",
            "not a propulsion performance model",
            "procedural surface detail is illustrative rather than manufactured panel topology",
        ],
        "spec": asdict(spec),
        "component_counts": counts,
        "rules": {
            "weapons": "none",
            "windows": "forward and outward facing; no visible occupants",
            "lifeboats": "four orange side-mounted capsules adjacent to habitation",
            "winch": "single dorsal service drum at habitation-machinery collar",
            "functional_thirds": list(spec.section_order),
        },
        "render": {
            "engine": bpy.context.scene.render.engine,
            "resolution": [args.width, args.height],
            "samples_requested": args.samples,
            "views": renders,
        },
        "blend": str(blend_path),
        "wall_seconds": time.perf_counter() - started,
    }
    receipt_path = output_dir / "parametric_rescue_ship.receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
