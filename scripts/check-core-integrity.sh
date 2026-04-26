#!/usr/bin/env bash
# check-core-integrity.sh - Verify v2-core hasn't been modified

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CORE_DIR="$PROJECT_ROOT/v2-core"
MANIFEST_FILE="$CORE_DIR/.spine-manifest.json"

echo "Checking v2-core integrity..."

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "  ERROR: Manifest file not found at $MANIFEST_FILE"
  exit 1
fi

# Calculate current hashes
CURRENT_SRC_HASH=$(find "$CORE_DIR/src" -type f -name '*.tsx' -o -name '*.ts' -o -name '*.css' 2>/dev/null | LC_ALL=C sort | xargs cat 2>/dev/null | sha256sum | cut -d' ' -f1)
CURRENT_FUNCTIONS_HASH=$(find "$CORE_DIR/functions" -type f -name '*.ts' 2>/dev/null | LC_ALL=C sort | xargs cat 2>/dev/null | sha256sum | cut -d' ' -f1)

# Extract expected hashes from manifest (using jq if available, fallback to grep)
if command -v jq >/dev/null 2>&1; then
  EXPECTED_SRC_HASH=$(jq -r '.integrity.src' "$MANIFEST_FILE" | sed 's/sha256-//')
  EXPECTED_FUNCTIONS_HASH=$(jq -r '.integrity.functions' "$MANIFEST_FILE" | sed 's/sha256-//')
else
  EXPECTED_SRC_HASH=$(grep '"src"' "$MANIFEST_FILE" | cut -d'"' -f4 | sed 's/sha256-//')
  EXPECTED_FUNCTIONS_HASH=$(grep '"functions"' "$MANIFEST_FILE" | cut -d'"' -f4 | sed 's/sha256-//')
fi

# Check integrity
if [ "$CURRENT_SRC_HASH" = "$EXPECTED_SRC_HASH" ] && [ "$CURRENT_FUNCTIONS_HASH" = "$EXPECTED_FUNCTIONS_HASH" ]; then
  echo "  Integrity check PASSED - Core files are unchanged"
  exit 0
else
  echo "  INTEGRITY CHECK FAILED - Core files have been modified!"
  echo "  WARRANTY VOIDED - Core tampering detected"
  echo ""
  echo "  Expected src hash:    $EXPECTED_SRC_HASH"
  echo "  Current src hash:     $CURRENT_SRC_HASH"
  echo ""
  echo "  Expected functions hash: $EXPECTED_FUNCTIONS_HASH"
  echo "  Current functions hash:  $CURRENT_FUNCTIONS_HASH"
  exit 1
fi
