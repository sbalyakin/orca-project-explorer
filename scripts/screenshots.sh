#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_KEY="local.project-explorer"
DEMO_FLAG="$ROOT/.orca/demo"
RAW_DIR="$ROOT/.orca/raw-shots"
OUT_DIR="$ROOT/images"

mkdir -p "$ROOT/.orca" "$RAW_DIR" "$OUT_DIR"

cleanup() {
  rm -f "$DEMO_FLAG"
  orca plugin restart "$PLUGIN_KEY" >/dev/null 2>&1 || true
  orca plugin open "$PLUGIN_KEY" >/dev/null 2>&1 || true
  osascript -e 'tell application "System Events" to set visible of process "Orca" to true' >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Hide Orca so `--theme` takes effect without repainting the visible window.
osascript -e 'tell application "System Events" to set visible of process "Orca" to false' >/dev/null 2>&1 || true
sleep 0.5

shoot() {
  local theme="$1"
  local num="$2"
  local config="$3"
  local out="$RAW_DIR/panel-${theme}-${num}.png"

  printf '%s\n' "$config" > "$DEMO_FLAG"
  touch "$ROOT/src/demo.ts"
  orca plugin dev reload "$ROOT" >/dev/null
  orca plugin dev request "$ROOT" tree.load --json >/dev/null
  orca plugin open "$PLUGIN_KEY" >/dev/null
  sleep 2
  echo "Capturing panel $theme #$num ..."
  orca plugin shot "$PLUGIN_KEY" --width 420 --theme "$theme" --out "$out"
}

PRESET_1='{"favorites":false,"display":{"group":"none","density":"comfort","detail":"branch","time":"show"}}'
PRESET_2='{"favorites":true,"display":{"group":"folder","folders":"icons","guides":"subtle","density":"comfort","detail":"message","time":"show"}}'
PRESET_3='{"favorites":false,"display":{"group":"folder","folders":"arrows","guides":"none","density":"comfort","detail":"none","time":"hide"}}'

for theme in dark light; do
  # Warm up the theme and worker so the iframe paints in the target theme on shot 1.
  printf '%s\n' "$PRESET_1" > "$DEMO_FLAG"
  orca plugin dev reload "$ROOT" >/dev/null
  orca plugin dev request "$ROOT" tree.load --json >/dev/null
  orca plugin open "$PLUGIN_KEY" >/dev/null
  sleep 1
  orca plugin shot "$PLUGIN_KEY" --width 420 --theme "$theme" --out /tmp/orca-shot-warmup.png >/dev/null || true
  rm -f /tmp/orca-shot-warmup.png

  shoot "$theme" 1 "$PRESET_1"
  shoot "$theme" 2 "$PRESET_2"
  shoot "$theme" 3 "$PRESET_3"
done

echo "Rendering 1600x1000 showcase slides and cover..."
node "$ROOT/scripts/render-slides.mjs"

echo "Done. Saved 6 screenshots + cover.png to $OUT_DIR"
