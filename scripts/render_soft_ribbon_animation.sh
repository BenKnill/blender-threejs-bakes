#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MOTION="$ROOT/physics/labs/soft_ribbon/outputs/soft_ribbon.motion.json"
OUTPUT="$ROOT/renders/soft_ribbon.mp4"
FRAME_DIR="$ROOT/renders/soft_ribbon_frames"
LOG="$ROOT/physics/labs/soft_ribbon/outputs/render.log"

test -s "$MOTION" || bash "$ROOT/scripts/build_soft_ribbon.sh"
mkdir -p "$ROOT/renders"
rm -rf "$FRAME_DIR"
rm -f "$OUTPUT" "$ROOT/renders/soft_ribbon_contact.png" "$LOG"

"$ROOT/scripts/blender.sh" --background --python "$ROOT/scripts/render_soft_ribbon.py" -- \
  "$MOTION" --output "$OUTPUT" 2>&1 | tee "$LOG"

if rg -q "Traceback \(most recent call last\)" "$LOG"; then
  echo "Blender reported a Python traceback" >&2
  exit 1
fi

ffmpeg -y -hide_banner -loglevel error -framerate 30 \
  -i "$FRAME_DIR/frame_%04d.png" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "$OUTPUT"

ffmpeg -y -hide_banner -loglevel error \
  -i "$FRAME_DIR/frame_%04d.png" \
  -vf "select='eq(n,0)+eq(n,30)+eq(n,60)+eq(n,90)+eq(n,120)+eq(n,150)',scale=320:-1,tile=3x2" \
  -frames:v 1 "$ROOT/renders/soft_ribbon_contact.png"

test -s "$OUTPUT"
test -s "$ROOT/renders/soft_ribbon_contact.png"
test -s "$ROOT/renders/soft_ribbon.receipt.json"
echo "animation: $OUTPUT"
echo "contact sheet: $ROOT/renders/soft_ribbon_contact.png"
