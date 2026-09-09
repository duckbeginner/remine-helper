// tests/client/storage.test.js
// 스토리지 필터링 및 멤버 매핑 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import {
  filterAndDeduplicateSchedules,
  getMemberDisplayName
} from '../../remine-helper/common/modules/storage.js';

export async function run() {
  const runner = new TestRunner('Client - Storage & Filter Module');
  runner.run();

  // 1. getMemberDisplayName
  runner.test('getMemberDisplayName: 닉네임 매핑 및 기본값 반환', () => {
    assert.strictEqual(getMemberDisplayName('별이빛나는맘'), '원이');
    assert.strictEqual(getMemberDisplayName('올리브🫒'), '리브');
    assert.strictEqual(getMemberDisplayName('올리브'), '리브');
    assert.strictEqual(getMemberDisplayName('김깨구리제로천사'), '제나');
    assert.strictEqual(getMemberDisplayName('메2'), '메이');
    assert.strictEqual(getMemberDisplayName('minami'), '미나미');
    assert.strictEqual(getMemberDisplayName('일반팬'), '일반팬');
    assert.strictEqual(getMemberDisplayName(''), '멤버');
  });

  // 2. filterAndDeduplicateSchedules
  runner.test('filterAndDeduplicateSchedules: 중복 제거 및 직캠/투표 등 제외 정규식 검증', () => {
    const rawItems = [
      { id: '1', title: '뮤직뱅크 본방', startTime: '2026-09-15T17:00:00+09:00' },
      { id: '1', title: '뮤직뱅크 본방', startTime: '2026-09-15T17:00:00+09:00' }, // ID 중복 -> 제외
      { id: '2', title: '인기가요 [직캠]', startTime: '2026-09-15T18:00:00+09:00' }, // 직캠 -> 제외
      { id: '3', title: '엠넷플러스 투표', startTime: '2026-09-16T12:00:00+09:00' }, // 투표 -> 제외
      { id: '4', title: '팬사인회 공지', startTime: '2026-09-17T14:00:00+09:00' }
    ];

    const result = filterAndDeduplicateSchedules(rawItems);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, '1');
    assert.strictEqual(result[1].id, '4');
  });

  runner.test('filterAndDeduplicateSchedules: _isCustom 관리자 일정은 키워드 매칭과 무관하게 100% 보존', () => {
    const rawItems = [
      { id: 'custom_1', title: '스페셜 직캠 상영회', _isCustom: true, startTime: '2026-09-18T19:00:00+09:00' }
    ];

    const result = filterAndDeduplicateSchedules(rawItems);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'custom_1');
  });

  runner.test('filterAndDeduplicateSchedules: 빈 배열 및 비정상 입력 방어', () => {
    assert.deepStrictEqual(filterAndDeduplicateSchedules(null), []);
    assert.deepStrictEqual(filterAndDeduplicateSchedules([]), []);
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('storage.test.js')) {
  run();
}
