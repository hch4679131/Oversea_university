#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH:-production}"
REPO_DIR="${REPO_DIR:-""}"
SITE_SRC="${SITE_SRC:-""}"
SITE_DST="${SITE_DST:-/usr/local/nginx/html/sdlvhk.com}"
NGINX_BIN="${NGINX_BIN:-""}"

detect_nginx_bin() {
  if [[ -n "$NGINX_BIN" ]]; then
    echo "$NGINX_BIN"
    return 0
  fi

  # Prefer the binary of the currently running nginx master process (if any).
  local running_bin
  running_bin="$(ps -ef 2>/dev/null | sed -n 's/.*nginx: master process \([^ ]*nginx\).*/\1/p' | head -n 1)"
  if [[ -n "$running_bin" && -x "$running_bin" ]]; then
    echo "$running_bin"
    return 0
  fi

  if command -v nginx >/dev/null 2>&1; then
    command -v nginx
    return 0
  fi

  local candidates=(
    "/usr/local/nginx/sbin/nginx"
    "/usr/sbin/nginx"
    "/usr/local/openresty/nginx/sbin/nginx"
    "/usr/local/tengine/sbin/nginx"
  )

  for bin in "${candidates[@]}"; do
    if [[ -x "$bin" ]]; then
      echo "$bin"
      return 0
    fi
  done

  return 1
}

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
git fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
git reset --hard "origin/$BRANCH"

NGINX_BIN="$(detect_nginx_bin || true)"
if [[ -z "$NGINX_BIN" ]]; then
  echo "ERROR: nginx binary not found. Set NGINX_BIN=/path/to/nginx"
  exit 1
fi

echo "==> Using nginx binary: $NGINX_BIN"
"$NGINX_BIN" -V 2>&1 | head -n 2 || true

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
