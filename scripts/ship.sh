#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "有未 commit 嘅改動。請先 commit，再跑 npm run ship。"
  git status --short
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
echo "Push $branch -> origin…"
git push -u origin "$branch"

echo "Build + deploy Cloudflare…"
npm run deploy
echo "GitHub 同公開網都已更新。"
