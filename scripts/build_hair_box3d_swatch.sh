#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAB="$ROOT/physics/labs/hair_box3d_swatch"
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}

cmake -S "$LAB" -B "$LAB/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$LAB/build" --parallel
ctest --test-dir "$LAB/build" --output-on-failure

(
  cd "$LAB"
  ./build/hair_box3d_swatch
)

python3 "$ROOT/scripts/render_hair_box3d_swatch_preview.py" \
  "$LAB/outputs/hair_box3d_swatch_motion.csv" \
  "$ROOT/docs/images/hair_box3d_swatch_preview.svg"

test -s "$LAB/outputs/hair_box3d_swatch_motion.csv"
test -s "$LAB/outputs/receipt.json"
test -s "$ROOT/docs/images/hair_box3d_swatch_preview.svg"

echo "motion: $LAB/outputs/hair_box3d_swatch_motion.csv"
echo "receipt: $LAB/outputs/receipt.json"
echo "preview: $ROOT/docs/images/hair_box3d_swatch_preview.svg"
