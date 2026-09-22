// scripts/check-syntax.js
// Node.js --check 전수 순회 문법 검사기 (단일 파일 한계 극복)

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

const TARGET_DIRS = [
  'remine-helper',
  'scripts',
  'tests',
  'docs'
];

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'build',
  'archive',
  'coverage',
  '.cache'
]);

function findJsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findJsFiles(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

const allFiles = [];
// 루트 디렉터리 내 직접 위치한 JS/MJS 파일 포함 (예: playwright.config.js)
const rootEntries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
for (const entry of rootEntries) {
  if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
    allFiles.push(path.join(ROOT_DIR, entry.name));
  }
}

for (const target of TARGET_DIRS) {
  findJsFiles(path.join(ROOT_DIR, target), allFiles);
}

console.log(`🔍 [Syntax Check] 총 ${allFiles.length}개 JavaScript 파일 전수 문법 검사 시작...`);

let errorCount = 0;
const errors = [];

for (const file of allFiles) {
  const relPath = path.relative(ROOT_DIR, file);
  try {
    execFileSync('node', ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    errorCount++;
    const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
    errors.push({ file: relPath, message: errMsg });
    console.error(`  ❌ [문법 오류] ${relPath}\n${errMsg}\n`);
  }
}

if (errorCount > 0) {
  console.error(`🚨 총 ${errorCount}개 파일에서 문법 오류가 발견되었습니다.`);
  process.exit(1);
} else {
  console.log(`✅ [Syntax Check 완료] ${allFiles.length}개 파일 전수 검사 통과 (오류 0건)`);
  process.exit(0);
}
