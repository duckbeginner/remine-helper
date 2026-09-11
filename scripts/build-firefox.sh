#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$BASE_DIR/remine-helper"
DEST_DIR="${1:-$BASE_DIR/build/firefox}"
MANIFEST_SRC="$BASE_DIR/manifests/manifest.firefox.json"

echo "=== Building Firefox Extension ==="
echo "Source: $SRC_DIR"
echo "Destination: $DEST_DIR"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Error: source directory does not exist: $SRC_DIR" >&2
  exit 1
fi

if [[ ! -f "$MANIFEST_SRC" ]]; then
  echo "Error: Firefox manifest does not exist: $MANIFEST_SRC" >&2
  exit 1
fi

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

# 1. remine-helper 소스 복사 (manifest.json, git, tests, DS_Store 제외)
rsync -a --exclude='manifest.json' --exclude='.DS_Store' --exclude='.git/' --exclude='tests/' "$SRC_DIR/" "$DEST_DIR/"

# 2. Firefox 전용 매니페스트를 manifest.json으로 복사
cp "$MANIFEST_SRC" "$DEST_DIR/manifest.json"

echo "✓ Firefox extension build complete at $DEST_DIR"
