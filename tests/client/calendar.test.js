// tests/client/calendar.test.js
// 캘린더 엔진 핵심 로직 단위 테스트 (날짜 파싱, 타이틀 정규화, 구조 분해, 중복 판별)

import { TestRunner, assert } from '../test-helper.js';
import {
  parseSafeDate,
  cleanScheduleText,
  normalizeTitle,
  parseTitleStructure,
  areSchedulesDuplicate,
  deduplicateScheduleList
} from '../../remine-helper/common/modules/calendar.js';

export async function run() {
  const runner = new TestRunner('Client - Calendar Module');
  runner.run();

  // 1. parseSafeDate
  runner.test('parseSafeDate: YYYY-MM-DD 형식을 로컬 0시로 안전 파싱', () => {
    const d = parseSafeDate('2026-09-10');
    assert.strictEqual(d.getFullYear(), 2026);
    assert.strictEqual(d.getMonth(), 8); // 0-indexed (9월)
    assert.strictEqual(d.getDate(), 10);
    assert.strictEqual(d.getHours(), 0);
  });

  runner.test('parseSafeDate: ISO 문자열 및 빈 값 폴백 처리', () => {
    const dIso = parseSafeDate('2026-09-10T14:30:00+09:00');
    assert(!isNaN(dIso.getTime()));

    const dEmpty = parseSafeDate('');
    assert(dEmpty instanceof Date && !isNaN(dEmpty.getTime()));
  });

  // 2. cleanScheduleText & normalizeTitle
  runner.test('cleanScheduleText: 특수문자, 이모지, 중복 공백 제거', () => {
    const raw = '🎉 [방송] 리센느(RESCENE) - 인기가요! 🎬';
    const cleaned = cleanScheduleText(raw);
    assert.strictEqual(cleaned, '방송 리센느 rescene 인기가요');
  });

  runner.test('normalizeTitle: 동의어(m countdown -> 엠카운트다운 등) 표준화 및 공백 압축', () => {
    const t1 = normalizeTitle('M Countdown 생방송');
    assert(t1.includes('엠카운트다운'));

    const t2 = normalizeTitle('Music Bank');
    assert(t2.includes('뮤직뱅크'));

    const t3 = normalizeTitle('Inkigayo');
    assert(t3.includes('인기가요'));
  });

  // 3. parseTitleStructure
  runner.test('parseTitleStructure: <메인> 서브 또는 [메인] 서브 정밀 분해', () => {
    const res1 = parseTitleStructure('<더쇼> 리센느 출연');
    assert(res1.main.includes('더쇼'));
    assert(res1.sub.includes('리센느출연'));

    const res2 = parseTitleStructure('[뮤직뱅크] 생방송 본방');
    assert(res2.main.includes('뮤직뱅크'));
    assert(res2.sub.includes('생방송본방'));
  });

  runner.test('parseTitleStructure: 하이픈 및 콜론 구분자(메인 - 서브) 분해', () => {
    const res = parseTitleStructure('인기가요 - 리센느 무대');
    assert(res.main.includes('인기가요'));
    assert(res.sub.includes('리센느무대'));
  });

  // 4. areSchedulesDuplicate & deduplicateScheduleList
  runner.test('areSchedulesDuplicate: 구조적 타이틀 및 부제에 따른 중복/개별 판정', () => {
    const item1 = { title: 'KBS2 뮤직뱅크 본방', channel: 'KBS2' };
    const item2 = { title: '뮤직뱅크', channel: 'KBS2' };
    assert(areSchedulesDuplicate(item1, item2) === true);

    const eventMain1 = { title: '<케이콘> 레드카펫' };
    const eventMain2 = { title: '<케이콘> 본공연' };
    assert(areSchedulesDuplicate(eventMain1, eventMain2) === false);

    const diff1 = { title: '쇼챔피언' };
    const diff2 = { title: '인기가요' };
    assert(areSchedulesDuplicate(diff1, diff2) === false);
  });

  runner.test('deduplicateScheduleList: v2.0 스케줄 패스스루 및 배열 무결성 검증', () => {
    const list = [
      { id: '1', title: '뮤직뱅크' },
      { id: '2', title: '인기가요' }
    ];
    const result = deduplicateScheduleList(list);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(deduplicateScheduleList([]), []);
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('calendar.test.js')) {
  run();
}
