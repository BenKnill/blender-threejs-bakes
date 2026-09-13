"""Resolve manifest ``source_blend`` paths on machines other than the authoring host.

The manifest records absolute paths from the machine that authored it (for
example ``/Users/boxer/asset-menagerie/...``). ``BT_SOURCE_BLEND_MAP`` holds
``old_prefix=new_prefix`` pairs separated by ``os.pathsep``. When no explicit
map matches and the recorded path is missing, any ``.../asset-menagerie/<rest>``
path is retried under ``~/asset-menagerie/<rest>`` so a symlinked or mounted
menagerie works without editing the manifest.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_VAR = "BT_SOURCE_BLEND_MAP"
MENAGERIE_DIR = "asset-menagerie"


def source_blend_map() -> list[tuple[str, str]]:
    pairs = []
    for raw in os.environ.get(ENV_VAR, "").split(os.pathsep):
        if "=" not in raw:
            continue
        old, new = raw.split("=", 1)
        if old and new:
            pairs.append((old.rstrip("/"), str(Path(new).expanduser()).rstrip("/")))
    return pairs


def resolve_source_blend(raw: str | Path, root: Path | None = None) -> Path:
    path = Path(raw).expanduser()
    if not path.is_absolute() and root is not None:
        path = root / path
    if path.exists():
        return path
    text = str(path)
    for old, new in source_blend_map():
        if text == old or text.startswith(old + "/"):
            candidate = Path(new + text[len(old) :])
            if candidate.exists():
                return candidate
    marker = f"/{MENAGERIE_DIR}/"
    if marker in text:
        candidate = Path.home() / MENAGERIE_DIR / text.split(marker, 1)[1]
        if candidate.exists():
            return candidate
    return path
