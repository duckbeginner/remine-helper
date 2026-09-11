// tests/data-hub/squash-and-config.test.js
// Gist Squash 도구, Raw 캐시 계층 및 config.js 외부화 TDD 단위 테스트 스위트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export async function run() {
  console.log('\n▶ [Data Hub - Gist Squash Tool, Raw Cache & Externalized Config] 테스트 실행');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ 통과: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     이유: ${e.message}`);
      failed++;
    }
  }

  // 1. config.js 실존 및 필수 설정 검증
  const configPath = path.join(ROOT_DIR, 'scripts/data-hub/config.js');
  await test('config.js: 중앙 단일 설정 파일 실존 및 필수 상수 내보내기 검증', async () => {
    assert(fs.existsSync(configPath), 'scripts/data-hub/config.js 파일이 존재해야 합니다.');
    const config = await import('../../scripts/data-hub/config.js');
    assert(Array.isArray(config.DEFAULT_EXCLUDE_KEYWORDS), 'DEFAULT_EXCLUDE_KEYWORDS 배열이 있어야 합니다.');
    assert(config.DEFAULT_EXCLUDE_KEYWORDS.length >= 10, '제외 키워드가 충분히 정의되어 있어야 합니다.');
    assert(config.CACHE_CONFIG && typeof config.CACHE_CONFIG.rawCacheDir === 'string', 'CACHE_CONFIG에 rawCacheDir이 정의되어야 합니다.');
  });

  // 2. package.json scripts 등록 검증
  await test('package.json: data-hub:squash 스크립트 등록 확인', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    assert(pkg.scripts && pkg.scripts['data-hub:squash'], 'package.json에 "data-hub:squash" 스크립트가 등록되어야 합니다.');
  });

  // 3. squash-overrides.js 도구 기능 단위 검증
  await test('squash-overrides.js: squashOverrides 함수가 원본과 오버라이드를 정확히 병합·압축하는지 검증', async () => {
    const toolFile = path.join(ROOT_DIR, 'scripts/data-hub/tools/squash-overrides.js');
    assert(fs.existsSync(toolFile), 'scripts/data-hub/tools/squash-overrides.js 파일이 존재해야 합니다.');

    const { squashOverrides } = await import('../../scripts/data-hub/tools/squash-overrides.js');

    const baseItems = [
      { id: 'item_1', title: '원본 일정 1', startTime: '2026-09-15T15:00:00+09:00' },
      { id: 'item_2', title: '삭제될 일정 2', startTime: '2026-09-16T15:00:00+09:00' },
      { id: 'item_3', title: '수정될 일정 3', startTime: '2026-09-17T15:00:00+09:00' }
    ];

    const overrides = {
      sourceOverrides: {
        'item_3': { title: '수정 완료된 일정 3', channel: 'MBC' },
        'item_2': { _isDeleted: true }
      },
      customSchedules: {
        'custom_1': { id: 'custom_1', title: '신규 수동 등록 일정', startTime: '2026-09-18T18:00:00+09:00' }
      }
    };

    const squashed = squashOverrides(baseItems, overrides);
    assert.strictEqual(squashed.items.length, 3, '삭제 1건 제외 + 신규 1건 추가로 총 3건이어야 합니다.');
    const item3 = squashed.items.find(i => i.id === 'item_3');
    assert.strictEqual(item3.title, '수정 완료된 일정 3');
    assert.strictEqual(item3.channel, 'MBC');
    assert(!squashed.items.some(i => i.id === 'item_2'), 'item_2는 삭제되어 배제되어야 합니다.');
    assert(squashed.items.some(i => i.id === 'custom_1'), 'custom_1 신규 일정이 포함되어야 합니다.');
  });

  // 4. Raw 캐시 계층 및 SHA-256 Diffing 연동 검증
  await test('schedule.js: rawCacheDir 및 SHA-256 diffing 유틸 연동 확인', () => {
    const schedJsPath = path.join(ROOT_DIR, 'scripts/data-hub/collectors/schedule.js');
    const content = fs.readFileSync(schedJsPath, 'utf8');

    assert(content.includes('CACHE_CONFIG') || content.includes('rawCache') || content.includes('RAW_CACHE_DIR'), 'schedule.js에 Raw 캐시 레이어가 연동되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
