#!/usr/bin/env python3
"""Export lightweight GLB proxies and a manifest from source .blend files."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from asset_texture_report import inspect_current_file  # noqa: E402 -- Blender --python path setup.
from btlib.texture_paths import (  # noqa: E402 -- Blender --python path setup.
    default_texture_roots,
    index_texture_basenames,
)

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "manifest.json"
GLB_DIR = ROOT / "assets" / "glb"


def slugify(path: Path) -> str:
    stem = re.sub(r"_[0-9a-f]{8,}.*$", "", path.stem, flags=re.IGNORECASE)
    stem = re.sub(r"[^a-zA-Z0-9]+", "_", stem).strip("_").lower()
    return stem or path.stem.lower()


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def append_first_collection(blend_path: Path) -> str:
    with bpy.data.libraries.load(str(blend_path), link=False) as (data_from, data_to):
        if data_from.collections:
            data_to.collections = [data_from.collections[0]]
        elif data_from.objects:
            data_to.objects = list(data_from.objects)
        else:
            raise RuntimeError(f"No collections or objects in {blend_path}")

    appended_collection_name = ""
    for collection in data_to.collections:
        if collection:
            bpy.context.scene.collection.children.link(collection)
            appended_collection_name = collection.name

    if data_to.objects:
        collection = bpy.data.collections.new(slugify(blend_path))
        bpy.context.scene.collection.children.link(collection)
        for obj in data_to.objects:
            if obj:
                collection.objects.link(obj)
        appended_collection_name = collection.name

    return appended_collection_name


def visible_mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.visible_get()]


def bounds_xyz() -> list[float]:
    points = []
    for obj in visible_mesh_objects():
        matrix = obj.matrix_world
        points.extend(matrix @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return [1.0, 1.0, 1.0]
    low = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    high = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    size = high - low
    return [round(size.x, 4), round(size.y, 4), round(size.z, 4)]


def triangle_count() -> int:
    total = 0
    for obj in visible_mesh_objects():
        total += sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)
    return total


def add_decimate_modifiers(max_tris: int) -> float:
    tris = triangle_count()
    if tris <= max_tris:
        return 1.0
    ratio = max(0.01, max_tris / tris)
    for obj in visible_mesh_objects():
        modifier = obj.modifiers.new("proxy_decimate", "DECIMATE")
        modifier.ratio = ratio
    return ratio


def export_glb(out_path: Path, *, lightweight: bool = False) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in visible_mesh_objects():
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=False,
        export_normals=True,
        export_materials="PLACEHOLDER" if lightweight else "EXPORT",
        export_image_format="NONE" if lightweight else "AUTO",
    )


def export_proxy(out_path: Path, *, max_tris: int, max_mb: float) -> dict:
    original_tris = triangle_count()
    export_glb(out_path)
    original_mb = out_path.stat().st_size / (1024 * 1024)
    if original_mb <= max_mb:
        return {
            "mode": "full",
            "triangles_before": original_tris,
            "triangles_target": None,
            "size_mb": round(original_mb, 3),
        }

    decimate_ratio = add_decimate_modifiers(max_tris)
    export_glb(out_path, lightweight=True)
    lightweight_mb = out_path.stat().st_size / (1024 * 1024)
    return {
        "mode": "lightweight",
        "triangles_before": original_tris,
        "triangles_target": max_tris,
        "decimate_ratio": round(decimate_ratio, 6),
        "full_size_mb": round(original_mb, 3),
        "size_mb": round(lightweight_mb, 3),
    }


def repo_path(path: Path) -> Path:
    expanded = path.expanduser()
    if expanded.is_absolute():
        return expanded
    return ROOT / expanded


def proxy_path(asset: dict) -> Path:
    glb = Path(asset["glb"])
    if glb.is_absolute():
        return glb
    return ROOT / "assets" / glb


def source_path(asset: dict) -> Path:
    return Path(asset["source_blend"]).expanduser()


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def select_manifest_assets(
    manifest: dict, *, asset_ids: list[str], missing_only: bool
) -> list[dict]:
    selected = []
    requested = set(asset_ids)
    for asset in manifest["assets"]:
        if requested and asset["id"] not in requested:
            continue
        if missing_only and proxy_path(asset).exists():
            continue
        selected.append(asset)
    return selected


def dry_run_manifest_bootstrap(manifest_path: Path, assets: list[dict]) -> None:
    missing_sources = [
        {"id": asset["id"], "source_blend": str(source_path(asset))}
        for asset in assets
        if not source_path(asset).exists()
    ]
    planned = [
        {
            "id": asset["id"],
            "glb": str(proxy_path(asset)),
            "source_blend": str(source_path(asset)),
            "source_exists": source_path(asset).exists(),
        }
        for asset in assets
    ]
    print(
        json.dumps(
            {
                "ok": not missing_sources,
                "dry_run": True,
                "manifest": str(manifest_path),
                "planned_count": len(planned),
                "missing_source_count": len(missing_sources),
                "missing_sources": missing_sources,
                "assets": planned,
            },
            indent=2,
        )
    )


def export_manifest_asset(
    asset: dict,
    *,
    texture_index: dict,
    max_tris: int,
    max_proxy_mb: float,
) -> tuple[dict, dict]:
    blend_path = source_path(asset).resolve()
    if not blend_path.exists():
        raise FileNotFoundError(f"source_blend does not exist for {asset['id']}: {blend_path}")
    glb_path = proxy_path(asset)
    glb_path.parent.mkdir(parents=True, exist_ok=True)

    reset_scene()
    collection_name = append_first_collection(blend_path)
    texture_report = inspect_current_file(texture_index, relink=True)
    bbox = bounds_xyz()
    proxy = export_proxy(glb_path, max_tris=max_tris, max_mb=max_proxy_mb)
    updated = {
        **asset,
        "name": asset.get("name", asset["id"].replace("_", " ").title()),
        "source_blend": str(blend_path),
        "collection": collection_name,
        "bbox": bbox,
        "up_axis": asset.get("up_axis", "Z"),
        "proxy": proxy,
        "texture_warnings": {
            "missing_count": texture_report["missing_count"],
            "relinked_count": texture_report["relinked_count"],
        },
    }
    receipt_asset = {
        "id": updated["id"],
        "source_blend": updated["source_blend"],
        "source_mtime": blend_path.stat().st_mtime,
        "glb": str(glb_path),
        "collection": updated["collection"],
        "bbox": updated["bbox"],
        "proxy": updated["proxy"],
        "texture_warnings": updated["texture_warnings"],
    }
    return updated, receipt_asset


def export_source_asset(
    blend_path: Path,
    *,
    texture_index: dict,
    max_tris: int,
    max_proxy_mb: float,
) -> tuple[dict, dict]:
    asset_id = slugify(blend_path)
    asset = {
        "id": asset_id,
        "name": asset_id.replace("_", " ").title(),
        "glb": f"glb/{asset_id}.glb",
        "source_blend": str(blend_path),
    }
    return export_manifest_asset(
        asset,
        texture_index=texture_index,
        max_tris=max_tris,
        max_proxy_mb=max_proxy_mb,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path)
    parser.add_argument("--asset", type=Path, action="append", default=[])
    parser.add_argument(
        "--manifest",
        type=Path,
        help="rebuild proxies from an existing manifest's source_blend entries",
    )
    parser.add_argument(
        "--asset-id", action="append", default=[], help="manifest asset id to export"
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="with --manifest, export only entries whose GLB proxy is missing",
    )
    parser.add_argument("--dry-run", action="store_true", help="print the manifest bootstrap plan")
    parser.add_argument("--limit", type=int, default=12)
    parser.add_argument("--max-tris", type=int, default=50000)
    parser.add_argument("--max-proxy-mb", type=float, default=50.0)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)
    if not args.manifest and not args.source_dir and not args.asset:
        parser.error("one of --manifest, --source-dir, or --asset is required")
    if not args.manifest and (args.asset_id or args.missing_only):
        parser.error("--asset-id and --missing-only require --manifest")

    GLB_DIR.mkdir(parents=True, exist_ok=True)
    texture_roots = default_texture_roots(ROOT)
    texture_index = index_texture_basenames(texture_roots)

    generated = datetime.now(UTC).isoformat()
    receipt_assets = []
    if args.manifest:
        manifest_path = repo_path(args.manifest).resolve()
        manifest = load_manifest(manifest_path)
        selected = select_manifest_assets(
            manifest,
            asset_ids=args.asset_id,
            missing_only=args.missing_only,
        )
        if args.dry_run:
            dry_run_manifest_bootstrap(manifest_path, selected)
            return

        updated_assets = []
        selected_ids = {asset["id"] for asset in selected}
        for asset in manifest["assets"]:
            if asset["id"] not in selected_ids:
                updated_assets.append(asset)
                continue
            updated, receipt_asset = export_manifest_asset(
                asset,
                texture_index=texture_index,
                max_tris=args.max_tris,
                max_proxy_mb=args.max_proxy_mb,
            )
            updated_assets.append(updated)
            receipt_assets.append(receipt_asset)
        manifest = {**manifest, "generated": generated, "assets": updated_assets}
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    else:
        blend_paths = [path.expanduser().resolve() for path in args.asset]
        if args.source_dir:
            blend_paths.extend(sorted(args.source_dir.glob("*.blend"))[: args.limit])
        assets = []
        for blend_path in blend_paths:
            asset, receipt_asset = export_source_asset(
                blend_path,
                texture_index=texture_index,
                max_tris=args.max_tris,
                max_proxy_mb=args.max_proxy_mb,
            )
            assets.append(asset)
            receipt_assets.append(receipt_asset)
        manifest = {"generated": generated, "assets": assets}
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    receipt = {
        "generated": generated,
        "manifest_mode": bool(args.manifest),
        "missing_only": args.missing_only,
        "source_dir": str(args.source_dir) if args.source_dir else None,
        "asset_args": [str(path) for path in args.asset],
        "asset_ids": args.asset_id,
        "limit": args.limit,
        "blender_version": bpy.app.version_string,
        "manifest": str(repo_path(args.manifest).resolve() if args.manifest else MANIFEST_PATH),
        "texture_roots": [str(path) for path in texture_roots],
        "assets": receipt_assets,
        "missing_texture_warning_count": sum(
            asset["texture_warnings"]["missing_count"] for asset in receipt_assets
        ),
    }
    (MANIFEST_PATH.parent / "manifest.receipt.json").write_text(
        json.dumps(receipt, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
