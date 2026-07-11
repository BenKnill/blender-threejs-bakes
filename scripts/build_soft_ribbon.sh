#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAB="$ROOT/physics/labs/soft_ribbon"
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}

cmake -S "$LAB" -B "$LAB/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$LAB/build" --parallel
ctest --test-dir "$LAB/build" --output-on-failure

(
  cd "$LAB"
  ./build/soft_ribbon
)

python3 "$ROOT/scripts/package_soft_ribbon.py" \
  "$LAB/outputs/soft_ribbon_motion.csv" \
  "$LAB/outputs/soft_ribbon_topology.csv" \
  --performance "$LAB/outputs/performance.json" \
  --output-dir "$LAB/outputs" \
  --preview "$ROOT/docs/images/soft_ribbon_preview.svg"

test -s "$LAB/outputs/soft_ribbon.motion.json"
test -s "$LAB/outputs/receipt.json"
test -s "$LAB/outputs/performance.json"
test -s "$ROOT/docs/images/soft_ribbon_preview.svg"

echo "motion: $LAB/outputs/soft_ribbon.motion.json"
echo "preview: $ROOT/docs/images/soft_ribbon_preview.svg"
echo "receipt: $LAB/outputs/receipt.json"
