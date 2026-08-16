#!/usr/bin/env bash
# Rebuild the self-contained DSH web backend bundled with the desktop app.
#
# Result: backend/vendor/node_modules — a production install of
# @deepseek-ai/dsh and its whole dependency closure (frontend dist + native
# modules such as node-pty included).
#
# It is nested under backend/vendor/ (not backend/node_modules) because
# electron-builder's extraResources copier skips a root-level node_modules/.
set -euo pipefail
cd "$(dirname "$0")/../backend"

echo "› installing @deepseek-ai/dsh (production)…"
npm install --omit=dev --no-audit --no-fund

# npm >= 11 gates install scripts behind an allow-list; approve them and
# rebuild so native deps (node-pty prebuild + spawn-helper exec bit) are ready.
npm approve-scripts --all >/dev/null 2>&1 || true
npm rebuild >/dev/null 2>&1 || true

mkdir -p vendor
rm -rf vendor/node_modules
mv node_modules vendor/node_modules

# Patch the DeepSeek adapter to accept image content (native vision on
# deepseek-v4-pro); idempotent, so re-running setup is safe.
node ../scripts/patch-vision.mjs

echo "✓ backend ready at backend/vendor/node_modules"
