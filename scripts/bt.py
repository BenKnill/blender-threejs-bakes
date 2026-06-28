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

from btlib.asset_metadata import agent_asset_metadata
from btlib.default_scale import default_drop_scale
from btlib.inspect import inspect_layout
from btlib.keyframes import layout_with_pose
from btlib.layout import (
    BLENDER,
    DEFAULT_LAYOUT,
    DEFAULT_MANIFEST,
    DEFAULT_RENDERS,
    RENDER_SCRIPT,
    TEXTURE_REPORT_SCRIPT,
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
from btlib.presets import (
    DEFAULT_PRESETS_DIR,
    check_preset_assets,
    find_preset,
    list_presets,
    preset_layout,
    validate_preset,
)
from btlib.validate import ContractError, validate_layout, validate_manifest


def validate_file(path: Path) -> None:
    data = load_json(path)
    if "layout" in data and "required_assets" in data:
        validate_preset(data)
    elif path.name == "manifest.json" or "assets" in data:
        validate_manifest(data, path, check_proxy_files=True)
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
            "default_scale": default_drop_scale(asset),
            **agent_asset_metadata(asset),
            "source_blend": asset["source_blend"],
            "glb": asset["glb"],
        }
        for asset in manifest["assets"]
    ]
    if args.json:
        print_json({"assets": assets})
        return 0
    print_table(
        ["id", "name", "category", "size", "health", "bbox", "default", "source"],
        [
            [
                asset["id"],
                asset["name"],
                asset["category"],
                asset["size_class"],
                ", ".join(asset["health_labels"]),
                vec_text(asset["bbox"]),
                f"{asset['default_scale']:g}",
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
    asset = asset_by_id(manifest, args.asset_id)
    instance_id = args.id or unique_instance_id(layout, args.asset_id)
    scale = scale_values(args.scale) if args.scale is not None else [default_drop_scale(asset)] * 3
    instance = {
        "instance_id": instance_id,
        "asset_id": args.asset_id,
        "position": args.at,
        "quaternion": [0, 0, 0, 1],
        "scale": scale,
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


def cmd_preset_list(args: argparse.Namespace) -> int:
    manifest = load_manifest(resolve_repo_path(args.manifest))
    presets_dir = resolve_repo_path(args.presets_dir)
    rows = []
    for preset in list_presets(presets_dir):
        missing_assets = check_preset_assets(preset, manifest)
        rows.append(
            {
                "id": preset["id"],
                "name": preset["name"],
                "description": preset["description"],
                "thumbnail": preset["thumbnail"],
                "required_assets": preset["required_assets"],
                "missing_assets": missing_assets,
            }
        )
    if args.json:
        print_json({"presets": rows})
    else:
        print_table(
            ["id", "name", "assets", "thumbnail", "status"],
            [
                [
                    row["id"],
                    row["name"],
                    str(len(row["required_assets"])),
                    row["thumbnail"] or "(deferred)",
                    "missing: " + ", ".join(row["missing_assets"])
                    if row["missing_assets"]
                    else "ok",
                ]
                for row in rows
            ],
        )
    return 0


def cmd_preset_show(args: argparse.Namespace) -> int:
    path, preset = find_preset(args.preset, resolve_repo_path(args.presets_dir))
    manifest = load_manifest(resolve_repo_path(args.manifest))
    missing_assets = check_preset_assets(preset, manifest)
    payload = {
        "ok": not missing_assets,
        "path": relative(path),
        "preset": preset,
        "missing_assets": missing_assets,
    }
    if args.json:
        print_json(payload)
    else:
        print(json.dumps(payload, indent=2))
    return 2 if missing_assets else 0


def cmd_preset_copy(args: argparse.Namespace) -> int:
    path, preset = find_preset(args.preset, resolve_repo_path(args.presets_dir))
    manifest = load_manifest(resolve_repo_path(args.manifest))
    missing_assets = check_preset_assets(preset, manifest)
    if missing_assets:
        raise ValueError(
            f"preset {preset['id']} references assets missing from manifest: "
            + ", ".join(missing_assets)
        )
    layout_path = resolve_repo_path(args.layout)
    if layout_path.exists() and not args.force:
        raise ValueError(f"layout exists; pass --force to overwrite: {layout_path}")
    layout = preset_layout(preset)
    write_layout(layout_path, layout)
    return print_result(
        {
            "ok": True,
            "preset": preset["id"],
            "preset_path": relative(path),
            "layout": relative(layout_path),
            "required_assets": preset["required_assets"],
            "thumbnail": preset["thumbnail"],
        },
        args.json,
    )


def cmd_inspect(args: argparse.Namespace) -> int:
    layout_path = resolve_repo_path(args.layout)
    layout = load_layout(layout_path)
    manifest = load_manifest(resolve_repo_path(args.manifest))
    report = inspect_layout(layout, manifest)
    report["layout"]["path"] = relative(layout_path)
    if args.json:
        print_json(report)
    else:
        print_inspect(report)
    return 0


def cmd_keyframes_camera_move(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    layout["schema"] = 3
    keyframes = layout.setdefault("keyframes", {})
    pose = keyframes.setdefault(args.pose, {})
    move = {"preset": args.preset}
    if args.amount is not None:
        move["amount"] = args.amount
    if args.degrees is not None:
        move["degrees"] = args.degrees
    pose["camera_move"] = move
    write_layout(path, layout)
    posed = layout_with_pose(layout, args.pose)
    return print_result(
        {
            "ok": True,
            "layout": relative(path),
            "pose": args.pose,
            "camera_move": move,
            "camera": posed["camera"],
        },
        args.json,
    )


def cmd_keyframes_clear(args: argparse.Namespace) -> int:
    path = resolve_repo_path(args.layout)
    layout = load_layout(path)
    layout.pop("keyframes", None)
    if layout.get("schema") == 3:
        layout["schema"] = 2
    write_layout(path, layout)
    return print_result({"ok": True, "layout": relative(path), "keyframes": None}, args.json)


def cmd_render(args: argparse.Namespace) -> int:
    layout = resolve_repo_path(args.layout)
    if not layout.exists():
        raise ValueError(f"layout does not exist: {layout}")
    output_dir = resolve_repo_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    before = {path.name for path in output_dir.glob("*.png")} if output_dir.exists() else set()
    poses = ["a", "b"] if args.pose == "both" else [args.pose]
    render_layout = prepare_render_layout(layout, args)
    rendered = []
    for pose in poses:
        result = run_render(render_layout, args, output_dir, pose)
        if result["returncode"] != 0:
            payload = {
                "ok": False,
                "pose": pose,
                "returncode": result["returncode"],
                "stdout": result["stdout"][-4000:],
                "stderr": result["stderr"][-4000:],
            }
            if args.json:
                print_json(payload)
            else:
                print(f"Blender render failed for pose {pose}", file=sys.stderr)
                print(result["stderr"][-4000:], file=sys.stderr)
            return 3
        rendered.append({"pose": pose, "stdout": result["stdout"][-4000:]})
    renders = sorted(output_dir.glob("*.png"), key=lambda path: path.stat().st_mtime, reverse=True)
    new = [render for render in renders if render.name not in before]
    payload = {
        "ok": True,
        "layout": relative(layout),
        "poses": rendered,
        "new": [render_metadata(path) for path in new],
        "renders": [render_metadata(path) for path in renders],
    }
    return print_result(payload, args.json)


def run_render(
    render_layout: Path, args: argparse.Namespace, output_dir: Path, pose: str
) -> dict[str, Any]:
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
        "--pose",
        "base" if pose == "base" else pose,
    ]
    proc = subprocess.run(cmd, cwd=resolve_repo_path("."), capture_output=True, text=True)
    return {"returncode": proc.returncode, "stdout": proc.stdout, "stderr": proc.stderr}


def cmd_textures(args: argparse.Namespace) -> int:
    cmd = [
        str(BLENDER),
        "--background",
        "--python",
        str(TEXTURE_REPORT_SCRIPT),
        "--",
        "--manifest",
        str(resolve_repo_path(args.manifest)),
    ]
    for asset_id in args.asset or []:
        cmd.extend(["--asset", asset_id])
    for source_blend in args.source_blend or []:
        cmd.extend(["--source-blend", str(resolve_repo_path(source_blend))])
    for texture_root in args.texture_root or []:
        cmd.extend(["--texture-root", str(resolve_repo_path(texture_root))])
    if args.relink:
        cmd.append("--relink")
    if args.save:
        cmd.append("--save")
    if args.json:
        cmd.append("--json")
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
            print("Blender texture diagnostic failed", file=sys.stderr)
            print(proc.stderr[-4000:], file=sys.stderr)
        return 3
    if args.json:
        print_json(extract_first_json_object(proc.stdout))
    else:
        print(proc.stdout, end="")
    return 0


def extract_first_json_object(text: str) -> Any:
    start = text.find("{")
    if start < 0:
        raise ValueError("Blender output did not contain a JSON object")
    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text[start:], start=start):
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])
    raise ValueError("Blender output contained incomplete JSON")


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


def print_inspect(report: dict[str, Any]) -> None:
    layout = report["layout"]
    camera = report["camera"]
    print(
        f"Layout {layout['name']} ({layout['path']}): "
        f"{layout['instance_count']} instance(s), schema {layout['schema']}"
    )
    print(
        "Camera: "
        f"pos {vec_text(camera['position'])}, target {vec_text(camera['target'])}, "
        f"fov {camera['fov_deg']:g}, aspect {camera['aspect']:g}"
    )
    lighting = report["lighting"]
    print(f"Lighting: {lighting['description']}")
    print()
    for instance in report["instances"]:
        cam = instance["camera"]
        ground = instance["ground"]
        print(f"{instance['instance_id']} ({instance['asset_id']})")
        print(
            f"  position three.js {vec_text(instance['positions']['threejs_yup'])}; "
            f"Blender {vec_text(instance['positions']['blender_zup'])}"
        )
        print(
            f"  size three.js {vec_text(instance['size']['threejs_yup'])}; "
            f"Blender {vec_text(instance['size']['blender_zup'])}"
        )
        clip = f"; clipped {', '.join(cam['clip_edges'])}" if cam["clip_edges"] else ""
        print(
            f"  camera {cam['status']}{clip}; "
            f"coverage {cam['screen_coverage']['width']:.0%}w x "
            f"{cam['screen_coverage']['height']:.0%}h; distance {cam['distance']:g}"
        )
        print(f"  ground {ground['status']}: {ground['note']}")
        for warning in instance["warnings"]:
            print(f"  warning: {warning}")
    overlaps = report["relationships"]["overlaps"]
    if overlaps:
        print()
        print("Relationships:")
        for overlap in overlaps:
            print(
                f"  {overlap['a']} overlaps {overlap['b']} by {vec_text(overlap['overlap_size'])}"
            )
    warnings = report["summary"]["warnings"]
    print()
    print(
        "Summary: "
        f"{report['summary']['in_frame']} in-frame, "
        f"{report['summary']['partially_clipped']} partially clipped, "
        f"{report['summary']['off_screen']} off-screen, "
        f"{len(warnings)} warning(s)"
    )
    for warning in warnings:
        print(f"  warning: {warning}")


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
    place.add_argument("--scale", type=float, nargs="+")
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

    preset = subcommands.add_parser("preset", help="list, show, or copy composition presets")
    preset_subcommands = preset.add_subparsers(dest="preset_command", required=True)
    preset_list = preset_subcommands.add_parser("list", help="list available composition presets")
    preset_list.add_argument("--presets-dir", default=str(DEFAULT_PRESETS_DIR))
    preset_list.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    add_json_arg(preset_list)
    preset_list.set_defaults(func=cmd_preset_list)
    preset_show = preset_subcommands.add_parser("show", help="show a composition preset")
    preset_show.add_argument("preset")
    preset_show.add_argument("--presets-dir", default=str(DEFAULT_PRESETS_DIR))
    preset_show.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    add_json_arg(preset_show)
    preset_show.set_defaults(func=cmd_preset_show)
    preset_copy = preset_subcommands.add_parser("copy", help="copy a preset to a layout file")
    preset_copy.add_argument("preset")
    preset_copy.add_argument("--layout", "-l", required=True)
    preset_copy.add_argument("--presets-dir", default=str(DEFAULT_PRESETS_DIR))
    preset_copy.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    preset_copy.add_argument("--force", action="store_true")
    add_json_arg(preset_copy)
    preset_copy.set_defaults(func=cmd_preset_copy)
    preset_load = preset_subcommands.add_parser(
        "load",
        help="load a preset into a layout file; defaults to layouts/live.layout.json",
    )
    preset_load.add_argument("preset")
    preset_load.add_argument("--layout", "-l", default=str(DEFAULT_LAYOUT))
    preset_load.add_argument("--presets-dir", default=str(DEFAULT_PRESETS_DIR))
    preset_load.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    preset_load.add_argument("--force", action="store_true")
    add_json_arg(preset_load)
    preset_load.set_defaults(func=cmd_preset_copy)

    validate = subcommands.add_parser("validate", help="validate a layout or manifest JSON file")
    validate.add_argument("paths", type=Path, nargs="+")
    validate.add_argument("--json", action="store_true")
    validate.set_defaults(func=cmd_validate)

    inspect = subcommands.add_parser("inspect", help="describe layout geometry for agents")
    inspect.add_argument("layout", nargs="?", default=str(DEFAULT_LAYOUT))
    inspect.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    add_json_arg(inspect)
    inspect.set_defaults(func=cmd_inspect)

    keyframes = subcommands.add_parser("keyframes", help="edit A/B keyframe poses")
    keyframe_subcommands = keyframes.add_subparsers(dest="keyframe_command", required=True)
    camera_move = keyframe_subcommands.add_parser("camera-move", help="set a pose camera move")
    add_layout_arg(camera_move)
    camera_move.add_argument(
        "preset",
        choices=[
            "push_in",
            "pull_out",
            "orbit_left",
            "orbit_right",
            "crane_up",
            "dolly",
            "whip",
        ],
    )
    camera_move.add_argument("--pose", choices=("a", "b"), default="b")
    camera_move.add_argument("--amount", type=float)
    camera_move.add_argument("--degrees", type=float)
    add_json_arg(camera_move)
    camera_move.set_defaults(func=cmd_keyframes_camera_move)
    clear = keyframe_subcommands.add_parser("clear", help="remove keyframes from a layout")
    add_layout_arg(clear)
    add_json_arg(clear)
    clear.set_defaults(func=cmd_keyframes_clear)

    render = subcommands.add_parser("render", help="render a layout through Blender")
    render.add_argument("layout", nargs="?", default=str(DEFAULT_LAYOUT))
    render.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    render.add_argument("--output-dir", default=str(DEFAULT_RENDERS))
    render.add_argument("--width", type=int)
    render.add_argument("--height", type=int)
    render.add_argument("--samples", type=int)
    render.add_argument("--pose", choices=("base", "a", "b", "both"), default="base")
    add_json_arg(render)
    render.set_defaults(func=cmd_render)

    textures = subcommands.add_parser(
        "textures",
        help="diagnose source blend material image links through Blender",
    )
    textures.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    textures.add_argument("--asset", action="append", help="manifest asset id to inspect")
    textures.add_argument("--source-blend", type=Path, action="append", default=[])
    textures.add_argument("--texture-root", type=Path, action="append", default=[])
    textures.add_argument("--relink", action="store_true", help="relink missing images in memory")
    textures.add_argument("--save", action="store_true", help="save relinked source blends")
    add_json_arg(textures)
    textures.set_defaults(func=cmd_textures)
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
