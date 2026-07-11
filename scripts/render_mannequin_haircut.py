#!/usr/bin/env python3
"""Render a guide-driven mannequin groom and a primitive bob-cut event."""

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
from mathutils import Vector  # noqa: E402

import render_motion as studio  # noqa: E402
from haircut_math import apply_displacement, cut_curve, rest_curve, scalp_fibers  # noqa: E402
from render_layout import look_at, reset_scene  # noqa: E402
from wind_canopy_math import blend_polylines, resample_polyline  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("motion", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fibers", type=int, default=1200)
    parser.add_argument("--points", type=int, default=18)
    parser.add_argument("--cut-time", type=float, default=2.0)
    parser.add_argument("--cut-height", type=float, default=6.45)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--duration", type=float, default=4.0)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def to_blender(values: list[float]) -> tuple[float, float, float]:
    return (values[0], -values[2], values[1])


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


def guide_samples(motion: dict, paths: list[list[int]], frame_index: int, count: int) -> list[list]:
    frame = motion["frames"][frame_index]
    positions = {node["id"]: to_blender(node["position_m"]) for node in frame["nodes"]}
    return [resample_polyline([positions[node] for node in path], count) for path in paths]


def fiber_guide_displacement(
    phase: float, rest_guides: list[list], current_guides: list[list]
) -> list[tuple[float, float, float]]:
    coordinate = 0.5 * (math.sin(phase) + 1.0) * (len(rest_guides) - 1)
    left = min(math.floor(coordinate), len(rest_guides) - 2)
    alpha = coordinate - left
    rest = blend_polylines(rest_guides[left], rest_guides[left + 1], alpha)
    current = blend_polylines(current_guides[left], current_guides[left + 1], alpha)
    return [
        tuple(current_point[axis] - rest_point[axis] for axis in range(3))
        for rest_point, current_point in zip(rest, current, strict=True)
    ]


def hair_material(name: str, color: tuple[float, float, float, float], roughness: float):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    hair = nodes.new("ShaderNodeBsdfHairPrincipled")
    hair.parametrization = "COLOR"
    hair.inputs["Color"].default_value = color
    hair.inputs["Roughness"].default_value = roughness
    hair.inputs["Radial Roughness"].default_value = roughness + 0.08
    # Blender hides the randomization sockets in COLOR parametrization.  The
    # groom gets its controlled variation from alternating materials instead.
    material.node_tree.links.new(hair.outputs[0], output.inputs["Surface"])
    return material


def curve_bundle(name: str, fiber_count: int, point_count: int, materials: list) -> dict:
    data = bpy.data.curves.new(name, type="CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = 0.0055
    data.bevel_resolution = 1
    for material in materials:
        data.materials.append(material)
    splines = []
    for index in range(fiber_count):
        spline = data.splines.new("POLY")
        spline.points.add(point_count - 1)
        spline.material_index = 1 if index % 7 == 0 else 0
        splines.append(spline)
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    return {"object": obj, "splines": splines}


def update_spline(spline, points: list[tuple[float, float, float]]) -> None:
    for spline_point, point in zip(spline.points, points, strict=True):
        spline_point.co = (*point, 1.0)


def mannequin_material(name: str, color: tuple[float, float, float, float], metallic=0.0):
    return studio.make_material(name, color, metallic, 0.38)


def add_mannequin() -> None:
    porcelain = mannequin_material("Warm porcelain", (0.58, 0.27, 0.18, 1), 0.04)
    dark = mannequin_material("Mannequin features", (0.018, 0.012, 0.02, 1), 0.12)
    lips = mannequin_material("Muted lips", (0.32, 0.025, 0.035, 1), 0.02)
    cloth = mannequin_material("Velvet bust", (0.025, 0.04, 0.13, 1), 0.05)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, location=(0, 0, 8.35))
    head = bpy.context.object
    head.name = "Mannequin head"
    head.scale = (1.55, 1.34, 1.82)
    head.data.materials.append(porcelain)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=(0, -1.28, 8.25))
    nose = bpy.context.object
    nose.scale = (0.24, 0.34, 0.38)
    nose.data.materials.append(porcelain)
    for x in (-0.54, 0.54):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=20, ring_count=12, radius=0.13, location=(x, -1.27, 8.66)
        )
        bpy.context.object.data.materials.append(dark)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=(0, -1.34, 7.76))
    mouth = bpy.context.object
    mouth.scale = (0.46, 0.08, 0.12)
    mouth.data.materials.append(lips)
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.72, depth=2.1, location=(0, 0, 5.95))
    bpy.context.object.data.materials.append(porcelain)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=(0, 0.22, 4.75))
    shoulders = bpy.context.object
    shoulders.scale = (3.75, 1.28, 1.2)
    shoulders.data.materials.append(cloth)


def add_scissors(cut_height: float) -> dict:
    silver = mannequin_material("Scissor steel", (0.55, 0.62, 0.72, 1), 0.88)
    handle = mannequin_material("Scissor handles", (0.38, 0.015, 0.035, 1), 0.12)
    root = bpy.data.objects.new("Primitive haircut scissors", None)
    bpy.context.scene.collection.objects.link(root)
    for angle in (-0.14, 0.14):
        bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
        blade = bpy.context.object
        blade.scale = (1.55, 0.055, 0.055)
        blade.rotation_euler.y = angle
        blade.data.materials.append(silver)
        blade.parent = root
    for z in (-0.28, 0.28):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.26,
            minor_radius=0.07,
            location=(1.75, 0, z),
            rotation=(math.pi / 2, 0, 0),
        )
        ring = bpy.context.object
        ring.data.materials.append(handle)
        ring.parent = root
    root.location = (4.2, -2.0, cut_height)
    return {"root": root, "cut_height": cut_height}


def update_scissors(scissors: dict, time_s: float, cut_time: float) -> None:
    progress = max(0.0, min(1.0, (time_s - cut_time + 0.42) / 0.84))
    scissors["root"].location = (4.2 - 8.4 * progress, -2.0, scissors["cut_height"])
    scissors["root"].rotation_euler.z = 0.08 * math.sin(progress * math.pi)


def add_studio() -> None:
    bpy.ops.mesh.primitive_plane_add(size=32, location=(0, 0, 3.55))
    bpy.context.object.data.materials.append(
        mannequin_material("Salon floor", (0.014, 0.018, 0.035, 1), 0.08)
    )
    world = bpy.context.scene.world or bpy.data.worlds.new("Haircut studio")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.006, 0.016, 1)
    background.inputs["Strength"].default_value = 0.32
    studio.add_area_light("Hair key", (5, -7, 14), 1900, 7, (1.0, 0.58, 0.32))
    studio.add_area_light("Hair fill", (-6, -2, 11), 1450, 6, (0.25, 0.48, 1.0))
    studio.add_area_light("Hair rim", (2, 5, 13), 1700, 5, (1.0, 0.12, 0.36))
    data = bpy.data.cameras.new("Haircut camera")
    camera = bpy.data.objects.new("Haircut camera", data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (10.5, -18.5, 9.3)
    look_at(camera, Vector((0.0, 0.0, 7.4)), Vector((0.0, 0.0, 1.0)))
    data.lens = 58
    data.dof.use_dof = True
    data.dof.focus_distance = 20.5
    data.dof.aperture_fstop = 5.8
    bpy.context.scene.camera = camera


def main() -> None:
    args = parse_args()
    motion = json.loads(args.motion.read_text(encoding="utf-8"))
    paths = hair_paths(motion)
    fibers = scalp_fibers(args.fibers)
    rest_points = [rest_curve(fiber, args.points) for fiber in fibers]
    rest_guides = guide_samples(motion, paths, 0, args.points)
    cut_source_index = min(
        round(args.cut_time / motion["sample_interval_s"]), len(motion["frames"]) - 1
    )
    cut_guides = guide_samples(motion, paths, cut_source_index, args.points)
    cut_shapes = []
    severed_count = 0
    for fiber, points in zip(fibers, rest_points, strict=True):
        displacement = fiber_guide_displacement(fiber.phase, rest_guides, cut_guides)
        moved = apply_displacement(points, displacement)
        _, severed, crossing = cut_curve(moved, args.cut_height)
        severed_count += crossing < args.points
        cut_shapes.append(severed)

    reset_scene()
    add_mannequin()
    add_studio()
    scissors = add_scissors(args.cut_height)
    dark_hair = hair_material("Chestnut hair", (0.055, 0.012, 0.006, 1), 0.28)
    highlight = hair_material("Copper highlights", (0.22, 0.035, 0.009, 1), 0.25)
    attached = curve_bundle("Attached groom", args.fibers, args.points, [dark_hair, highlight])
    severed = curve_bundle("Severed groom", args.fibers, args.points, [dark_hair, highlight])

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.fps = args.fps
    frame_count = round(args.duration * args.fps) + 1
    scene.frame_start = 1
    scene.frame_end = frame_count
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.look = "AgX - Medium High Contrast"
    frame_dir = args.output.with_name(f"{args.output.stem}_frames")
    frame_dir.mkdir(parents=True, exist_ok=True)

    for frame_index in range(frame_count):
        time_s = frame_index / args.fps
        source_index = min(round(time_s / motion["sample_interval_s"]), len(motion["frames"]) - 1)
        current_guides = guide_samples(motion, paths, source_index, args.points)
        after_cut = time_s >= args.cut_time
        severed["object"].hide_render = not after_cut
        fall_time = max(0.0, time_s - args.cut_time)
        for index, (fiber, points) in enumerate(zip(fibers, rest_points, strict=True)):
            displacement = fiber_guide_displacement(fiber.phase, rest_guides, current_guides)
            moved = apply_displacement(points, displacement)
            attached_points = cut_curve(moved, args.cut_height)[0] if after_cut else moved
            update_spline(attached["splines"][index], attached_points)
            if after_cut:
                drift = (
                    0.55 * fall_time + 0.12 * math.sin(fiber.phase),
                    0.22 * fall_time * math.sin(fiber.phase * 1.7),
                    -2.8 * fall_time * fall_time,
                )
                falling = [
                    tuple(point[axis] + drift[axis] for axis in range(3))
                    for point in cut_shapes[index]
                ]
                update_spline(severed["splines"][index], falling)
        update_scissors(scissors, time_s, args.cut_time)
        scene.frame_set(frame_index + 1)
        scene.render.filepath = str(frame_dir / f"frame_{frame_index + 1:04d}.png")
        bpy.ops.render.render(write_still=True)

    groom_payload = json.dumps(
        [fiber.__dict__ for fiber in fibers], sort_keys=True, separators=(",", ":")
    ).encode()
    receipt = {
        "schema": "mannequin-haircut-render/1",
        "created": datetime.now(UTC).isoformat(),
        "output": str(args.output.resolve()),
        "frames_directory": str(frame_dir.resolve()),
        "frames": frame_count,
        "fps": args.fps,
        "duration_s": args.duration,
        "fibers": args.fibers,
        "points_per_fiber": args.points,
        "physical_guides": len(paths),
        "cut_time_s": args.cut_time,
        "cut_height_m": args.cut_height,
        "severed_fibers": severed_count,
        "groom_sha256": hashlib.sha256(groom_payload).hexdigest(),
        "guide_motion_sha256": hashlib.sha256(args.motion.read_bytes()).hexdigest(),
        "hair_shader": "Principled Hair BSDF",
        "continuum_hair_mechanics": False,
        "strand_self_contact": False,
        "cutting_tool_contact_mechanics": False,
    }
    args.output.with_suffix(".receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
