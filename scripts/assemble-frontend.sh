#!/usr/bin/env bash
# assemble-frontend.sh — Merge core/src + custom/src → src/
# Core src is the canonical Spine frontend.
# Custom src (in /custom/src/) overrides or extends core.
# Vite expects a single src directory, so we assemble at build time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CORE_SRC_DIR="$PROJECT_ROOT/core/src"
CUSTOM_SRC_DIR="$PROJECT_ROOT/custom/src"
TARGET_SRC_DIR="$PROJECT_ROOT/src"

echo "🔧 Assembling frontend → $TARGET_SRC_DIR"

# 1. Clean target (except .gitkeep if exists)
if [ -d "$TARGET_SRC_DIR" ]; then
  find "$TARGET_SRC_DIR" -mindepth 1 -not -name '.gitkeep' -delete 2>/dev/null || true
else
  mkdir -p "$TARGET_SRC_DIR"
fi

# 2. Copy core src (base layer)
if [ -d "$CORE_SRC_DIR" ]; then
  cp -r "$CORE_SRC_DIR"/* "$TARGET_SRC_DIR"/
  echo "  ✓ Core: $(find "$CORE_SRC_DIR" -name '*.tsx' -o -name '*.ts' -o -name '*.css' | wc -l | tr -d ' ') files"
else
  echo "  ⚠ Core: $CORE_SRC_DIR not found"
fi

# 3. Overlay custom src (overrides + additions)
if [ -d "$CUSTOM_SRC_DIR" ]; then
  # Copy files and subdirectories
  cp -r "$CUSTOM_SRC_DIR"/* "$TARGET_SRC_DIR"/ 2>/dev/null || true
  
  # Handle subdirectories properly
  find "$CUSTOM_SRC_DIR" -mindepth 1 -type d -exec sh -c 'dir="$1"; base=$(basename "$dir"); mkdir -p "'"$TARGET_SRC_DIR"'/$base" && cp -r "$dir"/* "'"$TARGET_SRC_DIR"'/$base/"' _ {} \; 2>/dev/null || true
  
  CUSTOM_COUNT=$(find "$CUSTOM_SRC_DIR" -name '*.tsx' -o -name '*.ts' -o -name '*.css' 2>/dev/null | wc -l | tr -d ' ')
  echo "  ✓ Custom: $CUSTOM_COUNT files"
else
  echo "  ○ Custom: (empty)"
fi

echo "  ✓ Assembled: $(find "$TARGET_SRC_DIR" -name '*.tsx' -o -name '*.ts' -o -name '*.css' | wc -l | tr -d ' ') total files"
echo "✅ Done"
