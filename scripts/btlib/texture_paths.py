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


class LazyTextureIndex:
    """Basename index that scans its roots only on first lookup.

    Scanning a large or network-mounted menagerie (e.g. a WSL ``/mnt/k`` drive)
    can take minutes, and most renders never need a relink. Deferring the scan
    keeps that cost off every render that has no missing textures.
    """

    def __init__(self, roots: list[Path]):
        self.roots = list(roots)
        self._index: dict[str, list[Path]] | None = None

    @property
    def scanned(self) -> bool:
        return self._index is not None

    def _ensure(self) -> dict[str, list[Path]]:
        if self._index is None:
            self._index = index_texture_basenames(self.roots)
        return self._index

    def get(self, key: str, default=None):
        return self._ensure().get(key, default)

    def __getitem__(self, key: str) -> list[Path]:
        return self._ensure()[key]

    def __contains__(self, key: object) -> bool:
        return key in self._ensure()

    def __len__(self) -> int:
        return len(self._ensure())


def texture_match_sort_key(path: Path) -> tuple[int, int, str]:
    parts = {part.lower() for part in path.parts}
    preferred_dir = 0 if "textures" in parts else 1
    return (preferred_dir, len(path.parts), str(path).lower())
