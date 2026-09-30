#!/usr/bin/env bash
# dist/ 를 빌드해서 gh-pages 브랜치로 배포합니다 (GitHub Pages: "Deploy from a branch" → gh-pages / root).
# 사용법: npm run deploy   (origin 에 push 권한 필요 · force push 없이 gh-pages 히스토리에 커밋을 쌓음)
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE_URL="$(git remote get-url origin)"
SHA="$(git rev-parse --short HEAD)"

npm run lint
npm run build

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if git ls-remote --exit-code --heads "$REMOTE_URL" gh-pages >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch gh-pages "$REMOTE_URL" "$TMP"
  find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
else
  git -C "$TMP" init --quiet -b gh-pages
  git -C "$TMP" remote add origin "$REMOTE_URL"
fi

cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"   # Jekyll 처리 건너뛰기

git -C "$TMP" add -A
if git -C "$TMP" diff --cached --quiet; then
  echo "변경 사항 없음 — 배포 생략"
  exit 0
fi
git -C "$TMP" commit --quiet -m "deploy: ${SHA}"
git -C "$TMP" push --quiet origin gh-pages
echo "배포 완료: gh-pages ← ${SHA}"
