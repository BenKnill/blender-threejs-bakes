#!/usr/bin/env python3
"""Tests for the dependency-light bake telemetry wrapper."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from bake_telemetry import (
    SCHEMA,
    artifact_record,
    launch_background,
    parse_process_table,
    process_tree_rss_kib,
    read_status,
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
            self.assertEqual(data["schema"], SCHEMA)
            self.assertEqual(data["status"], "succeeded")
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
            data = json.loads(receipt.read_text())
            self.assertEqual(data["status"], "failed")
            self.assertEqual(data["exit_code"], 7)

    def test_missing_executable_is_receipted_as_failed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "failure.json"
            result = run_with_telemetry(
                [str(Path(directory) / "missing-command")],
                receipt_path=receipt,
                label="missing child",
                artifacts=[],
                interval_s=0.02,
            )
            self.assertEqual(result, 127)
            data = read_status(receipt)
            self.assertEqual(data["status"], "failed")
            self.assertIn("error", data)

    def test_fast_worker_completion_is_not_overwritten_by_launcher(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            receipt = root / "receipt.json"

            def finish_worker(*args, **kwargs):
                receipt.write_text(json.dumps({"status": "succeeded", "exit_code": 0}))
                return subprocess.CompletedProcess([], 0, "12345\n", "")

            with patch("bake_telemetry.subprocess.run", side_effect=finish_worker):
                launch_background(
                    [sys.executable, "-c", "pass"],
                    receipt_path=receipt,
                    label="fast worker",
                    artifacts=[],
                    interval_s=0.02,
                    status_interval_s=0.05,
                    log_path=root / "job.log",
                )
            self.assertEqual(read_status(receipt)["status"], "succeeded")

    def test_background_job_exposes_live_elapsed_log_and_completion(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "finished.txt"
            receipt = root / "background.telemetry.json"
            log = root / "background.log"
            child = (
                "import pathlib,time; time.sleep(0.25); "
                f"pathlib.Path({str(artifact)!r}).write_text('done'); print('finished')"
            )
            result = launch_background(
                [sys.executable, "-c", child],
                receipt_path=receipt,
                label="background unit child",
                artifacts=[artifact],
                interval_s=0.02,
                status_interval_s=0.05,
                log_path=log,
            )
            self.assertEqual(result, 0)
            observed_running = False
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                status = read_status(receipt)
                observed_running |= status["status"] in {
                    "launching",
                    "running",
                    "finalizing",
                }
                if status["status"] == "succeeded":
                    break
                time.sleep(0.03)
            self.assertTrue(observed_running)
            self.assertEqual(status["status"], "succeeded")
            self.assertGreater(status["live_elapsed_seconds"], 0.2)
            self.assertEqual(status["artifacts"][0]["size_bytes"], 4)
            self.assertIn("finished", log.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
