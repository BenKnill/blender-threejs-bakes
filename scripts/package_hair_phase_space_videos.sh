#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:?usage: package_hair_phase_space_videos.sh OUTPUT_ROOT}"
CAPTURE_FPS="${CAPTURE_FPS:-12}"
OUTPUT_FPS="${OUTPUT_FPS:-24}"

dirs=("$ROOT"/[0-9][0-9]_*)
if [[ ${#dirs[@]} -ne 10 ]]; then
  echo "expected 10 scenario directories under $ROOT, found ${#dirs[@]}" >&2
  exit 2
fi

for dir in "${dirs[@]}"; do
  id="$(basename "$dir")"
  ffmpeg -y -hide_banner -loglevel error \
    -f image2 -c:v mjpeg -framerate "$CAPTURE_FPS" \
    -i "$dir/frame_%04d.jpg" -vf "fps=$OUTPUT_FPS" \
    -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
    "$dir/$id.mp4"
done

inputs=()
filters=""
streams=""
layout=""
for index in "${!dirs[@]}"; do
  dir="${dirs[$index]}"
  id="$(basename "$dir")"
  inputs+=( -i "$dir/$id.mp4" )
  filters+="[$index:v]scale=384:216[v$index];"
  streams+="[v$index]"
  x=$((index % 5 * 384))
  y=$((index / 5 * 216))
  [[ -n "$layout" ]] && layout+="|"
  layout+="${x}_${y}"
done

ffmpeg -y -hide_banner -loglevel error "${inputs[@]}" \
  -filter_complex "${filters}${streams}xstack=inputs=10:layout=${layout}[v]" \
  -map "[v]" -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  "$ROOT/hair_phase_space_contact_sheet.mp4"

echo "videos: $ROOT"
