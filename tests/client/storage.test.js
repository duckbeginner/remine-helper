// tests/client/storage.test.js
// 스토리지 필터링 및 멤버 매핑 단위 테스트

import { TestRunner, assert } from '../test-helper.js';
import {
  filterAndDeduplicateSchedules,
  getMemberDisplayName,
  getMemberAvatarUrl,
  updateDynamicMetadata
} from '../../remine-helper/common/modules/storage.js';

export async function run() {
  const runner = new TestRunner('Client - Storage & Filter Module');
  runner.run();

  // 1. getMemberDisplayName
  runner.test('getMemberDisplayName: 닉네임 매핑 및 기본값 반환', () => {
    assert.strictEqual(getMemberDisplayName('별이빛나는맘'), '원이');
    assert.strictEqual(getMemberDisplayName('원이입니다'), '원이'); // ⭐️ 원이 신규 닉네임
    assert.strictEqual(getMemberDisplayName('올리브🫒'), '리브');
    assert.strictEqual(getMemberDisplayName('올리브'), '리브');
    assert.strictEqual(getMemberDisplayName('김깨구리제로천사'), '제나');
    assert.strictEqual(getMemberDisplayName('메2'), '메이');
    assert.strictEqual(getMemberDisplayName('minami'), '미나미');
    assert.strictEqual(getMemberDisplayName('일반팬'), '일반팬');
    assert.strictEqual(getMemberDisplayName(''), '멤버');
  });

  runner.test('updateDynamicMetadata: 서버 주도형 신규 닉네임/ID 동적 업데이트 실시간 반영', () => {
    // 1) 서버에서 새로운 멤버 닉네임과 ID 매핑이 내려온 상황 시뮬레이션
    const mockServerMetadata = {
      members: {
        idMap: { 'new_future_id_123': '메이' },
        nicknameMap: { '메이의새로운별명': '메이' }
      }
    };
    updateDynamicMetadata(mockServerMetadata);

    // 2) 업데이트 후 즉시 getMemberDisplayName에 반영 확인
    assert.strictEqual(getMemberDisplayName({ id: 'new_future_id_123' }), '메이');
    assert.strictEqual(getMemberDisplayName('메이의새로운별명'), '메이');
  });

  runner.test('getMemberDisplayName: 불변 고유 ID 기반 1차 매핑 (탈퇴회원/가변닉네임 복원)', () => {
    // 1) 원이 기존 탈퇴 계정 ID + '탈퇴 회원' 닉네임 ➔ '원이'로 100% 자동 복원
    assert.strictEqual(getMemberDisplayName({ id: '67a59215db2769150bfbf5df', nickname: '탈퇴 회원' }), '원이');
    assert.strictEqual(getMemberDisplayName({ id: '67a59215db2769150bfbf5df', nickname: '별이빛나는맘' }), '원이');

    // 2) 원이 신규 계정 ID + 새 닉네임 ➔ '원이'
    assert.strictEqual(getMemberDisplayName({ id: '6a85595d92c2d65318a474de', nickname: '원이입니다' }), '원이');

    // 3) 다른 멤버들의 고유 ID ➔ 닉네임이 임의로 바뀌어도 활동명 100% 유지
    assert.strictEqual(getMemberDisplayName({ id: '67a5925e0425fa520d4fbf81', nickname: '새로운미나미닉' }), '미나미');
    assert.strictEqual(getMemberDisplayName({ id: '67a5924253c0ed13ba18b38a', nickname: '새로운리브닉' }), '리브');
    assert.strictEqual(getMemberDisplayName({ id: '67a5927866121779ad93d317', nickname: '새로운제나닉' }), '제나');
    assert.strictEqual(getMemberDisplayName({ id: '67a4ddac2248254b7dd6d9a7', nickname: '새로운메이닉' }), '메이');

    // 4) 미등록 ID인 경우 닉네임 2차 폴백
    assert.strictEqual(getMemberDisplayName({ id: 'unknown_id', nickname: '원이입니다' }), '원이');
    assert.strictEqual(getMemberDisplayName({ id: 'unknown_id', nickname: '일반팬' }), '일반팬');
  });

  runner.test('getMemberAvatarUrl: 멤버 이름 기반 프로필 이미지 URL 매핑 및 폴백', () => {
    const fallback = 'icons/default.png';
    const woniAvatar = getMemberAvatarUrl('원이', fallback);
    assert(woniAvatar.includes('woni'));

    const minamiAvatar = getMemberAvatarUrl('미나미', fallback);
    assert(minamiAvatar.includes('minami'));

    const unknownAvatar = getMemberAvatarUrl('알수없음', fallback);
    assert.strictEqual(unknownAvatar, fallback);

    const emptyAvatar = getMemberAvatarUrl('', fallback);
    assert.strictEqual(emptyAvatar, fallback);
  });

  // 2. filterAndDeduplicateSchedules (순수 뷰어 무손실 보존 및 중복 제거)
  runner.test('filterAndDeduplicateSchedules: 고유 ID 기반 중복 제거 및 무손실 보존', () => {
    // 다양한 소스(blip, mnet, youtube, custom)와 노이즈(쇼츠, 태그)가 섞인 데이터셋
    const rawItems = [
      { id: 'sched_src_a_001', title: 'Event Alpha', startTime: '2026-09-15T17:00:00+09:00' },
      { id: 'sched_src_a_001', title: 'Event Alpha (Duplicated)', startTime: '2026-09-15T17:00:00+09:00' }, // ID 중복 -> 1건만 유지
      { id: 'sched_src_b_002', title: 'Broadcast Beta', startTime: '2026-09-15T18:00:00+09:00', message: 'Contains shorts: https://youtube.com/shorts/test_id' },
      { id: 'sched_src_c_003', title: 'Live Stream Gamma', startTime: '2026-09-16T12:00:00+09:00', message: '@official_tag #hashtag' },
      { id: 'sched_src_d_004', title: 'Festival Delta', startTime: '2026-09-17T14:00:00+09:00' }
    ];

    const result = filterAndDeduplicateSchedules(rawItems);
    assert.strictEqual(result.length, 4, '동일 ID 1건만 제거되고 나머지 4건은 온전히 보존되어야 함');
    assert.strictEqual(result[0].id, 'sched_src_a_001');
    assert.strictEqual(result[1].id, 'sched_src_b_002');
    assert.strictEqual(result[2].id, 'sched_src_c_003');
    assert.strictEqual(result[3].id, 'sched_src_d_004');
  });

  runner.test('filterAndDeduplicateSchedules: 다양한 접두사(custom/manual/legacy/external) 및 미디어 링크 포함 일정 100% 보존', () => {
    const testCases = [
      { id: `custom_${Date.now()}_a1`, title: 'Manual Festival Entry', startTime: '2026-10-01T00:00:00+09:00', message: 'https://www.youtube.com/shorts/sample1' },
      { id: `blip_${Date.now()}_b2`, title: 'Official Broadcast Entry', startTime: '2026-10-02T10:00:00+09:00', message: 'https://youtube.com/watch?v=sample2' },
      { id: `mnet_${Date.now()}_c3`, title: 'Community Post Entry', startTime: '2026-10-03T15:00:00+09:00', message: 'https://instagram.com/p/sample3' }
    ];

    const result = filterAndDeduplicateSchedules(testCases);
    assert.strictEqual(result.length, testCases.length, '모든 소스의 일정이 클라이언트에서 누락 없이 100% 보존되어야 함');
    testCases.forEach((tc, idx) => {
      assert.strictEqual(result[idx].id, tc.id);
      assert.strictEqual(result[idx].title, tc.title);
    });
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
