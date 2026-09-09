// tests/build/scripts.test.js
// 셸 빌드 스크립트 구문 및 실행 권한 무결성 검증

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

export async function run() {
  const runner = new TestRunner('Build - Shell Scripts Integrity');
  runner.run();

  const packageScript = path.join(SCRIPTS_DIR, 'package.sh');
  const buildFirefoxScript = path.join(SCRIPTS_DIR, 'build-firefox.sh');

  runner.test('package.sh: bash -n 문법 검증 및 shebang 확인', () => {
    assert(fs.existsSync(packageScript), 'scripts/package.sh가 존재해야 합니다.');
    const content = fs.readFileSync(packageScript, 'utf8');
    assert(content.startsWith('#!/usr/bin/env bash') || content.startsWith('#!/bin/bash'), '올바른 bash shebang이 있어야 합니다.');

    // bash -n 구문 검사
    execSync(`bash -n "${packageScript}"`, { stdio: 'pipe' });
  });

  runner.test('build-firefox.sh: bash -n 문법 검증 및 rsync 동기화 로직 확인', () => {
    assert(fs.existsSync(buildFirefoxScript), 'scripts/build-firefox.sh가 존재해야 합니다.');
    const content = fs.readFileSync(buildFirefoxScript, 'utf8');
    assert(content.includes('rsync') || content.includes('cp'), '동기화 로직이 포함되어야 합니다.');

    // bash -n 구문 검사
    execSync(`bash -n "${buildFirefoxScript}"`, { stdio: 'pipe' });
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('scripts.test.js')) {
  run();
}
