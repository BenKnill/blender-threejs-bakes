#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:?usage: package_hair_phase_space_videos.sh OUTPUT_ROOT}"
CAPTURE_FPS="${CAPTURE_FPS:-12}"
OUTPUT_FPS="${OUTPUT_FPS:-24}"
COLUMNS="${COLUMNS:-5}"
OUTPUT_NAME="${OUTPUT_NAME:-hair_phase_space_contact_sheet.mp4}"

dirs=("$ROOT"/[0-9][0-9]_*)
if [[ ! -d "${dirs[0]}" ]]; then
  echo "no numbered scenario directories under $ROOT" >&2
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
  x=$((index % COLUMNS * 384))
  y=$((index / COLUMNS * 216))
  [[ -n "$layout" ]] && layout+="|"
  layout+="${x}_${y}"
done

ffmpeg -y -hide_banner -loglevel error "${inputs[@]}" \
  -filter_complex "${filters}${streams}xstack=inputs=${#dirs[@]}:layout=${layout}[v]" \
  -map "[v]" -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  "$ROOT/$OUTPUT_NAME"

echo "videos: $ROOT"
