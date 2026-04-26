#!/usr/bin/env bash
# assemble-v2.sh — Assemble v2-core + v2-custom into unified structure
# Calls frontend and functions assembly scripts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Assembling Spine v2..."

# Clean sync: remove stale assembled files, then copy fresh from v2-core
echo "Syncing functions..."
rm -rf "$PROJECT_ROOT/functions"
cp -R "$PROJECT_ROOT/v2-core/functions" "$PROJECT_ROOT/functions"
FUNC_COUNT=$(find "$PROJECT_ROOT/functions" -maxdepth 1 -name '*.ts' | wc -l | tr -d ' ')
echo "  $FUNC_COUNT functions assembled"

echo "Syncing frontend..."
rm -rf "$PROJECT_ROOT/src/v2-assembled"
cp -R "$PROJECT_ROOT/v2-core/src" "$PROJECT_ROOT/src/v2-assembled"
cp "$PROJECT_ROOT/v2-core/index.html" "$PROJECT_ROOT/src/v2-assembled/index.html"
sed -i '' 's|src="/src/main.tsx"|src="./main.tsx"|' "$PROJECT_ROOT/src/v2-assembled/index.html"

# Overlay custom files on top of core
bash "$SCRIPT_DIR/assemble-v2-custom.sh"

echo "Spine v2 assembly complete"
