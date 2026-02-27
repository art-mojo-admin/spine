#!/usr/bin/env bash
# build-manifest.sh — Generate a signed manifest of core file hashes.
# Used for build-time integrity verification.
# In dev mode (SPINE_INTEGRITY=warn), mismatches log warnings.
# In production (SPINE_INTEGRITY=enforce), mismatches fail the build.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CORE_DIR="$PROJECT_ROOT/core"
SRC_DIR="$PROJECT_ROOT/src"
MANIFEST_FILE="$PROJECT_ROOT/.spine-manifest.json"

INTEGRITY_MODE="${SPINE_INTEGRITY:-warn}"

echo "🔒 Generating core integrity manifest (mode: $INTEGRITY_MODE)"

# Collect hashes of all core files
HASHES="{"
FIRST=true

# Core functions
while IFS= read -r -d '' file; do
  REL_PATH="${file#$PROJECT_ROOT/}"
  HASH=$(shasum -a 256 "$file" | cut -d' ' -f1)
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    HASHES="$HASHES,"
  fi
  HASHES="$HASHES\"$REL_PATH\":\"$HASH\""
done < <(find "$CORE_DIR" -type f -name '*.ts' -print0 | sort -z)

# Core src components (shared, layout, hooks, lib)
for SUBDIR in components/shared components/layout hooks lib; do
  DIR="$SRC_DIR/$SUBDIR"
  if [ -d "$DIR" ]; then
    while IFS= read -r -d '' file; do
      REL_PATH="${file#$PROJECT_ROOT/}"
      HASH=$(shasum -a 256 "$file" | cut -d' ' -f1)
      HASHES="$HASHES,\"$REL_PATH\":\"$HASH\""
    done < <(find "$DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 | sort -z)
  fi
done

HASHES="$HASHES}"

# Write manifest
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$MANIFEST_FILE" <<EOF
{
  "version": "1",
  "generated_at": "$TIMESTAMP",
  "integrity_mode": "$INTEGRITY_MODE",
  "file_count": $(echo "$HASHES" | tr ',' '\n' | wc -l | tr -d ' '),
  "hashes": $HASHES
}
EOF

echo "  ✓ Manifest written to $MANIFEST_FILE"
echo "  ✓ $(echo "$HASHES" | tr ',' '\n' | wc -l | tr -d ' ') files hashed"
echo "✅ Done"
