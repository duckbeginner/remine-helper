#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLISH_DIR="$BASE_DIR/publish"

echo "=== [1/3] Syncing Firefox Extension Files ==="
BUILD_SCRIPT="$BASE_DIR/scripts/build-firefox.sh"
if [ -f "$BUILD_SCRIPT" ]; then
  bash "$BUILD_SCRIPT" || true
else
  echo "Error: $BUILD_SCRIPT not found!"
  exit 1
fi

echo "=== [2/3] Extracting Version ==="
CHROME_DIR="$BASE_DIR/remine-helper"
if [ ! -d "$CHROME_DIR" ]; then
  CHROME_DIR=$(find "$BASE_DIR" -maxdepth 1 -type d -name "*remine-helper*" ! -name "*firefox*" ! -name "*복사본*" | head -n 1 || true)
fi

MANIFEST_PATH="$CHROME_DIR/manifest.json"
if [ ! -f "$MANIFEST_PATH" ]; then
  echo "Searching for manifest.json..."
  MANIFEST_PATH=$(find "$BASE_DIR" -name "manifest.json" ! -path "*/node_modules/*" ! -path "*/.git/*" | head -n 1 || true)
fi

VERSION="1.0.0"
if [ -n "$MANIFEST_PATH" ] && [ -f "$MANIFEST_PATH" ]; then
  echo "Found manifest at: $MANIFEST_PATH"
  EXTRACTED=$(grep -o '"version": "[^"]*"' "$MANIFEST_PATH" | head -n 1 | cut -d'"' -f4 || true)
  if [ -n "$EXTRACTED" ]; then
    VERSION="$EXTRACTED"
  fi
else
  echo "Error: Could not locate manifest.json!"
  echo "Repository structure under $BASE_DIR:"
  ls -la "$BASE_DIR"
  exit 1
fi

echo "Target Version: $VERSION"
mkdir -p "$PUBLISH_DIR"

echo "=== [3/3] Packaging Zip Files ==="

FIREFOX_DIR="$BASE_DIR/remine-helper-firefox"

# Chrome Packaging
CHROME_ZIP="$PUBLISH_DIR/remine-helper-chrome-v$VERSION.zip"
echo "Creating Chrome package: $CHROME_ZIP"
rm -f "$CHROME_ZIP"
(cd "$CHROME_DIR" && zip -r "$CHROME_ZIP" . -x "*.DS_Store" "*_metadata/*")

# Firefox Packaging
FIREFOX_ZIP="$PUBLISH_DIR/remine-helper-firefox-v$VERSION.zip"
echo "Creating Firefox package: $FIREFOX_ZIP"
rm -f "$FIREFOX_ZIP"
if [ -d "$FIREFOX_DIR" ]; then
  (cd "$FIREFOX_DIR" && zip -r "$FIREFOX_ZIP" . -x "*.DS_Store" "*_metadata/*")
else
  (cd "$CHROME_DIR" && zip -r "$FIREFOX_ZIP" . -x "*.DS_Store" "*_metadata/*")
fi

echo "=== Packaging Completed Successfully! ==="
echo "Outputs:"
echo " - Chrome:  $CHROME_ZIP"
echo " - Firefox: $FIREFOX_ZIP"
