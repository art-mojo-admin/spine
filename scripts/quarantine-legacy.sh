#!/usr/bin/env bash
# quarantine-legacy.sh - Move all non-v2 files to _quarantine

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
QUARANTINE_DIR="$PROJECT_ROOT/_quarantine"

echo "Quarantining legacy files and directories..."

# Create quarantine directory
mkdir -p "$QUARANTINE_DIR"

# Move legacy directories
for dir in x-core x-custom x-docs x-migrations x-netlify x-supabase; do
  if [ -d "$PROJECT_ROOT/$dir" ]; then
    mv "$PROJECT_ROOT/$dir" "$QUARANTINE_DIR/"
    echo "  Moved $dir/"
  fi
done

# Move legacy files
for file in x-*.md vite.config.d.ts *.tsbuildinfo deno.lock .spine-manifest.json; do
  if [ -f "$PROJECT_ROOT/$file" ]; then
    mv "$PROJECT_ROOT/$file" "$QUARANTINE_DIR/"
    echo "  Moved $file"
  fi
done

# Move empty file
if [ -f "$PROJECT_ROOT/ rm" ]; then
  mv "$PROJECT_ROOT/ rm" "$QUARANTINE_DIR/"
  echo "  Moved empty file ' rm'"
fi

echo "Legacy quarantine complete"
echo "Quarantined files in: $QUARANTINE_DIR"
echo ""
echo "To restore (if needed):"
echo "  mv _quarantine/* ."
echo "  rmdir _quarantine"
