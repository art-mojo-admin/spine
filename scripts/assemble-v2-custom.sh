#!/usr/bin/env bash
# assemble-v2-custom.sh - Overlay v2-custom onto v2-core

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_DIR="$PROJECT_ROOT/v2-core"
CUSTOM_DIR="$PROJECT_ROOT/v2-custom"

echo "Overlaying v2-custom onto v2-core..."

# Frontend: copy custom_*.tsx files
if [ -d "$CUSTOM_DIR/src" ]; then
  CUSTOM_FRONTEND_COUNT=$(find "$CUSTOM_DIR/src" -name "custom_*.tsx" | wc -l)
  if [ "$CUSTOM_FRONTEND_COUNT" -gt 0 ]; then
    find "$CUSTOM_DIR/src" -name "custom_*.tsx" -exec cp {} "$CORE_DIR/src/" \;
    echo "  Copied $CUSTOM_FRONTEND_COUNT custom frontend files"
  else
    echo "  No custom frontend files found"
  fi
else
  echo "  No custom src directory found"
fi

# Functions: copy custom_*.ts files
if [ -d "$CUSTOM_DIR/functions" ]; then
  CUSTOM_FUNCTION_COUNT=$(find "$CUSTOM_DIR/functions" -name "custom_*.ts" | wc -l)
  if [ "$CUSTOM_FUNCTION_COUNT" -gt 0 ]; then
    find "$CUSTOM_DIR/functions" -name "custom_*.ts" -exec cp {} "$CORE_DIR/functions/" \;
    echo "  Copied $CUSTOM_FUNCTION_COUNT custom function files"
  else
    echo "  No custom function files found"
  fi
else
  echo "  No custom functions directory found"
fi

echo "Custom overlay complete"
