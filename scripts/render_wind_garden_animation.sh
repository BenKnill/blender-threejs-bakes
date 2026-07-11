#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MOTION="$ROOT/physics/labs/wind_garden/outputs/wind_garden.motion.json"
OUTPUT="$ROOT/renders/wind_garden.mp4"
FRAME_DIR="$ROOT/renders/wind_garden_frames"
LOG="$ROOT/physics/labs/wind_garden/outputs/render.log"

test -s "$MOTION" || bash "$ROOT/scripts/build_wind_garden.sh"
mkdir -p "$ROOT/renders"
rm -rf "$FRAME_DIR"
rm -f "$OUTPUT" "$ROOT/renders/wind_garden_contact.png" "$LOG"

"$ROOT/scripts/blender.sh" --background --python "$ROOT/scripts/render_wind_garden.py" -- \
  "$MOTION" --output "$OUTPUT" 2>&1 | tee "$LOG"

if rg -q "Traceback \(most recent call last\)" "$LOG"; then
  echo "Blender reported a Python traceback" >&2
  exit 1
fi

ffmpeg -y -hide_banner -loglevel error -framerate 30 \
  -i "$FRAME_DIR/frame_%04d.png" \
  -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "$OUTPUT"

ffmpeg -y -hide_banner -loglevel error \
  -i "$FRAME_DIR/frame_%04d.png" \
  -vf "select='eq(n,0)+eq(n,36)+eq(n,72)+eq(n,108)+eq(n,144)+eq(n,180)',scale=360:-1,tile=3x2" \
  -frames:v 1 "$ROOT/renders/wind_garden_contact.png"

test -s "$OUTPUT"
test -s "$ROOT/renders/wind_garden_contact.png"
test -s "$ROOT/renders/wind_garden.receipt.json"
echo "animation: $OUTPUT"
echo "contact sheet: $ROOT/renders/wind_garden_contact.png"
