// tests/data-hub/pipeline-mode.test.js
// 수집 파이프라인 2중 운영 모드 (auto 빠른 반영 / review 관리자 검수) 및 Ops 2트랙 마스터 아카이브 검증

import { TestRunner, assert } from '../test-helper.js';
import { mergeSchedulesV2 } from '../../scripts/data-hub/collectors/schedule.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Dual Pipeline Operation Modes & 2-Track Master');
  runner.run();

  // 모의 원본 수집 데이터
  const mockRawSchedules = [
    {
      source: 'mnet',
      id: 'mnet_music_show',
      title: 'MBC <쇼! 음악중심> 생방송',
      startTime: '2026-09-19T15:00:00+09:00',
      isAllday: false,
      typeText: '방송',
      url: 'https://www.youtube.com/watch?v=abc12345678'
    },
    {
      source: 'blip',
      id: 'blip_music_show',
      title: '쇼! 음악중심',
      startTime: '2026-09-19T15:00:00+09:00',
      isAllday: false,
      url: 'https://youtu.be/abc12345678',
      starAttendees: [{ name: '원이' }, { name: '리브' }]
    },
    {
      source: 'blip',
      id: 'blip_vote_item',
      title: '<2026 SKA> 아이돌챔프 실시간 투표',
      startTime: '2026-09-19T12:00:00+09:00',
      isAllday: true,
      message: '투표 링크: https://...'
    },
    {
      source: 'blip',
      id: 'blip_popup_notice',
      title: '<Scent Archive - MEMORIES OF RESCENE POP-UP> 안내 (Notice)',
      startTime: '2026-09-15T00:00:00+09:00',
      isAllday: true,
      message: '더현대 서울 팝업스토어 안내'
    },
    {
      source: 'mnet',
      id: 'mnet_univ_festival',
      title: '2026 서울대학교 축제',
      startTime: '2026-09-17T18:00:00+09:00',
      isAllday: false,
      typeText: '공연'
    }
  ];

  // ─────────────────────────────────────────────────────────────
  // 1. 빠른 반영 모드 (mode: 'auto' 또는 미지정 기본값) 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Auto Mode: 정상 일정은 즉시 배포(activeItems), 필터 탈락 일정은 masterItems에 보존되어야 함', () => {
    const overrides = {
      pipelineConfig: { mode: 'auto' },
      filterRules: {
        enabled: true,
        excludeKeywords: ['투표', '안내 (Notice)']
      }
    };

    const result = mergeSchedulesV2(mockRawSchedules, overrides);
    assert(Array.isArray(result), '결과는 배열이어야 함 (하위 호환성)');
    assert(Array.isArray(result.masterItems), '결과에는 전수 검수용 masterItems 배열이 첨부되어야 함');

    // activeItems (확장 배포용) 검증
    const activeIds = result.map(it => it.id);
    assert(activeIds.includes('blip_music_show'), '음악방송(Mnet+Blip 합성본)은 activeItems에 즉시 포함되어야 함');
    assert(activeIds.includes('mnet_univ_festival'), '대학 축제는 activeItems에 즉시 포함되어야 함');
    assert(!activeIds.includes('blip_vote_item'), '투표는 activeItems에서 제외되어야 함');
    assert(!activeIds.includes('blip_popup_notice'), '미수정 안내 공지는 activeItems에서 제외되어야 함');

    // masterItems (Ops 전수 검수용) 검증: 탈락된 일정도 버려지지 않고 모두 존재해야 함!
    const masterIds = result.masterItems.map(it => it.id);
    assert(masterIds.includes('blip_vote_item'), '투표 일정도 masterItems에는 누락 없이 보존되어야 함');
    assert(masterIds.includes('blip_popup_notice'), '공지 일정도 masterItems에는 누락 없이 보존되어야 함');

    // 필터 사유 검증
    const voteInMaster = result.masterItems.find(it => it.id === 'blip_vote_item');
    assert(voteInMaster && voteInMaster._filterReason, 'masterItems의 탈락 항목에는 _filterReason이 명시되어야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 관리자 오버라이드 보호(isProtected) 검증 (팝업스토어 누락 방지)
  // ─────────────────────────────────────────────────────────────
  runner.test('Protection Override: 원본 제목에 제외 키워드가 있어도 오버라이드 등록 시 activeItems에 100% 통과', () => {
    const overrides = {
      pipelineConfig: { mode: 'auto' },
      filterRules: {
        enabled: true,
        excludeKeywords: ['안내 (Notice)']
      },
      sourceOverrides: {
        blip_popup_notice: {
          id: 'blip_popup_notice',
          title: '[Scent Archive - MEMORIES OF RESCENE] POP-UP',
          location: '더현대 서울'
        }
      }
    };

    const result = mergeSchedulesV2(mockRawSchedules, overrides);
    const activeIds = result.map(it => it.id);
    assert(activeIds.includes('blip_popup_notice'), '오버라이드가 있는 팝업스토어는 필터 키워드를 무시하고 activeItems에 포함되어야 함');

    const popupItem = result.find(it => it.id === 'blip_popup_notice');
    assert.strictEqual(popupItem.title, '[Scent Archive - MEMORIES OF RESCENE] POP-UP', '수정된 제목이 적용되어야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 관리자 검수 모드 (mode: 'review') 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Review Mode: 미승인 신규 일정은 activeItems에서 보류되고, 승인된 일정만 activeItems에 배포되어야 함', () => {
    const overrides = {
      pipelineConfig: {
        mode: 'review',
        approvedScheduleIds: ['blip_music_show'] // 음악방송만 관리자가 승인
      },
      filterRules: {
        enabled: true,
        excludeKeywords: ['투표']
      },
      customSchedules: {
        custom_urgent: {
          id: 'custom_urgent',
          title: '긴급 공지 팬미팅',
          startTime: '2026-09-20T00:00:00+09:00'
        }
      }
    };

    const result = mergeSchedulesV2(mockRawSchedules, overrides);

    // activeItems 검증:
    const activeIds = result.map(it => it.id);
    assert(activeIds.includes('blip_music_show'), '승인된 음악방송은 activeItems에 포함되어야 함');
    assert(activeIds.includes('custom_urgent'), '커스텀 일정은 검수 모드여도 activeItems에 포함되어야 함');
    assert(!activeIds.includes('mnet_univ_festival'), '미승인된 대학축제는 review 모드에서 activeItems에 배포되지 않아야 함 (보류)');

    // masterItems 검증: Ops 포털에서는 미승인 일정도 확인 가능해야 함
    const festivalInMaster = result.masterItems.find(it => it.id === 'mnet_univ_festival');
    assert(festivalInMaster !== undefined, '미승인 대학축제도 masterItems에는 존재해야 함');
    assert(festivalInMaster._isPendingReview === true, '미승인 일정은 _isPendingReview: true 플래그가 붙어야 함');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 대표 ID만 승인했을 때 연관 서브 일정도 함께 배포에 포함되어 합성되는지 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Cluster Awareness: 연관 서브 ID나 대표 ID 중 하나만 승인해도 전체 클러스터가 승인되어 정상 합성되어야 함', () => {
    const overrides = {
      pipelineConfig: {
        mode: 'review',
        approvedScheduleIds: ['mnet_music_show'] // 서브 ID 1개만 승인
      }
    };

    const result = mergeSchedulesV2(mockRawSchedules, overrides);
    assert.strictEqual(result.length, 1, '승인된 음악방송 1건만 배포되어야 함');
    const synthesized = result[0];
    assert.strictEqual(synthesized.id, 'blip_music_show', '대표 ID로 단일 배포되어야 함');
    assert(Array.isArray(synthesized.starAttendees) && synthesized.starAttendees.length === 2, '서브 일정(blip)의 starAttendees가 누락 없이 합성되어야 함');
  });

  return runner.summary();
}

// 직접 실행 지원
if (process.argv[1].endsWith('pipeline-mode.test.js')) {
  run().then(res => {
    if (res && res.failed > 0) process.exit(1);
  });
}
