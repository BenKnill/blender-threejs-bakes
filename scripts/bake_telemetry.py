#!/usr/bin/env python3
"""Run a bake stage while recording wall time, process-tree RSS, and artifact sizes."""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import subprocess
import time
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path


def parse_process_table(output: str) -> list[tuple[int, int, int]]:
    rows = []
    for line in output.splitlines():
        fields = line.split()
        if len(fields) != 3:
            continue
        try:
            rows.append(tuple(int(value) for value in fields))
        except ValueError:
            continue
    return rows


def process_tree_rss_kib(root_pid: int, rows: Iterable[tuple[int, int, int]]) -> int:
    children: dict[int, list[int]] = {}
    rss: dict[int, int] = {}
    for pid, parent_pid, rss_kib in rows:
        children.setdefault(parent_pid, []).append(pid)
        rss[pid] = rss_kib
    total = 0
    pending = [root_pid]
    visited = set()
    while pending:
        pid = pending.pop()
        if pid in visited:
            continue
        visited.add(pid)
        total += rss.get(pid, 0)
        pending.extend(children.get(pid, ()))
    return total


def sample_rss_kib(root_pid: int) -> int | None:
    ps = shutil.which("ps")
    if ps is None:
        return None
    completed = subprocess.run(
        [ps, "-axo", "pid=,ppid=,rss="],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return None
    return process_tree_rss_kib(root_pid, parse_process_table(completed.stdout))


def artifact_record(path: Path) -> dict:
    record = {"path": str(path), "exists": path.exists()}
    if not path.exists():
        return record
    if path.is_file():
        record.update({"kind": "file", "size_bytes": path.stat().st_size, "file_count": 1})
        return record
    files = [item for item in path.rglob("*") if item.is_file()]
    record.update(
        {
            "kind": "directory",
            "size_bytes": sum(item.stat().st_size for item in files),
            "file_count": len(files),
        }
    )
    return record


def run_with_telemetry(
    command: list[str],
    *,
    receipt_path: Path,
    label: str,
    artifacts: list[Path],
    interval_s: float,
) -> int:
    if not command:
        raise ValueError("telemetry command must not be empty")
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    started_at = datetime.now(UTC)
    started = time.perf_counter()
    process = subprocess.Popen(command)
    peak_rss_kib = 0
    rss_available = False
    sample_count = 0
    try:
        while True:
            sample = sample_rss_kib(process.pid)
            sample_count += 1
            if sample is not None:
                rss_available = True
                peak_rss_kib = max(peak_rss_kib, sample)
            return_code = process.poll()
            if return_code is not None:
                break
            time.sleep(interval_s)
    except KeyboardInterrupt:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        return_code = 130
    wall_seconds = time.perf_counter() - started
    receipt = {
        "schema": "bake-telemetry/1",
        "label": label,
        "command": command,
        "cwd": str(Path.cwd()),
        "started_at": started_at.isoformat(),
        "wall_seconds": wall_seconds,
        "exit_code": return_code,
        "platform": platform.platform(),
        "memory": {
            "metric": "sampled process-tree resident set size",
            "peak_rss_bytes": peak_rss_kib * 1024 if rss_available else None,
            "sample_interval_seconds": interval_s,
            "sample_count": sample_count,
            "source": "ps -axo pid=,ppid=,rss=" if rss_available else "unavailable",
        },
        "artifacts": [artifact_record(path) for path in artifacts],
    }
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return return_code


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--artifact", type=Path, action="append", default=[])
    parser.add_argument("--interval", type=float, default=0.1)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if args.interval <= 0:
        parser.error("--interval must be positive")
    if not command:
        parser.error("a command is required after --")
    return run_with_telemetry(
        command,
        receipt_path=args.receipt,
        label=args.label,
        artifacts=args.artifact,
        interval_s=args.interval,
    )


if __name__ == "__main__":
    raise SystemExit(main())
