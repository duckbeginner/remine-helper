// tests/docs/ops-payload-v2-cleanup.test.js
// Ops 도구 Gist 저장 페이로드의 v1.0 중복 필드 제거 및 v2.0 정제 TDD 단위 테스트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');

export async function run() {
  console.log('\n▶ [Docs - Ops Tool Gist Payload v2.0 Cleanup] 테스트 실행');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ 통과: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     이유: ${e.message}`);
      failed++;
    }
  }

  const opsHtml = fs.readFileSync(OPS_HTML_PATH, 'utf8');

  // 1. Gist 업로드 payload 영역에서 v1.0 레거시 필드(deleted, modified, created) 제거 확인
  test('ops-m7k2x9.html: Gist payload에서 v1.0 중복 필드(deleted, modified, created) 배제 확인', () => {
    // onSaveToGistClick 함수 내 JSON.stringify 영역 확인
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const payloadSection = saveFuncSection.slice(0, saveFuncSection.indexOf('fetch(`https://api.github.com/gists/'));

    assert(!payloadSection.includes('deleted: Array.from(mergedDeleted)'), 'deleted 필드가 제거되어야 합니다.');
    assert(!payloadSection.includes('modified: mergedModified'), 'modified 필드가 제거되어야 합니다.');
    assert(!payloadSection.includes('created: finalCreated'), 'created 필드가 제거되어야 합니다.');
  });

  // 2. v2.0 필수 필드(sourceOverrides, customSchedules, filterRules) 보존 확인
  test('ops-m7k2x9.html: v2.0 필수 필드(version, filterRules, customSchedules, sourceOverrides) 유지 확인', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const payloadSection = saveFuncSection.slice(0, saveFuncSection.indexOf('fetch(`https://api.github.com/gists/'));

    assert(payloadSection.includes('version: "2.0.0"'), 'version: "2.0.0"이 포함되어야 합니다.');
    assert(payloadSection.includes('filterRules: finalFilterRules'), 'filterRules가 포함되어야 합니다.');
    assert(payloadSection.includes('customSchedules'), 'customSchedules가 포함되어야 합니다.');
    assert(payloadSection.includes('sourceOverrides'), 'sourceOverrides가 포함되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
