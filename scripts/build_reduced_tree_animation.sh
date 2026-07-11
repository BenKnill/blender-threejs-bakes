#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUTPUT_STEM="$ROOT/renders/seedthree_tree_reduced"
FRAME_DIR="${OUTPUT_STEM}_frames"
LOG="$ROOT/physics/outputs/reduced-tree-render.log"

mkdir -p "$ROOT/physics/outputs" "$ROOT/renders"

rm -rf "$FRAME_DIR"
rm -f "${OUTPUT_STEM}.mp4" "${OUTPUT_STEM}.receipt.json" "$LOG"
"$ROOT/scripts/blender.sh" --background --python "$ROOT/scripts/render_reduced_tree.py" -- \
  --manifest "$ROOT/assets/manifest.json" \
  --asset-id seedthree_white_oak_1737 \
  --output "${OUTPUT_STEM}.mp4" \
  --fps 24 --duration 4.0 --cut-time 1.65 --wind-strength 1.0 --fall-target-degrees 86 \
  2>&1 | tee "$LOG"

if rg -q "Traceback \(most recent call last\)" "$LOG"; then
  echo "Blender reported a Python traceback" >&2
  exit 1
fi

ffmpeg -y -hide_banner -loglevel error -framerate 24 \
  -i "$FRAME_DIR/frame_%04d.png" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart \
  "${OUTPUT_STEM}.mp4"

ffmpeg -y -hide_banner -loglevel error \
  -i "$FRAME_DIR/frame_%04d.png" \
  -vf "select='eq(n,0)+eq(n,24)+eq(n,48)+eq(n,72)+eq(n,96)',scale=320:-1,tile=5x1" \
  -frames:v 1 "${OUTPUT_STEM}_contact.png"

test -s "${OUTPUT_STEM}.mp4"
test -s "${OUTPUT_STEM}_contact.png"
test -s "${OUTPUT_STEM}.receipt.json"
echo "animation: ${OUTPUT_STEM}.mp4"
echo "receipt: ${OUTPUT_STEM}.receipt.json"
