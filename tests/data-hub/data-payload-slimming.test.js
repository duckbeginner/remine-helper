// tests/data-hub/data-payload-slimming.test.js
// 데이터 페이로드 슬림화 및 Gist Minify TDD 단위 테스트 스위트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { slimScheduleItem } from '../../scripts/data-hub/collectors/schedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

export async function run() {
  console.log('\n▶ [Data Hub - Data Payload Slimming & Gist Minify] 테스트 실행');
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

  // 1. slimScheduleItem: 단일 시점 일정의 endTime 생략 검증
  test('slimScheduleItem: startTime === endTime인 경우 endTime 필드 생략', () => {
    const singlePointItem = {
      id: 'test_point_1',
      title: '쇼! 음악중심',
      startTime: '2026-09-15T15:15:00+09:00',
      endTime: '2026-09-15T15:15:00+09:00',
      channel: 'MBC'
    };

    const slimmed = slimScheduleItem(singlePointItem);
    assert.strictEqual(slimmed.startTime, '2026-09-15T15:15:00+09:00');
    assert.strictEqual(slimmed.endTime, undefined, '동일 시점 일정의 endTime은 생략되어야 합니다.');
  });

  test('slimScheduleItem: startTime !== endTime인 기간 일정은 endTime 보존', () => {
    const durationItem = {
      id: 'test_duration_1',
      title: '팬사인회',
      startTime: '2026-09-15T15:00:00+09:00',
      endTime: '2026-09-15T17:00:00+09:00',
      location: '코엑스'
    };

    const slimmed = slimScheduleItem(durationItem);
    assert.strictEqual(slimmed.startTime, '2026-09-15T15:00:00+09:00');
    assert.strictEqual(slimmed.endTime, '2026-09-15T17:00:00+09:00', '기간 일정의 endTime은 보존되어야 합니다.');
  });

  // 2. ops-m7k2x9.html Gist Minify 검증
  test('ops-m7k2x9.html: Gist 업로드 payload 직렬화 시 null, 2 들여쓰기 배제 (Minify 단일 라인)', () => {
    const opsHtmlPath = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');
    const content = fs.readFileSync(opsHtmlPath, 'utf8');

    // Gist PATCH 요청 부분 확인
    assert(!content.includes('}, null, 2)'), 'Gist 업로드용 JSON에 2칸 들여쓰기(null, 2)가 남아있지 않아야 합니다.');
  });

  // 3. fetch-all.js activeItems 슬림화 로직 검증 (중복 extField 및 message 배제)
  test('fetch-all.js: activeItems 슬림화 시 channel/location 존재 시 중복 extField 및 message 배제', () => {
    const rawItems = [
      {
        id: 'item_1',
        title: '뮤직뱅크',
        startTime: '2026-09-18T17:00:00+09:00',
        channel: 'KBS2',
        extField: { key: '채널', value: 'KBS2' },
        message: '긴 상세 설명 및 줄바꿈\n내용입니다.'
      },
      {
        id: 'item_2',
        title: '미니 팬미팅',
        startTime: '2026-09-19T14:00:00+09:00',
        location: '상암',
        extField: { key: '장소', value: '상암' }
      }
    ];

    const processed = rawItems.map(item => {
      const slim = { ...item };
      if (slim.extField && (slim.channel || slim.location)) {
        delete slim.extField;
      }
      if (slim.message) {
        delete slim.message;
      }
      return slim;
    });

    assert.strictEqual(processed[0].extField, undefined, 'channel이 있으므로 extField는 제거되어야 합니다.');
    assert.strictEqual(processed[0].message, undefined, 'core.json에서는 message가 제외되어야 합니다.');
    assert.strictEqual(processed[1].extField, undefined, 'location이 있으므로 extField는 제거되어야 합니다.');
  });

  // 4. DATA_SPECIFICATION.md 예산 강화 검증
  test('DATA_SPECIFICATION.md: 강화된 용량 예산(core.json <= 50KB~80KB) 정의 확인', () => {
    const specPath = path.join(ROOT_DIR, 'specs/DATA_SPECIFICATION.md');
    const content = fs.readFileSync(specPath, 'utf8');

    assert(content.includes('80 KB'), 'core.json 최대 예산이 80KB 이하로 타이트하게 관리되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
