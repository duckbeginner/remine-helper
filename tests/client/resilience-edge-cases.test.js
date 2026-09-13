// tests/client/resilience-edge-cases.test.js
// 런타임 예외, 시간대(KST), 결측치 및 스토리지 장애 복원력 TDD 안전망 테스트 스위트

import { TestRunner, assert } from '../test-helper.js';
import { setupChromeMock } from '../mocks/chrome-mock.js';

export async function run() {
  const runner = new TestRunner('Client - Resilience & Edge Cases Safety-Net');
  runner.run();

  // 1. KST 시간대(UTC+9) 경계값 변환 무결성 테스트
  runner.test('Timezone: UTC 15:00:00Z 자정 경계 데이터는 KST 기준 익일 0시로 정확히 변환되어야 함', () => {
    // 2026-09-13T15:00:00.000Z = 한국 시각(KST) 2026-09-14 00:00:00
    const utcMidnightIso = '2026-09-13T15:00:00.000Z';

    // 나쁜 예 (과거 방식: 단순 문자열 slice): 하루 전인 9월 13일로 오인
    const badParsedDate = utcMidnightIso.slice(0, 10);
    assert.strictEqual(badParsedDate, '2026-09-13', '문자열 slice는 UTC 날짜(13일)로 잘못 잘림');

    // 올바른 KST 변환 헬퍼
    function getKstDateString(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      // UTC 시간에 9시간(KST 오프셋)을 더하여 KST 기준 연-월-일 계산
      const kstMs = d.getTime() + (9 * 60 * 60 * 1000);
      const kstDate = new Date(kstMs);
      return kstDate.toISOString().slice(0, 10);
    }

    const kstDateStr = getKstDateString(utcMidnightIso);
    assert.strictEqual(kstDateStr, '2026-09-14', 'KST 변환 헬퍼는 정확히 2026-09-14로 변환되어야 함');
  });

  // 2. 결측치 및 무효 날짜 방어 (정책 1 검증)
  runner.test('Date Safety: 결측치(null, 빈문자열, 무효포맷) 인입 시 안전 반환 및 크래시 방어', () => {
    function parseSafeDateStrict(startTimeStr) {
      if (!startTimeStr || typeof startTimeStr !== 'string' || !startTimeStr.trim()) {
        return null;
      }
      const match = startTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const _y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const d = parseInt(match[3], 10);
        if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      }
      if (startTimeStr.length === 10 && !startTimeStr.includes('T')) {
        const [y, m, d] = startTimeStr.split('-').map(Number);
        if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) return null;
        return new Date(y, m - 1, d, 0, 0, 0);
      }
      const d = new Date(startTimeStr);
      return isNaN(d.getTime()) ? null : d;
    }

    assert.strictEqual(parseSafeDateStrict(''), null, '빈 문자열은 null 반환');
    assert.strictEqual(parseSafeDateStrict(null), null, 'null은 null 반환');
    assert.strictEqual(parseSafeDateStrict(undefined), null, 'undefined는 null 반환');
    assert.strictEqual(parseSafeDateStrict('invalid-date-string'), null, '무효한 날짜 문자열은 null 반환');
    assert.strictEqual(parseSafeDateStrict('2026-99-99'), null, '비정상 연월일은 null 반환');

    const valid = parseSafeDateStrict('2026-09-14');
    assert(valid instanceof Date && valid.getFullYear() === 2026 && valid.getDate() === 14);
  });

  // 3. 렌더러 결측치 일정 100% 스킵 방어 (정책 1: 일반 화면 완전 숨김)
  runner.test('Renderer Isolation: 날짜나 제목이 없는 결측 일정은 크래시 없이 100% 스킵되어야 함', () => {
    const rawSchedules = [
      { id: 'valid_1', title: '정상 일정 1', startTime: '2026-09-14T10:00:00+09:00' },
      { id: 'broken_no_title', title: '', startTime: '2026-09-14T12:00:00+09:00' }, // 제목 결측
      { id: 'broken_no_date', title: '날짜 없는 일정', startTime: null }, // 날짜 결측
      { id: 'broken_invalid_date', title: '이상한 날짜', startTime: 'invalid-time' }, // 무효 날짜
      { id: 'valid_2', title: '정상 일정 2', startTime: '2026-09-14T14:00:00+09:00' }
    ];

    function filterValidClientSchedules(items) {
      if (!Array.isArray(items)) return [];
      return items.filter(item => {
        if (!item || typeof item !== 'object') return false;
        if (!item.title || !item.title.trim()) return false;
        if (!item.startTime) return false;
        const d = new Date(item.startTime);
        return !isNaN(d.getTime());
      });
    }

    const filtered = filterValidClientSchedules(rawSchedules);
    assert.strictEqual(filtered.length, 2, '비정상 3건이 100% 스킵되고 정상 2건만 남아야 함');
    assert.strictEqual(filtered[0].id, 'valid_1');
    assert.strictEqual(filtered[1].id, 'valid_2');
  });

  // 4. Chrome Storage 에러/할당량 초과 시 인메모리 폴백 및 무중단 렌더링
  runner.test('Storage Resilience: chrome.storage.local 쓰기 에러 발생 시 lastError 감지 및 폴백', async () => {
    const chromeMock = setupChromeMock();

    // 1) 정상 저장
    await chromeMock.storage.local.set({ testKey: 'initial_value' });
    const res1 = await chromeMock.storage.local.get('testKey');
    assert.strictEqual(res1.testKey, 'initial_value');

    // 2) 할당량 초과 에러 시뮬레이션
    chromeMock.setStorageError('QUOTA_BYTES_PER_ITEM quota exceeded');

    let errorHandled = false;
    try {
      await chromeMock.storage.local.set({ testKey: 'new_value' });
    } catch (err) {
      errorHandled = true;
      assert(chromeMock.runtime.lastError !== null);
      assert.strictEqual(chromeMock.runtime.lastError.message, 'QUOTA_BYTES_PER_ITEM quota exceeded');
    }
    assert(errorHandled, 'Storage 에러가 정상 포착되어야 함');

    // 에러 상태 리셋 후 정상 동작 복구
    chromeMock.setStorageError(null);
    await chromeMock.storage.local.set({ testKey: 'recovered_value' });
    const resRecovered = await chromeMock.storage.local.get('testKey');
    assert.strictEqual(resRecovered.testKey, 'recovered_value');
  });

  // 5. 외부 API 스키마 변경 계약 방어 (Contract Defense)
  runner.test('Contract Defense: 외부 API 응답 스키마가 깨지거나 누락되어도 파이프라인 안전 방어', () => {
    function safeParseExternalResponse(apiResponse) {
      if (!apiResponse || typeof apiResponse !== 'object') return [];
      const items = apiResponse.data?.schedules || apiResponse.items || apiResponse.results;
      if (!Array.isArray(items)) return [];
      return items.filter(it => it && typeof it === 'object' && it.id);
    }

    assert.deepStrictEqual(safeParseExternalResponse(null), []);
    assert.deepStrictEqual(safeParseExternalResponse('string response'), []);
    assert.deepStrictEqual(safeParseExternalResponse({ status: 500 }), []);
    assert.deepStrictEqual(safeParseExternalResponse({ items: 'not an array' }), []);

    const validResp = { items: [{ id: '1', title: '성공' }] };
    assert.strictEqual(safeParseExternalResponse(validResp).length, 1);
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('resilience-edge-cases.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
