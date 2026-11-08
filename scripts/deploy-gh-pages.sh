#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building static export for GitHub Pages..."
NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/ai-work-assistant-pages}" npm run build
touch out/.nojekyll

echo "Deploying out/ to https://github.com/po45-ops/ai-work-assistant-pages.git..."
cd out
rm -rf .git
git init -b main
git config user.name "po45-ops"
git config user.email "po45-ops@users.noreply.github.com"
git add -A
git commit -q -m "deploy: static export for GitHub Pages"
git remote add origin https://github.com/po45-ops/ai-work-assistant-pages.git
git push -f -u origin main
rm -rf .git

echo "Done! Live at https://po45-ops.github.io/ai-work-assistant-pages/"
