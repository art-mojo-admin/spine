#!/usr/bin/env bash
# verify-integrity.sh — Verify core files against the build manifest.
# Run during CI/CD or pre-deploy to detect unauthorized modifications.
# SPINE_INTEGRITY=warn  → log warnings (default, dev-friendly)
# SPINE_INTEGRITY=enforce → fail build on mismatch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MANIFEST_FILE="$PROJECT_ROOT/.spine-manifest.json"

INTEGRITY_MODE="${SPINE_INTEGRITY:-warn}"

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "⚠️  No manifest found at $MANIFEST_FILE — run build-manifest.sh first"
  if [ "$INTEGRITY_MODE" = "enforce" ]; then exit 1; fi
  exit 0
fi

echo "🔒 Verifying core integrity (mode: $INTEGRITY_MODE)"

MISMATCHES=0
MISSING=0

# Parse each file:hash pair from manifest
while IFS=: read -r file_path expected_hash; do
  # Strip quotes and whitespace
  file_path=$(echo "$file_path" | tr -d '"' | xargs)
  expected_hash=$(echo "$expected_hash" | tr -d '"' | xargs)

  FULL_PATH="$PROJECT_ROOT/$file_path"

  if [ ! -f "$FULL_PATH" ]; then
    echo "  ✗ MISSING: $file_path"
    MISSING=$((MISSING + 1))
    continue
  fi

  ACTUAL_HASH=$(shasum -a 256 "$FULL_PATH" | cut -d' ' -f1)

  if [ "$ACTUAL_HASH" != "$expected_hash" ]; then
    echo "  ✗ MODIFIED: $file_path"
    MISMATCHES=$((MISMATCHES + 1))
  fi
done < <(cat "$MANIFEST_FILE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for k, v in data.get('hashes', {}).items():
    print(f'{k}:{v}')
" 2>/dev/null || echo "")

TOTAL=$((MISMATCHES + MISSING))

if [ "$TOTAL" -eq 0 ]; then
  echo "✅ All core files match manifest"
  exit 0
fi

echo ""
echo "⚠️  $MISMATCHES modified, $MISSING missing ($TOTAL total issues)"

if [ "$INTEGRITY_MODE" = "enforce" ]; then
  echo "❌ Build failed: core integrity check failed (SPINE_INTEGRITY=enforce)"
  exit 1
else
  echo "⚠️  Continuing with warnings (SPINE_INTEGRITY=warn)"
  exit 0
fi
