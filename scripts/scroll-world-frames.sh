#!/bin/bash
# scroll-world asset pipeline for public/world.
#
#   bash scripts/scroll-world-frames.sh extract   # boundary frames from the rendered dives
#   bash scripts/scroll-world-frames.sh encode    # scrub-ready encodes of every raw clip
#
# Layout:
#   public/world/assets/vid/raw/  <- drop raw model output here (dives + connectors)
#   public/world/assets/frames/   <- generated: connector start/end images
#   public/world/assets/vid/      <- generated: what the page actually loads
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
A="$ROOT/public/world/assets"
RAW="$A/vid/raw"
OUT="$A/vid"
FR="$A/frames"
IDS="syow atlas feynman planner simulator mastery"

mkdir -p "$RAW" "$OUT" "$FR"

extract() {
  for suffix in "" "-m"; do
    for id in $IDS; do
      src="$RAW/$id$suffix.mp4"
      [ -f "$src" ] || { echo "skip (missing): $src"; continue; }
      ffmpeg -loglevel error -y -sseof -0.15 -i "$src" -frames:v 1 -q:v 2 "$FR/${id}_last$suffix.png"
      ffmpeg -loglevel error -y -ss 0      -i "$src" -frames:v 1 -q:v 2 "$FR/${id}_first$suffix.png"
      echo "frames: ${id}$suffix"
    done
  done
  echo "connector pairs (start -> end):"
  prev=""
  for id in $IDS; do
    [ -n "$prev" ] && echo "  ${prev}_last.png -> ${id}_first.png"
    prev="$id"
  done
}

# Desktop: native res, crf 20, GOP 8. Mobile: 720 wide, crf 23, GOP 4 (cheaper seeks).
enc() { ffmpeg -loglevel error -y -i "$1" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$2"; }
encm() { ffmpeg -loglevel error -y -i "$1" -an -vf "scale=720:-2,unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$2"; }

encode() {
  for src in "$RAW"/*.mp4; do
    [ -f "$src" ] || { echo "nothing in $RAW"; return; }
    base="$(basename "$src")"
    case "$base" in
      *-m.mp4) encm "$src" "$OUT/$base" ;;
      *)       enc  "$src" "$OUT/$base" ;;
    esac
    echo "encoded: $base"
  done
}

case "${1:-}" in
  extract) extract ;;
  encode)  encode ;;
  *) echo "usage: $0 extract|encode"; exit 1 ;;
esac
