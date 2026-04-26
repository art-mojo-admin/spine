#!/usr/bin/env bash
# assemble-v2-functions.sh — Merge v2-core + v2-custom functions into v2-core/functions/
# v2-core functions are the canonical Spine v2 runtime.
# v2-custom functions override or extend core.
# Netlify requires a single functions directory, so we assemble at build time.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CORE_DIR="$PROJECT_ROOT/v2-core/functions"
CUSTOM_DIR="$PROJECT_ROOT/v2-custom"
TARGET_DIR="$PROJECT_ROOT/functions"
TMP_DIR="$PROJECT_ROOT/.functions-assemble-tmp"

echo "🔧 Assembling v2 functions → $TARGET_DIR"

# 1. Assemble into a temp directory first so Netlify never observes a half-deleted functions dir
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# 2. Copy core functions (base layer), excluding _quarantine
if [ -d "$CORE_DIR" ]; then
  # Copy all files except _quarantine directory
  find "$CORE_DIR" -maxdepth 1 -name '*.ts' -exec cp {} "$TMP_DIR"/ \;
  # Copy subdirectories except _quarantine
  find "$CORE_DIR" -maxdepth 1 -mindepth 1 -type d ! -name '_quarantine' -exec cp -r {} "$TMP_DIR"/ \;
  echo "  ✓ Core: $(find "$CORE_DIR" -name '*.ts' | grep -v '_quarantine' | wc -l | tr -d ' ') files"
fi

# 3. Overlay custom functions (overrides + additions)
CUSTOM_COUNT=0
if [ -d "$CUSTOM_DIR/functions" ]; then
  cp -r "$CUSTOM_DIR/functions"/* "$TMP_DIR"/ 2>/dev/null || true
  # Copy subdirectories if any
  find "$CUSTOM_DIR/functions" -mindepth 1 -type d -exec sh -c 'dir="$1"; base=$(basename "$dir"); mkdir -p "'"$TMP_DIR"'/$base" && cp -r "$dir"/* "'"$TMP_DIR"'/$base/"' _ {} \; 2>/dev/null || true
  CUSTOM_COUNT=$(find "$CUSTOM_DIR/functions" -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
  echo "  ✓ Custom: $CUSTOM_COUNT files"
else
  echo "  ○ Custom: (empty)"
fi

# 4. Atomically swap temp into place
rm -rf "$TARGET_DIR"
mv "$TMP_DIR" "$TARGET_DIR"

echo "  ✓ Assembled: $(find "$TARGET_DIR" -name '*.ts' | wc -l | tr -d ' ') total functions"
echo "✅ Done"
