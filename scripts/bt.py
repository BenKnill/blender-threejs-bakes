#!/usr/bin/env python3
"""Non-interactive control surface for Blender Three.js bakes."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path
from typing import Any

from btlib.layout import (
    BLENDER,
    DEFAULT_LAYOUT,
    DEFAULT_MANIFEST,
    DEFAULT_RENDERS,
    RENDER_SCRIPT,
    asset_by_id,
    instance_by_id,
    load_json,
    load_layout,
    load_manifest,
    new_layout,
    resolve_repo_path,
    unique_instance_id,
    write_layout,
)
from btlib.lighting import LIGHTING_PRESETS, merge_lighting, preset_lighting
from btlib.validate import ContractError, validate_layout, validate_manifest


def validate_file(path: Path) -> None:
    data = load_json(path)
    if path.name == "manifest.json" or "assets" in data:
        validate_manifest(data)
    else:
        validate_layout(data)


def cmd_validate(args: argparse.Namespace) -> int:
    failures = []
    ok_paths = []
    for path in args.paths:
        try:
            validate_file(path)
        except ContractError as exc:
            failures.append({"path": str(path), "errors": exc.errors})
        else:
            ok_paths.append(str(path))
    if failures:
        if args.json:
            print_json({"ok": False, "failures": failures})
        else:
            for failure in failures:
                print(f"{failure['path']}:", file=sys.stderr)
                for error in failure["errors"]:
                    print(f"  {error}", file=sys.stderr)
        return 2
    if args.json:
        print_json({"ok": True, "paths": ok_paths})
    else:
        for path in ok_paths:
            print(f"ok: {path}")
    return 0


def cmd_assets(args: argparse.Namespace) -> int:
    manifest = load_manifest(resolve_repo_path(args.manifest))
    assets = [
        {
            "id": asset["id"],
            "name": asset["name"],
            "bbox": asset["bbox"],
            "source_blend": asset["source_blend"],
            "glb": asset["glb"],
        }
        for asset in manifest["assets"]
    ]
    if args.json:
        print_json({"assets": assets})
        return 0
    print_table(
        ["id", "name", "bbox", "source"],
        [
            [
                asset["id"],
                asset["name"],
                vec_text(asset["bbox"]),
                Path(asset["source_blend"]).name,
            ]
            for asset in assets
        ],
    )
    return 0


def cmd_layout_new(args: argparse.Namespace) -> int:
    layout = new_layout(args.name)
    path = resolve_repo_path(args.layout)
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "name": layout["name"]}, args.json)


def cmd_layout_show(args: argparse.Namespace) -> int:
    layout = load_layout(resolve_repo_path(args.layout))
    if args.json:
        print_json(layout)
    else:
        print(json.dumps(layout, indent=2))
    return 0


def cmd_place(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    manifest = load_manifest(resolve_repo_path(args.manifest))
    asset_by_id(manifest, args.asset_id)
    instance_id = args.id or unique_instance_id(layout, args.asset_id)
    instance = {
        "instance_id": instance_id,
        "asset_id": args.asset_id,
        "position": args.at,
        "quaternion": [0, 0, 0, 1],
        "scale": scale_values(args.scale),
    }
    layout["instances"].append(instance)
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "instance": instance}, args.json)


def cmd_move(args: argparse.Namespace) -> int:
    path, layout, instance = editable_instance(args)
    if args.by:
        instance["position"] = [
            value + delta for value, delta in zip(instance["position"], args.by, strict=True)
        ]
    else:
        instance["position"] = args.to
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "instance": instance}, args.json)


def cmd_rotate(args: argparse.Namespace) -> int:
    path, layout, instance = editable_instance(args)
    instance["quaternion"] = args.quat if args.quat else euler_xyz_to_quat(args.euler_deg)
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "instance": instance}, args.json)


def cmd_scale(args: argparse.Namespace) -> int:
    path, layout, instance = editable_instance(args)
    if args.by is not None:
        factors = scale_values(args.by)
        instance["scale"] = [
            value * factor for value, factor in zip(instance["scale"], factors, strict=True)
        ]
    else:
        instance["scale"] = scale_values(args.to)
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "instance": instance}, args.json)


def cmd_remove(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    before = len(layout["instances"])
    layout["instances"] = [
        instance for instance in layout["instances"] if instance["instance_id"] != args.instance_id
    ]
    if len(layout["instances"]) == before:
        raise ValueError(f"unknown instance_id: {args.instance_id}")
    write_layout(path, layout)
    return print_result(
        {"ok": True, "layout": relative(path), "removed": args.instance_id},
        args.json,
    )


def cmd_camera_set(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    camera = layout["camera"]
    if args.pos:
        camera["position"] = args.pos
    if args.target:
        camera["target"] = args.target
    if args.fov is not None:
        camera["fov_deg"] = args.fov
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "camera": camera}, args.json)


def cmd_camera_frame(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    manifest = load_manifest(resolve_repo_path(args.manifest))
    instance = instance_by_id(layout, args.instance_id)
    asset = asset_by_id(manifest, instance["asset_id"])
    camera = layout["camera"]
    target = instance["position"][:]
    radius = instance_radius(asset["bbox"], instance["scale"])
    fov = float(args.fov if args.fov is not None else camera["fov_deg"])
    distance = max(0.1, (radius / math.tan(math.radians(fov) / 2)) * args.padding)
    direction = normalize(
        [camera["position"][index] - camera["target"][index] for index in range(3)]
    )
    camera["target"] = target
    camera["position"] = [target[index] + direction[index] * distance for index in range(3)]
    camera["fov_deg"] = fov
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "camera": camera}, args.json)


def cmd_light_preset(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    layout["schema"] = 2
    layout["lighting"] = preset_lighting(args.name)
    write_layout(path, layout)
    return print_result(
        {"ok": True, "layout": relative(path), "lighting": layout["lighting"]}, args.json
    )


def cmd_light_sun(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    layout["schema"] = 2
    lighting = merge_lighting(layout.get("lighting"))
    if args.azimuth is not None:
        lighting["sun"]["azimuth_deg"] = args.azimuth
    if args.elevation is not None:
        lighting["sun"]["elevation_deg"] = args.elevation
    if args.strength is not None:
        lighting["sun"]["strength"] = args.strength
    if args.angle is not None:
        lighting["sun"]["angle_deg"] = args.angle
    if args.color is not None:
        lighting["sun"]["color"] = args.color
    layout["lighting"] = lighting
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "lighting": lighting}, args.json)


def cmd_render(args: argparse.Namespace) -> int:
    layout = resolve_repo_path(args.layout)
    if not layout.exists():
        raise ValueError(f"layout does not exist: {layout}")
    render_layout = prepare_render_layout(layout, args)
    output_dir = resolve_repo_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    before = {path.name for path in output_dir.glob("*.png")} if output_dir.exists() else set()
    cmd = [
        str(BLENDER),
        "--background",
        "--python",
        str(RENDER_SCRIPT),
        "--",
        str(render_layout),
        "--manifest",
        str(resolve_repo_path(args.manifest)),
        "--output-dir",
        str(output_dir),
    ]
    proc = subprocess.run(cmd, cwd=resolve_repo_path("."), capture_output=True, text=True)
    if proc.returncode != 0:
        payload = {
            "ok": False,
            "returncode": proc.returncode,
            "stdout": proc.stdout[-4000:],
            "stderr": proc.stderr[-4000:],
        }
        if args.json:
            print_json(payload)
        else:
            print("Blender render failed", file=sys.stderr)
            print(proc.stderr[-4000:], file=sys.stderr)
        return 3
    renders = sorted(output_dir.glob("*.png"), key=lambda path: path.stat().st_mtime, reverse=True)
    new = [render for render in renders if render.name not in before]
    payload = {
        "ok": True,
        "layout": relative(layout),
        "new": [render_metadata(path) for path in new],
        "renders": [render_metadata(path) for path in renders],
    }
    return print_result(payload, args.json)


def prepare_render_layout(layout_path: Path, args: argparse.Namespace) -> Path:
    layout = load_layout(layout_path)
    if args.width is None and args.height is None and args.samples is None:
        return layout_path
    output_dir = resolve_repo_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    render = layout.setdefault("render", {})
    if args.width is not None:
        render["width"] = args.width
    if args.height is not None:
        render["height"] = args.height
    if args.samples is not None:
        render["samples"] = args.samples
    override_path = output_dir / ".bt-render-override.layout.json"
    write_layout(override_path, layout)
    return override_path


def editable_instance(args: argparse.Namespace) -> tuple[Path, dict[str, Any], dict[str, Any]]:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    return path, layout, instance_by_id(layout, args.instance_id)


def scale_values(values: list[float]) -> list[float]:
    if len(values) == 1:
        return [values[0], values[0], values[0]]
    if len(values) == 3:
        return values
    raise ValueError("scale expects one uniform value or three axis values")


def euler_xyz_to_quat(degrees: list[float]) -> list[float]:
    x, y, z = [math.radians(value) / 2 for value in degrees]
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return [
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz + sx * sy * cz,
        cx * cy * cz - sx * sy * sz,
    ]


def instance_radius(bbox: list[float], scale: list[float]) -> float:
    return math.sqrt(sum((bbox[index] * scale[index] / 2) ** 2 for index in range(3)))


def normalize(values: list[float]) -> list[float]:
    length = math.sqrt(sum(value * value for value in values))
    if length <= 0.000001:
        return [0.5, 0.35, 0.8]
    return [value / length for value in values]


def render_metadata(path: Path) -> dict[str, Any]:
    return {
        "name": path.name,
        "path": relative(path),
        "bytes": path.stat().st_size,
        "mtime": path.stat().st_mtime,
    }


def relative(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(resolve_repo_path(".").resolve()))
    except ValueError:
        return str(path)


def print_result(payload: dict[str, Any], json_output: bool) -> int:
    if json_output:
        print_json(payload)
    else:
        print(json.dumps(payload, indent=2))
    return 0


def print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2))


def print_table(headers: list[str], rows: list[list[str]]) -> None:
    widths = [
        max(len(str(value)) for value in [header, *(row[index] for row in rows)])
        for index, header in enumerate(headers)
    ]
    print("  ".join(header.ljust(widths[index]) for index, header in enumerate(headers)))
    for row in rows:
        print("  ".join(str(value).ljust(widths[index]) for index, value in enumerate(row)))


def vec_text(values: list[float]) -> str:
    return ", ".join(f"{value:g}" for value in values)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bt")
    subcommands = parser.add_subparsers(dest="command", required=True)

    assets = subcommands.add_parser("assets", help="list manifest assets")
    assets.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    assets.add_argument("--json", action="store_true")
    assets.set_defaults(func=cmd_assets)

    layout = subcommands.add_parser("layout", help="create or print layouts")
    layout_subcommands = layout.add_subparsers(dest="layout_command", required=True)
    layout_new = layout_subcommands.add_parser("new", help="create an empty schema-v2 layout")
    layout_new.add_argument("name")
    layout_new.add_argument("--layout", "-l", default=str(DEFAULT_LAYOUT))
    layout_new.add_argument("--json", action="store_true")
    layout_new.set_defaults(func=cmd_layout_new)
    layout_show = layout_subcommands.add_parser("show", help="print a layout")
    layout_show.add_argument("layout", nargs="?", default=str(DEFAULT_LAYOUT))
    layout_show.add_argument("--json", action="store_true")
    layout_show.set_defaults(func=cmd_layout_show)

    place = subcommands.add_parser("place", help="add an asset instance to a layout")
    add_layout_arg(place)
    place.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    place.add_argument("asset_id")
    place.add_argument("--at", type=float, nargs=3, metavar=("X", "Y", "Z"), default=[0, 0, 0])
    place.add_argument("--scale", type=float, nargs="+", default=[1])
    place.add_argument("--id")
    add_json_arg(place)
    place.set_defaults(func=cmd_place)

    move = subcommands.add_parser("move", help="set or offset an instance position")
    add_layout_arg(move)
    move.add_argument("instance_id")
    target = move.add_mutually_exclusive_group(required=True)
    target.add_argument("--to", type=float, nargs=3, metavar=("X", "Y", "Z"))
    target.add_argument("--by", type=float, nargs=3, metavar=("DX", "DY", "DZ"))
    add_json_arg(move)
    move.set_defaults(func=cmd_move)

    rotate = subcommands.add_parser("rotate", help="set an instance rotation")
    add_layout_arg(rotate)
    rotate.add_argument("instance_id")
    rotation = rotate.add_mutually_exclusive_group(required=True)
    rotation.add_argument("--quat", type=float, nargs=4, metavar=("X", "Y", "Z", "W"))
    rotation.add_argument("--euler-deg", type=float, nargs=3, metavar=("X", "Y", "Z"))
    add_json_arg(rotate)
    rotate.set_defaults(func=cmd_rotate)

    scale = subcommands.add_parser("scale", help="set or multiply an instance scale")
    add_layout_arg(scale)
    scale.add_argument("instance_id")
    scale_target = scale.add_mutually_exclusive_group(required=True)
    scale_target.add_argument("--to", type=float, nargs="+")
    scale_target.add_argument("--by", type=float, nargs="+")
    add_json_arg(scale)
    scale.set_defaults(func=cmd_scale)

    remove = subcommands.add_parser("remove", help="remove an instance from a layout")
    add_layout_arg(remove)
    remove.add_argument("instance_id")
    add_json_arg(remove)
    remove.set_defaults(func=cmd_remove)

    camera = subcommands.add_parser("camera", help="edit layout camera")
    camera_subcommands = camera.add_subparsers(dest="camera_command", required=True)
    camera_set = camera_subcommands.add_parser("set", help="set camera fields")
    add_layout_arg(camera_set)
    camera_set.add_argument("--pos", type=float, nargs=3, metavar=("X", "Y", "Z"))
    camera_set.add_argument("--target", type=float, nargs=3, metavar=("X", "Y", "Z"))
    camera_set.add_argument("--fov", type=float)
    add_json_arg(camera_set)
    camera_set.set_defaults(func=cmd_camera_set)
    camera_frame = camera_subcommands.add_parser("frame", help="frame an instance with the camera")
    add_layout_arg(camera_frame)
    camera_frame.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    camera_frame.add_argument("instance_id")
    camera_frame.add_argument("--fov", type=float)
    camera_frame.add_argument("--padding", type=float, default=1.7)
    add_json_arg(camera_frame)
    camera_frame.set_defaults(func=cmd_camera_frame)

    light = subcommands.add_parser("light", help="edit layout lighting")
    light_subcommands = light.add_subparsers(dest="light_command", required=True)
    light_preset = light_subcommands.add_parser("preset", help="apply a named lighting preset")
    add_layout_arg(light_preset)
    light_preset.add_argument("name", choices=sorted(LIGHTING_PRESETS))
    add_json_arg(light_preset)
    light_preset.set_defaults(func=cmd_light_preset)
    light_sun = light_subcommands.add_parser("sun", help="edit sun light fields")
    add_layout_arg(light_sun)
    light_sun.add_argument("--azimuth", type=float)
    light_sun.add_argument("--elevation", type=float)
    light_sun.add_argument("--strength", type=float)
    light_sun.add_argument("--angle", type=float)
    light_sun.add_argument("--color", type=float, nargs=3, metavar=("R", "G", "B"))
    add_json_arg(light_sun)
    light_sun.set_defaults(func=cmd_light_sun)

    validate = subcommands.add_parser("validate", help="validate a layout or manifest JSON file")
    validate.add_argument("paths", type=Path, nargs="+")
    validate.add_argument("--json", action="store_true")
    validate.set_defaults(func=cmd_validate)

    render = subcommands.add_parser("render", help="render a layout through Blender")
    render.add_argument("layout", nargs="?", default=str(DEFAULT_LAYOUT))
    render.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    render.add_argument("--output-dir", default=str(DEFAULT_RENDERS))
    render.add_argument("--width", type=int)
    render.add_argument("--height", type=int)
    render.add_argument("--samples", type=int)
    add_json_arg(render)
    render.set_defaults(func=cmd_render)
    return parser


def add_layout_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--layout", "-l", default=str(DEFAULT_LAYOUT))


def add_json_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json", action="store_true")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (ContractError, ValueError, json.JSONDecodeError) as exc:
        if getattr(args, "json", False):
            print_json({"ok": False, "error": str(exc)})
        else:
            print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
