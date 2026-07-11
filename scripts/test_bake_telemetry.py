#!/usr/bin/env python3
"""Tests for the dependency-light bake telemetry wrapper."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from bake_telemetry import (
    artifact_record,
    parse_process_table,
    process_tree_rss_kib,
    run_with_telemetry,
)


class BakeTelemetryTests(unittest.TestCase):
    def test_process_tree_sums_root_and_descendants(self) -> None:
        rows = parse_process_table("10 1 100\n11 10 200\n12 11 300\n20 1 900\n")
        self.assertEqual(process_tree_rss_kib(10, rows), 600)

    def test_artifact_directory_is_recursive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.bin").write_bytes(b"abc")
            (root / "nested").mkdir()
            (root / "nested" / "b.bin").write_bytes(b"12345")
            self.assertEqual(
                artifact_record(root),
                {
                    "path": str(root),
                    "exists": True,
                    "kind": "directory",
                    "size_bytes": 8,
                    "file_count": 2,
                },
            )

    def test_receipt_records_memory_artifact_and_exit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "result.bin"
            receipt = root / "telemetry.json"
            child = (
                "import pathlib,time; "
                f"pathlib.Path({str(artifact)!r}).write_bytes(b'x' * 17); "
                "payload=bytearray(8_000_000); time.sleep(0.2); print(len(payload))"
            )
            result = run_with_telemetry(
                [sys.executable, "-c", child],
                receipt_path=receipt,
                label="unit child",
                artifacts=[artifact],
                interval_s=0.02,
            )
            self.assertEqual(result, 0)
            data = json.loads(receipt.read_text(encoding="utf-8"))
            self.assertEqual(data["schema"], "bake-telemetry/1")
            self.assertEqual(data["exit_code"], 0)
            self.assertGreater(data["wall_seconds"], 0.1)
            self.assertGreater(data["memory"]["peak_rss_bytes"], 1_000_000)
            self.assertEqual(data["artifacts"][0]["size_bytes"], 17)

    def test_failure_exit_is_preserved_and_receipted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "failure.json"
            result = run_with_telemetry(
                [sys.executable, "-c", "raise SystemExit(7)"],
                receipt_path=receipt,
                label="failing child",
                artifacts=[],
                interval_s=0.02,
            )
            self.assertEqual(result, 7)
            self.assertEqual(json.loads(receipt.read_text())["exit_code"], 7)


if __name__ == "__main__":
    unittest.main()
