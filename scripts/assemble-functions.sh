#!/usr/bin/env bash
# assemble-functions.sh — Merge core + custom functions into netlify/functions/
# Core functions are the canonical Spine runtime.
# Custom functions (in /custom/functions/) override or extend core.
# Netlify requires a single functions directory, so we assemble at build time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CORE_DIR="$PROJECT_ROOT/core/functions"
CUSTOM_DIR="$PROJECT_ROOT/custom/functions"
TARGET_DIR="$PROJECT_ROOT/netlify/functions"

echo "🔧 Assembling functions → $TARGET_DIR"

# 1. Clean target (except .gitkeep)
find "$TARGET_DIR" -mindepth 1 -not -name '.gitkeep' -delete 2>/dev/null || true

# 2. Copy core functions (base layer)
if [ -d "$CORE_DIR" ]; then
  cp -r "$CORE_DIR"/* "$TARGET_DIR"/
  echo "  ✓ Core: $(find "$CORE_DIR" -name '*.ts' | wc -l | tr -d ' ') files"
fi

# 3. Overlay custom functions (overrides + additions)
mkdir -p "$CUSTOM_DIR"
CUSTOM_COUNT=$(find "$CUSTOM_DIR" -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$CUSTOM_COUNT" -gt 0 ]; then
  cp -r "$CUSTOM_DIR"/*.ts "$TARGET_DIR"/ 2>/dev/null || true
  # Copy subdirectories if any
  find "$CUSTOM_DIR" -mindepth 1 -type d -exec sh -c 'dir="$1"; base=$(basename "$dir"); mkdir -p "'"$TARGET_DIR"'/$base" && cp -r "$dir"/* "'"$TARGET_DIR"'/$base/"' _ {} \; 2>/dev/null || true
  echo "  ✓ Custom: $CUSTOM_COUNT files"
else
  echo "  ○ Custom: (empty)"
fi

echo "  ✓ Assembled: $(find "$TARGET_DIR" -name '*.ts' | wc -l | tr -d ' ') total functions"
echo "✅ Done"
