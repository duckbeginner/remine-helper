#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLISH_DIR="$BASE_DIR/publish"
FIREFOX_BUILD_DIR="$BASE_DIR/build/firefox"

echo "=== [1/3] Building Firefox Extension from Single Source ==="
BUILD_SCRIPT="$BASE_DIR/scripts/build-firefox.sh"
if [ -f "$BUILD_SCRIPT" ]; then
  bash "$BUILD_SCRIPT" "$FIREFOX_BUILD_DIR"
else
  echo "Error: $BUILD_SCRIPT not found!"
  exit 1
fi

echo "=== [2/3] Extracting Version ==="
CHROME_DIR="$BASE_DIR/remine-helper"
MANIFEST_PATH="$CHROME_DIR/manifest.json"

if [ ! -f "$MANIFEST_PATH" ]; then
  echo "Error: Could not locate manifest.json at $MANIFEST_PATH!"
  exit 1
fi

VERSION=$(grep -o '"version": "[^"]*"' "$MANIFEST_PATH" | head -n 1 | cut -d'"' -f4 || true)
if [ -z "$VERSION" ]; then
  VERSION="1.0.0"
fi

echo "Target Version: $VERSION"
mkdir -p "$PUBLISH_DIR"

echo "=== [3/3] Packaging Zip Files ==="

# Chrome Packaging (단일 소스 remine-helper 직접 패키징)
CHROME_ZIP="$PUBLISH_DIR/remine-helper-chrome-v$VERSION.zip"
echo "Creating Chrome package: $CHROME_ZIP"
rm -f "$CHROME_ZIP"
(cd "$CHROME_DIR" && zip -r "$CHROME_ZIP" . -x "*.DS_Store" "*_metadata/*" "*.git*" "*.github*" "tests/*" "test-sandbox.*")

# Firefox Packaging (빌드된 Firefox 아티팩트 패키징)
FIREFOX_ZIP="$PUBLISH_DIR/remine-helper-firefox-v$VERSION.zip"
echo "Creating Firefox package: $FIREFOX_ZIP"
rm -f "$FIREFOX_ZIP"
(cd "$FIREFOX_BUILD_DIR" && zip -r "$FIREFOX_ZIP" . -x "*.DS_Store" "*_metadata/*" "*.git*" "*.github*" "tests/*" "test-sandbox.*")

# 임시 빌드 디렉터리 정리
rm -rf "$FIREFOX_BUILD_DIR"

echo "=== Packaging Completed Successfully! ==="
echo "Outputs:"
echo " - Chrome:  $CHROME_ZIP"
echo " - Firefox: $FIREFOX_ZIP"
