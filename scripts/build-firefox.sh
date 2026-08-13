#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$BASE_DIR/remine-helper-extension"
DEST_DIR="$BASE_DIR/remine-helper-extension-firefox"

if [[ ! -d "$SRC_DIR" ]]; then
  SRC_DIR=$(find "$BASE_DIR" -maxdepth 1 -type d -name "*remine-helper-extension*" ! -name "*firefox*" ! -name "*복사본*" | head -n 1 || true)
fi

if [[ -z "$SRC_DIR" ]] || [[ ! -d "$SRC_DIR" ]]; then
  SRC_DIR="$BASE_DIR/remine-helper-extension"
fi

printf "Syncing Firefox extension files from %s to %s
" "$SRC_DIR" "$DEST_DIR"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Error: source directory does not exist: $SRC_DIR" >&2
  exit 1
fi

if [[ ! -d "$DEST_DIR" ]]; then
  mkdir -p "$DEST_DIR"
fi

# Keep only manifest.json and icons in the Firefox folder before syncing.
find "$DEST_DIR" -maxdepth 1 -type f ! -name 'manifest.json' ! -name '.DS_Store' -delete 2>/dev/null || true
find "$DEST_DIR" -mindepth 2 -type f ! -path "$DEST_DIR/icons/*" ! -path "$DEST_DIR/.git/*" -delete 2>/dev/null || true

# Copy shared extension files, preserving the Firefox manifest and icons.
rsync -a --delete --exclude='manifest.json' --exclude='.DS_Store' --exclude='.git/' "$SRC_DIR/" "$DEST_DIR/"

printf "Firefox extension sync complete.
"
