#!/usr/bin/env python3
"""Run or launch a bake stage with live elapsed, memory, log, and artifact receipts."""

from __future__ import annotations

import argparse
import json
import os
import platform
import shlex
import shutil
import subprocess
import sys
import time
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = "bake-telemetry/2"
PAGE_KIB = max(1, os.sysconf("SC_PAGE_SIZE") // 1024) if hasattr(os, "sysconf") else 4


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


def proc_process_table() -> list[tuple[int, int, int]] | None:
    """Read pid/ppid/rss straight from /proc when available.

    ``ps`` walks every process and on hosts with a large process table (WSL
    routinely accumulates thousands) one call can take hundreds of
    milliseconds, which is slower than the sampling interval and misses
    short-lived children entirely.
    """

    proc = Path("/proc")
    if not proc.is_dir():
        return None
    rows = []
    for entry in proc.iterdir():
        if not entry.name.isdigit():
            continue
        try:
            stat = (entry / "stat").read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        # Field 2 (comm) may contain spaces; split after its closing paren.
        rest = stat.rsplit(")", 1)[-1].split()
        if len(rest) < 22:
            continue
        rows.append((int(entry.name), int(rest[1]), int(rest[21]) * PAGE_KIB))
    return rows


def sample_rss_kib(root_pid: int) -> int | None:
    rows = proc_process_table()
    if rows is not None:
        return process_tree_rss_kib(root_pid, rows)
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


def write_json_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def running_artifact_record(path: Path) -> dict:
    return {"path": str(path), "exists": path.exists()}


def telemetry_receipt(
    *,
    command: list[str],
    label: str,
    started_at: datetime,
    elapsed_seconds: float,
    status: str,
    exit_code: int | None,
    pid: int,
    peak_rss_kib: int,
    rss_available: bool,
    interval_s: float,
    sample_count: int,
    artifacts: list[Path],
    log_path: Path | None,
    final: bool,
) -> dict:
    artifact_records = [
        artifact_record(path) if final else running_artifact_record(path) for path in artifacts
    ]
    return {
        "schema": SCHEMA,
        "label": label,
        "status": status,
        "command": command,
        "cwd": str(Path.cwd()),
        "pid": pid,
        "started_at": started_at.isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": elapsed_seconds,
        "wall_seconds": elapsed_seconds if final else None,
        "exit_code": exit_code,
        "log_path": str(log_path) if log_path is not None else None,
        "platform": platform.platform(),
        "memory": {
            "metric": "sampled process-tree resident set size",
            "peak_rss_bytes": peak_rss_kib * 1024 if rss_available else None,
            "sample_interval_seconds": interval_s,
            "sample_count": sample_count,
            "source": ("/proc/<pid>/stat" if Path("/proc").is_dir() else "ps -axo pid=,ppid=,rss=")
            if rss_available
            else "unavailable",
        },
        "artifacts": artifact_records,
    }


def run_with_telemetry(
    command: list[str],
    *,
    receipt_path: Path,
    label: str,
    artifacts: list[Path],
    interval_s: float,
    status_interval_s: float = 1.0,
    log_path: Path | None = None,
) -> int:
    if not command:
        raise ValueError("telemetry command must not be empty")
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    started_at = datetime.now(UTC)
    started = time.perf_counter()
    try:
        process = subprocess.Popen(command)
    except OSError as error:
        receipt = telemetry_receipt(
            command=command,
            label=label,
            started_at=started_at,
            elapsed_seconds=time.perf_counter() - started,
            status="failed",
            exit_code=127,
            pid=os.getpid(),
            peak_rss_kib=0,
            rss_available=False,
            interval_s=interval_s,
            sample_count=0,
            artifacts=artifacts,
            log_path=log_path,
            final=True,
        )
        receipt["error"] = str(error)
        write_json_atomic(receipt_path, receipt)
        return 127
    peak_rss_kib = 0
    rss_available = False
    sample_count = 0
    next_status_write = started
    return_code: int
    try:
        while True:
            sample = sample_rss_kib(process.pid)
            sample_count += 1
            if sample is not None:
                rss_available = True
                peak_rss_kib = max(peak_rss_kib, sample)
            return_code = process.poll()
            now = time.perf_counter()
            if now >= next_status_write or return_code is not None:
                write_json_atomic(
                    receipt_path,
                    telemetry_receipt(
                        command=command,
                        label=label,
                        started_at=started_at,
                        elapsed_seconds=now - started,
                        status="running" if return_code is None else "finalizing",
                        exit_code=return_code,
                        pid=process.pid,
                        peak_rss_kib=peak_rss_kib,
                        rss_available=rss_available,
                        interval_s=interval_s,
                        sample_count=sample_count,
                        artifacts=artifacts,
                        log_path=log_path,
                        final=False,
                    ),
                )
                next_status_write = now + status_interval_s
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
    status = "succeeded" if return_code == 0 else "interrupted" if return_code == 130 else "failed"
    write_json_atomic(
        receipt_path,
        telemetry_receipt(
            command=command,
            label=label,
            started_at=started_at,
            elapsed_seconds=wall_seconds,
            status=status,
            exit_code=return_code,
            pid=process.pid,
            peak_rss_kib=peak_rss_kib,
            rss_available=rss_available,
            interval_s=interval_s,
            sample_count=sample_count,
            artifacts=artifacts,
            log_path=log_path,
            final=True,
        ),
    )
    return return_code


def background_command(
    *,
    receipt_path: Path,
    label: str,
    artifacts: list[Path],
    interval_s: float,
    status_interval_s: float,
    log_path: Path,
    command: list[str],
) -> list[str]:
    arguments = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--receipt",
        str(receipt_path),
        "--label",
        label,
        "--interval",
        str(interval_s),
        "--status-interval",
        str(status_interval_s),
        "--log",
        str(log_path),
    ]
    for artifact in artifacts:
        arguments.extend(["--artifact", str(artifact)])
    arguments.extend(["--", *command])
    return arguments


def process_exists(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except (OSError, ValueError):
        return False
    return True


def archive_previous_receipt(receipt_path: Path) -> Path | None:
    if not receipt_path.exists():
        return None
    previous = json.loads(receipt_path.read_text(encoding="utf-8"))
    previous_status = previous.get("status")
    previous_pid = previous.get("pid")
    if (
        previous_status in {"launching", "running", "finalizing"}
        and isinstance(previous_pid, int)
        and process_exists(previous_pid)
    ):
        raise RuntimeError(
            f"job is already {previous_status} with pid {previous_pid}: {receipt_path}"
        )
    history = receipt_path.parent / "history"
    history.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    archived = history / f"{receipt_path.stem}-{stamp}.json"
    shutil.copy2(receipt_path, archived)
    return archived


def launch_background(
    command: list[str],
    *,
    receipt_path: Path,
    label: str,
    artifacts: list[Path],
    interval_s: float,
    status_interval_s: float,
    log_path: Path,
) -> int:
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    archived_receipt = archive_previous_receipt(receipt_path)
    started_at = datetime.now(UTC)
    worker_command = background_command(
        receipt_path=receipt_path,
        label=label,
        artifacts=artifacts,
        interval_s=interval_s,
        status_interval_s=status_interval_s,
        log_path=log_path,
        command=command,
    )
    log_path.touch()
    shell = shutil.which("sh")
    if shell is None:
        raise RuntimeError("background launch requires a POSIX sh")
    detached_prefix = []
    if shutil.which("nohup") is not None:
        detached_prefix.append("nohup")
    if shutil.which("setsid") is not None:
        detached_prefix.append("setsid")
    detached_command = shlex.join([*detached_prefix, *worker_command])
    launch_line = f"{detached_command} >> {shlex.quote(str(log_path))} 2>&1 < /dev/null & echo $!"
    # Publish before spawning: the worker is the sole writer after launch.
    write_json_atomic(
        receipt_path,
        {
            "schema": SCHEMA,
            "label": label,
            "status": "launching",
            "command": command,
            "cwd": str(Path.cwd()),
            "pid": os.getpid(),
            "started_at": started_at.isoformat(),
            "updated_at": started_at.isoformat(),
            "elapsed_seconds": 0.0,
            "wall_seconds": None,
            "exit_code": None,
            "log_path": str(log_path),
            "platform": platform.platform(),
            "memory": None,
            "artifacts": [running_artifact_record(path) for path in artifacts],
        },
    )
    launched = subprocess.run(
        [shell, "-c", launch_line],
        capture_output=True,
        text=True,
        check=False,
    )
    if launched.returncode != 0:
        raise RuntimeError(f"background launch failed: {launched.stderr.strip()}")
    worker_pid = int(launched.stdout.strip())
    print(
        json.dumps(
            {
                "status": "launching",
                "worker_pid": worker_pid,
                "receipt": str(receipt_path),
                "log": str(log_path),
                "archived_receipt": (
                    str(archived_receipt) if archived_receipt is not None else None
                ),
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def read_status(receipt_path: Path) -> dict:
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    observed_at = datetime.now(UTC)
    receipt["observed_at"] = observed_at.isoformat()
    if receipt.get("status") in {"launching", "running", "finalizing"}:
        started_at = datetime.fromisoformat(receipt["started_at"])
        receipt["live_elapsed_seconds"] = max(
            0.0,
            (observed_at - started_at).total_seconds(),
        )
    else:
        receipt["live_elapsed_seconds"] = receipt.get("elapsed_seconds")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--label")
    parser.add_argument("--artifact", type=Path, action="append", default=[])
    parser.add_argument("--interval", type=float, default=0.1)
    parser.add_argument("--status-interval", type=float, default=1.0)
    parser.add_argument("--background", action="store_true")
    parser.add_argument("--log", type=Path)
    parser.add_argument("--status", type=Path)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.status is not None:
        print(json.dumps(read_status(args.status), indent=2, sort_keys=True))
        return 0
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if args.interval <= 0:
        parser.error("--interval must be positive")
    if args.status_interval <= 0:
        parser.error("--status-interval must be positive")
    if args.receipt is None:
        parser.error("--receipt is required")
    if args.label is None:
        parser.error("--label is required")
    if not command:
        parser.error("a command is required after --")
    if args.background:
        log_path = args.log or args.receipt.with_suffix(".log")
        return launch_background(
            command,
            receipt_path=args.receipt,
            label=args.label,
            artifacts=args.artifact,
            interval_s=args.interval,
            status_interval_s=args.status_interval,
            log_path=log_path,
        )
    return run_with_telemetry(
        command,
        receipt_path=args.receipt,
        label=args.label,
        artifacts=args.artifact,
        interval_s=args.interval,
        status_interval_s=args.status_interval,
        log_path=args.log,
    )


if __name__ == "__main__":
    raise SystemExit(main())
