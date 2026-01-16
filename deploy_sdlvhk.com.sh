#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH:-production}"
REPO_DIR="${REPO_DIR:-""}"
SITE_SRC="${SITE_SRC:-""}"
SITE_DST="${SITE_DST:-/usr/local/nginx/html/sdlvhk.com}"
NGINX_BIN="${NGINX_BIN:-/usr/local/nginx/sbin/nginx}"

if [[ -z "$REPO_DIR" ]]; then
  REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [[ -z "$SITE_SRC" ]]; then
  SITE_SRC="$REPO_DIR/sites/sdlvhk.com"
fi

if [[ ! -f "$SITE_SRC/index.html" ]]; then
  echo "ERROR: $SITE_SRC/index.html not found"
  exit 1
fi

echo "==> Updating repo ($BRANCH) in: $REPO_DIR"
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Deploying site from: $SITE_SRC"
echo "==> Deploying site to:   $SITE_DST"
mkdir -p "$SITE_DST"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SITE_SRC/" "$SITE_DST/"
else
  echo "WARN: rsync not found; falling back to cp (no delete)"
  cp -a "$SITE_SRC/." "$SITE_DST/"
fi

echo "==> Testing and reloading nginx"
"$NGINX_BIN" -t
"$NGINX_BIN" -s reload

echo "OK: sdlvhk.com deployed"
