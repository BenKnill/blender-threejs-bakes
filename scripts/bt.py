#!/usr/bin/env python3
"""Non-interactive control surface for Blender Three.js bakes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from btlib.validate import ContractError, validate_layout, validate_manifest


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_file(path: Path) -> None:
    data = load_json(path)
    if path.name == "manifest.json" or "assets" in data:
        validate_manifest(data)
    else:
        validate_layout(data)


def cmd_validate(args: argparse.Namespace) -> int:
    failures = []
    ok_paths = []
    for path in args.paths:
        try:
            validate_file(path)
        except ContractError as exc:
            failures.append({"path": str(path), "errors": exc.errors})
        else:
            ok_paths.append(str(path))
    if failures:
        if args.json:
            print(json.dumps({"ok": False, "failures": failures}, indent=2))
        else:
            for failure in failures:
                print(f"{failure['path']}:", file=sys.stderr)
                for error in failure["errors"]:
                    print(f"  {error}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps({"ok": True, "paths": ok_paths}, indent=2))
    else:
        for path in ok_paths:
            print(f"ok: {path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bt")
    subcommands = parser.add_subparsers(dest="command", required=True)
    validate = subcommands.add_parser("validate", help="validate a layout or manifest JSON file")
    validate.add_argument("paths", type=Path, nargs="+")
    validate.add_argument("--json", action="store_true")
    validate.set_defaults(func=cmd_validate)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
