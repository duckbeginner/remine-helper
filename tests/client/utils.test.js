// tests/client/utils.test.js
// 단일 진실 공급원(SSOT) utils.js 공통 유틸 모듈 전수 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import {
  parseSafeDate,
  getKstDateString,
  escapeHtml,
  decodeHtmlEntities,
  cleanDisplayTitle,
  cleanScheduleText,
  getTimeAgo
} from '../../remine-helper/common/modules/utils.js';

export async function run() {
  const runner = new TestRunner('Client - Common Utilities (utils.js SSOT)');
  runner.run();

  // 1. parseSafeDate 검증 (정책 1 결측치 방어 및 KST 파싱)
  runner.test('parseSafeDate: 결측치 인입 시 null 반환 및 정상 날짜 유효 파싱', () => {
    assert.strictEqual(parseSafeDate(null), null, 'null은 null 반환');
    assert.strictEqual(parseSafeDate(undefined), null, 'undefined는 null 반환');
    assert.strictEqual(parseSafeDate(''), null, '빈 문자열은 null 반환');
    assert.strictEqual(parseSafeDate('   '), null, '공백 문자열은 null 반환');
    assert.strictEqual(parseSafeDate('invalid-date'), null, '무효한 날짜는 null 반환');
    assert.strictEqual(parseSafeDate('2026-99-99'), null, '비정상 연월일은 null 반환');
    assert.strictEqual(parseSafeDate('2026-13-01'), null, '13월은 null 반환');
    assert.strictEqual(parseSafeDate('2026-00-01'), null, '0월은 null 반환');

    const d1 = parseSafeDate('2026-09-14');
    assert(d1 instanceof Date && !isNaN(d1.getTime()), 'YYYY-MM-DD 포맷 유효 파싱');
    assert.strictEqual(d1.getFullYear(), 2026);
    assert.strictEqual(d1.getMonth(), 8); // 0-indexed 9월
    assert.strictEqual(d1.getDate(), 14);

    const d2 = parseSafeDate('2026-09-14T15:00:00Z');
    assert(d2 instanceof Date && !isNaN(d2.getTime()), 'ISO 8601 포맷 유효 파싱');
  });

  // 2. getKstDateString 검증 (KST 시간대 보정)
  runner.test('getKstDateString: UTC 자정 경계 데이터는 KST 기준 연월일로 정확히 변환', () => {
    assert.strictEqual(getKstDateString(null), null);
    assert.strictEqual(getKstDateString('invalid'), null);

    // UTC 2026-09-13T15:00:00Z = KST 2026-09-14 00:00:00
    const kstStr = getKstDateString('2026-09-13T15:00:00Z');
    assert.strictEqual(kstStr, '2026-09-14', 'UTC 15:00Z는 KST 기준 익일 00시로 14일 반환');
  });

  // 3. escapeHtml 검증 (XSS 방어)
  runner.test('escapeHtml: 특수문자 HTML 엔티티 이스케이프', () => {
    assert.strictEqual(escapeHtml(null), '');
    assert.strictEqual(escapeHtml(undefined), '');
    const dirty = '<script>alert("xss & \'attack\'");</script>';
    const safe = escapeHtml(dirty);
    assert.strictEqual(safe, '&lt;script&gt;alert(&quot;xss &amp; &#39;attack&#39;&quot;);&lt;/script&gt;');
  });

  // 4. decodeHtmlEntities 검증
  runner.test('decodeHtmlEntities: HTML 엔티티 안전 디코딩', () => {
    assert.strictEqual(decodeHtmlEntities(''), '');
    const encoded = '&lt;RESCENE&gt; &amp; Remine&#39;s &quot;Special&quot;';
    const decoded = decodeHtmlEntities(encoded);
    assert.strictEqual(decoded, '<RESCENE> & Remine\'s "Special"');
  });

  // 5. cleanDisplayTitle 검증
  runner.test('cleanDisplayTitle: 대괄호 태그, 채널 접미사 정제 및 길이 제한', () => {
    assert.strictEqual(cleanDisplayTitle(''), '');
    const raw = '[방송] [공식 영상] 뮤직뱅크 본방 사수! #리센느 #RESCENE | RESCENE';
    const cleaned = cleanDisplayTitle(raw);
    assert.strictEqual(cleaned, '뮤직뱅크 본방 사수!');

    const longTitle = '가나다라마바사아자차카타파하1234567890';
    const truncated = cleanDisplayTitle(longTitle, 10);
    assert.strictEqual(truncated, '가나다라마바사아자차...');
  });

  // 6. cleanScheduleText 검증
  runner.test('cleanScheduleText: 이모지/특수문자 제거 및 소문자 정규화', () => {
    const raw = '  ✨ [뮤직뱅크] KBS2 📺 LIVE!! 🎶 ';
    const cleaned = cleanScheduleText(raw);
    assert.strictEqual(cleaned, '뮤직뱅크 kbs2 live');
  });

  // 7. getTimeAgo 검증
  runner.test('getTimeAgo: 상대 시간 텍스트 산출', () => {
    assert.strictEqual(getTimeAgo(''), '');
    assert.strictEqual(getTimeAgo(null), '');
    const nowIso = new Date().toISOString();
    assert.strictEqual(getTimeAgo(nowIso), '방금 전');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('utils.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
