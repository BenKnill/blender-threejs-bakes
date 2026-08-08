#!/usr/bin/env python3
"""Exercise the documented editor HTTP API without launching Blender."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import editor_server


class QuietEditorHandler(editor_server.EditorHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


class EditorServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory(prefix="editor-server-test-")
        cls.root = Path(cls.temp_dir.name).resolve()
        cls.live_layout = cls.root / "layouts" / "live.layout.json"
        cls.renders = cls.root / "renders"
        cls.manifest = cls.root / "assets" / "manifest.json"
        cls.blender = cls.root / "scripts" / "blender.sh"
        cls.render_script = cls.root / "scripts" / "render_layout.py"
        cls.manifest.parent.mkdir(parents=True)
        cls.manifest.write_text('{"generated":"test","assets":[]}\n', encoding="utf-8")

        cls.constants = mock.patch.multiple(
            editor_server,
            ROOT=cls.root,
            LIVE_LAYOUT=cls.live_layout,
            MANIFEST=cls.manifest,
            RENDERS=cls.renders,
            BLENDER=cls.blender,
            RENDER_SCRIPT=cls.render_script,
        )
        cls.constants.start()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietEditorHandler)
        cls.server.daemon_threads = True
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=2)
        cls.constants.stop()
        cls.temp_dir.cleanup()

    def setUp(self) -> None:
        if self.live_layout.exists():
            self.live_layout.unlink()
        shutil.rmtree(self.renders, ignore_errors=True)
        self.renders.mkdir()

    def request_json(self, method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=2) as response:
                return response.status, json.loads(response.read())
        except HTTPError as exc:
            with exc:
                return exc.code, json.loads(exc.read())

    def save_layout(self) -> dict:
        layout = {
            "schema": 1,
            "name": "api_test",
            "space": "threejs_yup",
            "instances": [],
            "camera": {
                "position": [3, 2, 4],
                "target": [0, 0, 0],
                "fov_deg": 45,
            },
            "render": {"width": 320, "height": 180, "samples": 1},
        }
        status, result = self.request_json("POST", "/api/save-layout", layout)
        self.assertEqual(status, 200, result)
        self.assertTrue(result["ok"])
        return {"layout": layout, "result": result}

    def test_save_layout_and_state_round_trip(self) -> None:
        saved = self.save_layout()
        self.assertTrue(self.live_layout.exists())
        status, state = self.request_json("GET", "/api/state")
        self.assertEqual(status, 200, state)
        self.assertEqual(state, saved["layout"])

    def test_render_layout_returns_new_render(self) -> None:
        saved = self.save_layout()

        def complete_render(*args: object, **kwargs: object) -> subprocess.CompletedProcess:
            del args, kwargs
            (self.renders / "api_test.png").write_bytes(b"png")
            return subprocess.CompletedProcess(["blender"], 0, "rendered", "")

        with mock.patch.object(editor_server.subprocess, "run", side_effect=complete_render):
            status, result = self.request_json(
                "POST",
                "/api/render-layout",
                {"layout": saved["result"]["layout_relative"]},
            )

        self.assertEqual(status, 200, result)
        self.assertTrue(result["ok"])
        self.assertEqual(result["new"][0]["name"], "api_test.png")

    def test_render_timeout_returns_structured_json(self) -> None:
        saved = self.save_layout()
        timeout = subprocess.TimeoutExpired(["blender"], editor_server.RENDER_TIMEOUT_SECONDS)

        with mock.patch.object(editor_server.subprocess, "run", side_effect=timeout):
            status, result = self.request_json(
                "POST",
                "/api/render-layout",
                {"layout": saved["result"]["layout_relative"]},
            )

        self.assertEqual(status, 504, result)
        self.assertEqual(result["error"], "Blender render timed out")
        self.assertEqual(result["timeout_seconds"], editor_server.RENDER_TIMEOUT_SECONDS)


if __name__ == "__main__":
    unittest.main()
