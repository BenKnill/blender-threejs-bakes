#!/usr/bin/env bash
set -euo pipefail

FRAME_DIR=$1
OUTPUT=$2
CONTACT=$3
FPS=$4

ffmpeg -y -hide_banner -loglevel error -framerate "$FPS" \
  -i "$FRAME_DIR/frame_%04d.png" \
  -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart "$OUTPUT"

ffmpeg -y -hide_banner -loglevel error \
  -i "$FRAME_DIR/frame_%04d.png" \
  -vf "select='eq(n,0)+eq(n,24)+eq(n,47)+eq(n,49)+eq(n,72)+eq(n,96)',scale=360:-1,tile=3x2" \
  -frames:v 1 "$CONTACT"
