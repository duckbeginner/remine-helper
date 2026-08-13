#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHROME_DIR="$BASE_DIR/remine-helper-extension"
FIREFOX_DIR="$BASE_DIR/remine-helper-extension-firefox"
BUILD_SCRIPT="$BASE_DIR/scripts/build-firefox.sh"
PUBLISH_DIR="$BASE_DIR/publish"

echo "=== [1/3] Syncing Firefox Extension Files ==="
if [ -f "$BUILD_SCRIPT" ]; then
  bash "$BUILD_SCRIPT"
else
  echo "Error: $BUILD_SCRIPT not found!"
  exit 1
fi

echo "=== [2/3] Extracting Version ==="
VERSION=$(grep -o '"version": "[^"]*"' "$CHROME_DIR/manifest.json" | head -n 1 | cut -d'"' -f4)
if [ -z "$VERSION" ]; then
  VERSION="1.0.0"
fi
echo "Target Version: $VERSION"

mkdir -p "$PUBLISH_DIR"

echo "=== [3/3] Packaging Zip Files ==="

# Chrome Packaging
CHROME_ZIP="$PUBLISH_DIR/remine-helper-chrome-v$VERSION.zip"
echo "Creating Chrome package: $CHROME_ZIP"
rm -f "$CHROME_ZIP"
(cd "$CHROME_DIR" && zip -r "$CHROME_ZIP" . -x "*.DS_Store" "*_metadata/*")

# Firefox Packaging
FIREFOX_ZIP="$PUBLISH_DIR/remine-helper-firefox-v$VERSION.zip"
echo "Creating Firefox package: $FIREFOX_ZIP"
rm -f "$FIREFOX_ZIP"
(cd "$FIREFOX_DIR" && zip -r "$FIREFOX_ZIP" . -x "*.DS_Store" "*_metadata/*")

echo "=== Packaging Completed Successfully! ==="
echo "Outputs:"
echo " - Chrome:  $CHROME_ZIP"
echo " - Firefox: $FIREFOX_ZIP"
