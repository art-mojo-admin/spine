#!/usr/bin/env bash
# netlify-dev-wrapper.sh - Start dev server (v2-core is now the working root)
#
# Called by: netlify dev (via netlify.toml [dev].command)
# Purpose:  exec vite directly (npx/npm indirection hangs under Netlify CLI)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting Netlify dev for Spine v2..."

# Start Vite dev server directly (v2-core is now the root)
echo "  Starting Vite on port 3001..."
exec "$PROJECT_ROOT/node_modules/.bin/vite" --config "$PROJECT_ROOT/vite.config.ts"
