#!/usr/bin/env bash
# assemble-functions.sh — Merge core + app functions into netlify/functions/
# Core functions are the canonical Spine runtime.
# App functions (in custom/*/functions/) override or extend core.
# Netlify requires a single functions directory, so we assemble at build time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CORE_DIR="$PROJECT_ROOT/core/functions"
CUSTOM_DIR="$PROJECT_ROOT/custom"
TARGET_DIR="$PROJECT_ROOT/netlify/functions"

echo "🔧 Assembling functions → $TARGET_DIR"

# 1. Clean target (except .gitkeep)
mkdir -p "$TARGET_DIR"
find "$TARGET_DIR" -mindepth 1 -not -name '.gitkeep' -delete 2>/dev/null || true

# 2. Copy core functions (base layer)
if [ -d "$CORE_DIR" ]; then
  cp -r "$CORE_DIR"/* "$TARGET_DIR"/
  echo "  ✓ Core: $(find "$CORE_DIR" -name '*.ts' | wc -l | tr -d ' ') files"
fi

# 3. Overlay app functions (overrides + additions)
CUSTOM_COUNT=0
for app_dir in "$CUSTOM_DIR"/*/; do
  if [ -d "$app_dir/functions" ]; then
    app_functions=$(find "$app_dir/functions" -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$app_functions" -gt 0 ]; then
      cp -r "$app_dir/functions"/*.ts "$TARGET_DIR"/ 2>/dev/null || true
      # Copy subdirectories if any
      find "$app_dir/functions" -mindepth 1 -type d -exec sh -c 'dir="$1"; base=$(basename "$dir"); mkdir -p "'"$TARGET_DIR"'/$base" && cp -r "$dir"/* "'"$TARGET_DIR"'/$base/"' _ {} \; 2>/dev/null || true
      CUSTOM_COUNT=$((CUSTOM_COUNT + app_functions))
      app_name=$(basename "$app_dir")
      echo "  ✓ $app_name: $app_functions files"
    fi
  fi
done

if [ "$CUSTOM_COUNT" -gt 0 ]; then
  echo "  ✓ Apps: $CUSTOM_COUNT total files"
else
  echo "  ○ Apps: (empty)"
fi

echo "  ✓ Assembled: $(find "$TARGET_DIR" -name '*.ts' | wc -l | tr -d ' ') total functions"
echo "✅ Done"
