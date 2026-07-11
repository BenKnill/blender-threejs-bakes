#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LAB="$ROOT/physics/labs/jgs2_compliance"
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}

cmake -S "$LAB" -B "$LAB/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$LAB/build" --parallel
ctest --test-dir "$LAB/build" --output-on-failure

(
  cd "$LAB"
  ./build/compliance_chain
  ./build/compliance_chain --box3d-reference
)

python3 "$ROOT/scripts/package_chain_lab.py" \
  "$LAB/outputs/compliance_chain.csv" \
  --box3d-reference "$LAB/outputs/box3d_distance_reference.csv" \
  --output-dir "$LAB/outputs"

test -s "$LAB/outputs/compliance_chain.csv"
test -s "$LAB/outputs/box3d_distance_reference.csv"
test -s "$LAB/outputs/convergence.svg"
test -s "$LAB/outputs/receipt.json"

echo "trace: $LAB/outputs/compliance_chain.csv"
echo "plot: $LAB/outputs/convergence.svg"
echo "receipt: $LAB/outputs/receipt.json"
