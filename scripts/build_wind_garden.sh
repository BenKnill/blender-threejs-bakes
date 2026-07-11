#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAB="$ROOT/physics/labs/wind_garden"
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}

cmake -S "$LAB" -B "$LAB/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$LAB/build" --parallel
ctest --test-dir "$LAB/build" --output-on-failure

(
  cd "$LAB"
  ./build/wind_garden
)

python3 "$ROOT/scripts/package_wind_garden.py" \
  "$LAB/outputs/wind_garden_motion.csv" \
  "$LAB/outputs/wind_garden_topology.csv" \
  --metrics "$LAB/outputs/metrics.json" \
  --output-dir "$LAB/outputs" \
  --preview "$ROOT/docs/images/wind_garden_preview.svg"

test -s "$LAB/outputs/wind_garden.motion.json"
test -s "$LAB/outputs/receipt.json"
test -s "$ROOT/docs/images/wind_garden_preview.svg"
echo "motion: $LAB/outputs/wind_garden.motion.json"
echo "preview: $ROOT/docs/images/wind_garden_preview.svg"
echo "receipt: $LAB/outputs/receipt.json"
