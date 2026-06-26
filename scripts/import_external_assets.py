#!/usr/bin/env python3
"""Import non-.blend assets into local .blend wrappers and editor proxies."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_proxies

ROOT = Path(__file__).resolve().parents[1]
SOURCE_BLEND_DIR = ROOT / "assets" / "source_blends"
MANIFEST_PATH = ROOT / "assets" / "manifest.json"

DEFAULT_ASSETS = [
    (
        "nasa_sls_core_stage",
        "NASA SLS Core Stage",
        "/Users/boxer/asset-menagerie/extracted/spaceflight/nasa-space-launch-system-core-stage/source/NASA Space Launch System Core Stage.glb",
    ),
    (
        "medieval_prop_crate",
        "Medieval Crate",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Prop_Crate.obj",
    ),
    (
        "medieval_prop_wagon",
        "Medieval Wagon",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Prop_Wagon.obj",
    ),
    (
        "medieval_prop_chimney",
        "Medieval Chimney",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Prop_Chimney.obj",
    ),
    (
        "medieval_wood_fence",
        "Medieval Wood Fence",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Prop_WoodenFence_Single.obj",
    ),
    (
        "medieval_wall_plaster",
        "Medieval Plaster Wall",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Wall_Plaster_Straight.obj",
    ),
    (
        "medieval_wall_door_round",
        "Medieval Round Door Wall",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Wall_UnevenBrick_Door_Round.obj",
    ),
    (
        "medieval_roof_tiles",
        "Medieval Roof Tiles",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Roof_RoundTiles_6x8.obj",
    ),
    (
        "medieval_stairs",
        "Medieval Stairs",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Stairs_Exterior_Straight.obj",
    ),
    (
        "medieval_window_round",
        "Medieval Round Window",
        "/Users/boxer/asset-menagerie/extracted/environment-kits/medieval-village-megakit-standard/Medieval Village MegaKit[Standard]/OBJ/Window_Wide_Round1.obj",
    ),
]


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_source(path: Path) -> None:
    suffix = path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
        return
    if suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(path))
        return
    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path))
        return
    raise ValueError(f"Unsupported asset type: {path}")


def wrap_scene_collection(collection_name: str) -> str:
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)
    for obj in list(bpy.context.scene.objects):
        for existing in list(obj.users_collection):
            existing.objects.unlink(obj)
        collection.objects.link(obj)
    return collection.name


def load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {"generated": None, "assets": []}


def upsert_asset(manifest: dict, asset: dict) -> None:
    manifest["assets"] = [item for item in manifest.get("assets", []) if item["id"] != asset["id"]]
    manifest["assets"].append(asset)
    manifest["assets"].sort(key=lambda item: item["name"])


def import_asset(asset_id: str, name: str, source_path: Path, args: argparse.Namespace) -> dict:
    reset_scene()
    import_source(source_path)
    collection = wrap_scene_collection(asset_id)
    bbox = export_proxies.bounds_xyz()

    SOURCE_BLEND_DIR.mkdir(parents=True, exist_ok=True)
    source_blend = SOURCE_BLEND_DIR / f"{asset_id}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend))

    glb_path = export_proxies.GLB_DIR / f"{asset_id}.glb"
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    proxy = export_proxies.export_proxy(
        glb_path,
        max_tris=args.max_tris,
        max_mb=args.max_proxy_mb,
    )
    return {
        "id": asset_id,
        "name": name,
        "glb": f"glb/{glb_path.name}",
        "source_blend": str(source_blend),
        "source_asset": str(source_path),
        "collection": collection,
        "bbox": bbox,
        "up_axis": "Z",
        "proxy": proxy,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-tris", type=int, default=50000)
    parser.add_argument("--max-proxy-mb", type=float, default=50.0)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)

    manifest = load_manifest()
    imported = []
    for asset_id, name, source in DEFAULT_ASSETS:
        source_path = Path(source)
        if not source_path.exists():
            print(f"skip missing: {source_path}")
            continue
        asset = import_asset(asset_id, name, source_path, args)
        imported.append(asset)
        upsert_asset(manifest, asset)

    manifest["generated"] = datetime.now(UTC).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"imported {len(imported)} external assets")


if __name__ == "__main__":
    main()
