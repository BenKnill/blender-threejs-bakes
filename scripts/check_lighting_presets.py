#!/usr/bin/env python3
"""Check that browser and CLI lighting presets have not drifted."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from btlib.lighting import LIGHTING_PRESETS  # noqa: E402


def node_bin() -> str:
    local_node = Path.home() / ".local" / "bin" / "node"
    if local_node.is_file() and os.access(local_node, os.X_OK):
        return str(local_node)
    return "node"


def main() -> int:
    browser_presets = load_browser_presets()
    normalized_browser = {
        name: {key: value for key, value in preset.items() if key != "label"}
        for name, preset in browser_presets.items()
    }
    if normalized_browser != LIGHTING_PRESETS:
        print(
            "lighting preset drift detected between editor/lighting.js and btlib", file=sys.stderr
        )
        print(
            json.dumps(
                {
                    "browser_only": sorted(set(normalized_browser) - set(LIGHTING_PRESETS)),
                    "cli_only": sorted(set(LIGHTING_PRESETS) - set(normalized_browser)),
                    "browser": normalized_browser,
                    "cli": LIGHTING_PRESETS,
                },
                indent=2,
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 1
    print(f"ok: {len(LIGHTING_PRESETS)} lighting presets match")
    return 0


def load_browser_presets() -> dict[str, Any]:
    script = """
      import('./editor/lighting.js')
        .then((module) => console.log(JSON.stringify(module.LIGHTING_PRESETS)))
        .catch((error) => {
          console.error(error);
          process.exit(1);
        });
    """
    result = subprocess.run(
        [node_bin(), "--input-type=module", "-e", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


if __name__ == "__main__":
    raise SystemExit(main())
