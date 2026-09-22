#!/bin/bash
# scripts/git-hooks/install.sh
# Git 훅 자동 설치 스크립트

HOOK_DIR="$(git rev-parse --git-path hooks 2>/dev/null || echo '.git/hooks')"
SOURCE_HOOK="scripts/git-hooks/pre-commit"
TARGET_HOOK="${HOOK_DIR}/pre-commit"

if [ -d "$HOOK_DIR" ] && [ -f "$SOURCE_HOOK" ]; then
  cp "$SOURCE_HOOK" "$TARGET_HOOK"
  chmod +x "$TARGET_HOOK"
  echo "✅ [Git Hook 설치 완료] ${TARGET_HOOK}"
else
  echo "⚠️ [Git Hook 설치 스킵] .git 디렉터리가 아니거나 소스 훅이 없습니다."
fi
