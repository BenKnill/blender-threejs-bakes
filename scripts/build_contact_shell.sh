#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAB="$ROOT/physics/labs/contact_shell"
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}

cmake -S "$LAB" -B "$LAB/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$LAB/build" --parallel
ctest --test-dir "$LAB/build" --output-on-failure

(
  cd "$LAB"
  ./build/contact_shell_probe
)

test -s "$LAB/outputs/contact_shell.jsonl"
echo "probe: $LAB/outputs/contact_shell.jsonl"
