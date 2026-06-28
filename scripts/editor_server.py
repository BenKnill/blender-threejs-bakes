#!/usr/bin/env python3
"""Serve the editor and expose local save/render endpoints."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from btlib.validate import ContractError, validate_layout

ROOT = Path(__file__).resolve().parents[1]
LIVE_LAYOUT = ROOT / "layouts" / "live.layout.json"
MANIFEST = ROOT / "assets" / "manifest.json"
RENDERS = ROOT / "renders"
BLENDER = ROOT / "scripts" / "blender.sh"
RENDER_SCRIPT = ROOT / "scripts" / "render_layout.py"


class EditorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "service": "editor_server"})
            return
        if self.path == "/api/renders":
            self.send_json({"renders": list_renders()})
            return
        super().do_GET()

    def do_POST(self) -> None:
        try:
            if self.path == "/api/save-layout":
                self.save_layout()
                return
            if self.path == "/api/render-layout":
                self.render_layout()
                return
            self.send_json({"error": "unknown endpoint"}, HTTPStatus.NOT_FOUND)
        except (ContractError, ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)

    def save_layout(self) -> None:
        layout = self.read_json()
        validate_layout(layout)
        LIVE_LAYOUT.parent.mkdir(exist_ok=True)
        layout_path = (
            LIVE_LAYOUT.parent / f"{timestamp_prefix()}_{layout_file_name(layout)}.layout.json"
        )
        layout_json = json.dumps(layout, indent=2) + "\n"
        layout_path.write_text(layout_json, encoding="utf-8")
        LIVE_LAYOUT.write_text(layout_json, encoding="utf-8")
        self.send_json(
            {
                "ok": True,
                "layout": str(layout_path),
                "layout_relative": str(layout_path.relative_to(ROOT)),
                "live_layout": str(LIVE_LAYOUT),
            }
        )

    def render_layout(self) -> None:
        payload = self.read_json()
        layout_path = (ROOT / payload.get("layout", str(LIVE_LAYOUT))).resolve()
        if not layout_path.is_relative_to(ROOT):
            self.send_json({"error": "layout path must stay inside repo"}, HTTPStatus.BAD_REQUEST)
            return
        if not layout_path.exists():
            self.send_json(
                {"error": f"layout does not exist: {layout_path}"}, HTTPStatus.BAD_REQUEST
            )
            return

        before = {path.name for path in RENDERS.glob("*.png")}
        cmd = [
            str(BLENDER),
            "--background",
            "--python",
            str(RENDER_SCRIPT),
            "--",
            str(layout_path),
            "--manifest",
            str(MANIFEST),
            "--output-dir",
            str(RENDERS),
        ]
        proc = subprocess.run(
            cmd, cwd=ROOT, capture_output=True, text=True, timeout=900, check=False
        )
        if proc.returncode != 0:
            self.send_json(
                {
                    "error": "Blender render failed",
                    "returncode": proc.returncode,
                    "stdout": proc.stdout[-4000:],
                    "stderr": proc.stderr[-4000:],
                },
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return
        renders = list_renders()
        new_renders = [render for render in renders if render["name"] not in before]
        if not new_renders:
            self.send_json(
                {
                    "error": "Blender reported success but wrote no render",
                    "stdout": proc.stdout[-4000:],
                    "stderr": proc.stderr[-4000:],
                },
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return
        self.send_json(
            {"ok": True, "stdout": proc.stdout[-4000:], "renders": renders, "new": new_renders}
        )

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        return json.loads(body)

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def timestamp_prefix() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d_%H-%M-%S-%f")[:-3] + "Z"


def safe_name(value: str) -> str:
    safe = "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in value)
    return safe.strip("_") or "composition"


def layout_file_name(layout: dict) -> str:
    raw_name = safe_name(layout["name"])
    if raw_name and raw_name not in {"first_composition", "composition"}:
        return raw_name
    asset_ids = [safe_name(item.get("asset_id", "")) for item in layout.get("instances", [])]
    asset_name = "_".join(dict.fromkeys(asset_id for asset_id in asset_ids if asset_id))
    return asset_name or "layout"


def list_renders() -> list[dict]:
    RENDERS.mkdir(exist_ok=True)
    paths = sorted(RENDERS.glob("*.png"), key=lambda path: path.stat().st_mtime, reverse=True)
    return [
        {
            "name": path.name,
            "url": f"/renders/{path.name}",
            "mtime": path.stat().st_mtime,
            "bytes": path.stat().st_size,
        }
        for path in paths
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), EditorHandler)
    print(f"Serving editor at http://127.0.0.1:{args.port}/editor/")
    server.serve_forever()


if __name__ == "__main__":
    main()
