"""Texture path discovery helpers shared by Blender and CLI tooling."""

from __future__ import annotations

import os
from pathlib import Path

IMAGE_EXTENSIONS = {".bmp", ".exr", ".jpeg", ".jpg", ".png", ".tga", ".tif", ".tiff", ".webp"}


def default_texture_roots(repo_root: Path) -> list[Path]:
    """Return existing texture search roots without requiring machine-specific paths."""

    candidates = [
        repo_root / "assets" / "textures",
        repo_root / "assets" / "source_textures",
        Path.home() / "asset-menagerie",
    ]
    env_roots = []
    for raw in os.environ.get("BT_TEXTURE_ROOTS", "").split(os.pathsep):
        if raw.strip():
            env_roots.append(Path(raw).expanduser())
    return existing_unique_paths([*env_roots, *candidates])


def existing_unique_paths(paths: list[Path]) -> list[Path]:
    unique = []
    seen = set()
    for path in paths:
        resolved = path.expanduser().resolve()
        if resolved in seen or not resolved.exists():
            continue
        unique.append(resolved)
        seen.add(resolved)
    return unique


def index_texture_basenames(roots: list[Path]) -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = {}
    for root in roots:
        if root.is_file():
            if root.suffix.lower() in IMAGE_EXTENSIONS:
                index.setdefault(root.name.lower(), []).append(root)
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                index.setdefault(path.name.lower(), []).append(path)
    for matches in index.values():
        matches.sort(key=texture_match_sort_key)
    return index


def texture_match_sort_key(path: Path) -> tuple[int, int, str]:
    parts = {part.lower() for part in path.parts}
    preferred_dir = 0 if "textures" in parts else 1
    return (preferred_dir, len(path.parts), str(path).lower())
