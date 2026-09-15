// tests/data-hub/schedule-pipeline.test.js
// 스케줄 데이터 파이프라인 종합 테스트 (v2.0 ID 불변성, starAttendees 보존, extField 하위 호환, 1:1 무손실 수집, YouTube 자동 합성)

import { TestRunner, assert } from '../test-helper.js';
import {
  mergeSchedulesV2,
  slimScheduleItem,
  getMonthsToFetch,
  extractYouTubeVideoId,
  generateScheduleId
} from '../../scripts/data-hub/collectors/schedule.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Schedule Pipeline & starAttendees Integrity');
  runner.run();

  // ─────────────────────────────────────────────────────────────
  // 1. 소스별 결정론적 고유 ID 생성 및 불변성 (실제 모듈 계약 검증)
  // ─────────────────────────────────────────────────────────────
  runner.test('ID Generation: 소스별 고유 ID 결정론적 생성 및 최초 수집 ID 영구 불변성 검증', () => {
    // 1) 기존 ID가 이미 부여된 경우, 어떤 소스나 속성이 와도 기존 ID가 100% 영구 불변이어야 함
    const existingIds = ['1103438', 'blip_custom_999', 'yt_vid_abc', 'custom_240803_123456'];
    existingIds.forEach(id => {
      assert.strictEqual(generateScheduleId('blip', { id }), id, '기존 ID는 절대 변조/재발급되지 않아야 함');
      assert.strictEqual(generateScheduleId('mnet', { id }), id, '기존 ID는 절대 변조/재발급되지 않아야 함');
      assert.strictEqual(generateScheduleId('youtube', { id }), id, '기존 ID는 절대 변조/재발급되지 않아야 함');
      assert.strictEqual(generateScheduleId('custom', { id }), id, '기존 ID는 절대 변조/재발급되지 않아야 함');
    });

    // 2) 신규 수집 시 각 소스별 결정론적 ID 생성 규칙
    assert.strictEqual(generateScheduleId('blip', { scheduleId: '1103438' }), 'blip_1103438');
    assert.strictEqual(generateScheduleId('mnet', { eventId: 'event_999' }), 'mnet_event_999');
    assert.strictEqual(generateScheduleId('youtube', { videoId: 'dQw4w9WgXcQ' }), 'yt_dQw4w9WgXcQ');

    // 3) 커스텀/수동 일정의 고유 ID 형식 검증 (custom_YYMMDD_xxxxxx)
    const customId = generateScheduleId('custom', { startTime: '2026-09-15T00:00:00+09:00', title: 'Special Festival' });
    assert(customId.startsWith('custom_260915_'), `커스텀 ID는 날짜 기반 접두사로 시작해야 함: ${customId}`);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. starAttendees 보존 및 복원
  // ─────────────────────────────────────────────────────────────
  runner.test('slimScheduleItem: starAttendees 멤버 목록이 슬림화 후에도 누락 없이 보존되어야 함', () => {
    const raw = {
      id: 'blip-12345',
      title: '뮤직뱅크 본방송',
      startTime: '2026-09-15T08:00:00.000Z',
      endTime: '2026-09-15T09:30:00.000Z',
      isAllday: false,
      channel: 'KBS2',
      location: 'KBS 신관 공개홀',
      starAttendees: [
        { name: '원', profileImage: 'https://img.blip.kr/woni.jpg' },
        { name: '리브', profileImage: 'https://img.blip.kr/liv.jpg' },
        { name: '미나미', profileImage: 'https://img.blip.kr/minami.jpg' }
      ]
    };

    const slimmed = slimScheduleItem(raw);
    assert(Array.isArray(slimmed.starAttendees), 'starAttendees가 배열이어야 함');
    assert.strictEqual(slimmed.starAttendees.length, 3, '참석 멤버 3명이 모두 보존되어야 함');
    assert.strictEqual(slimmed.starAttendees[0].name, '원');
    assert.strictEqual(slimmed.starAttendees[1].name, '리브');
    assert.strictEqual(slimmed.starAttendees[2].name, '미나미');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. extField 하위 호환 보조 생성 (구버전 v1.0.3 클라이언트 완벽 호환)
  // ─────────────────────────────────────────────────────────────
  runner.test('slimScheduleItem: extField 부재 시 channel/location으로부터 하위 호환용 extField 보조 생성', () => {
    const rawWithoutExt = {
      id: 'mnet-999',
      title: '엠카운트다운',
      startTime: '2026-09-17T09:00:00.000Z',
      channel: 'Mnet',
      location: 'CJ ENM 센터'
    };

    const slimmed = slimScheduleItem(rawWithoutExt);
    assert(slimmed.extField !== undefined, 'extField가 보조 생성되어야 함');
    assert.strictEqual(slimmed.extField.key, '채널');
    assert.strictEqual(slimmed.extField.value, 'Mnet');
    assert.strictEqual(slimmed.channel, 'Mnet');
    assert.strictEqual(slimmed.location, 'CJ ENM 센터');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 동일 YouTube Video ID 자동 클러스터링 및 합성
  // ─────────────────────────────────────────────────────────────
  runner.test('mergeSchedulesV2: 동일 YouTube Video ID를 갖는 Mnet과 Blip 일정이 1건으로 자동 합성되고 starAttendees 병합', () => {
    const rawItems = [
      {
        id: 'mnet-yt-01',
        title: '[RESCENE] 신곡 MV 프리미어 공개',
        startTime: '2026-09-20T09:00:00.000Z',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        channel: 'RESCENE Official',
        source: 'mnet'
      },
      {
        id: 'blip-yt-02',
        title: '신곡 뮤직비디오 온에어',
        startTime: '2026-09-20T09:00:00.000Z',
        url: 'https://youtu.be/dQw4w9WgXcQ',
        source: 'blip',
        starAttendees: [{ name: '원' }, { name: '메이' }]
      }
    ];

    const merged = mergeSchedulesV2(rawItems, {});
    assert.strictEqual(merged.length, 1, '2건이 1건으로 합성되어야 함');
    const item = merged[0];
    assert(item.url.includes('dQw4w9WgXcQ'));
    assert.strictEqual(item.starAttendees.length, 2);
    assert(item.linkedScheduleIds.includes('mnet-yt-01'));
    assert(item.linkedScheduleIds.includes('blip-yt-02'));
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 패스트트랙 크롤링 범위 계산 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('getMonthsToFetch: 기본 실행 시 과거 1개월 ~ 미래 3개월(총 5개월) 선정 검증', () => {
    const normalMonths = getMonthsToFetch(new Date('2026-09-15'), false);
    assert.strictEqual(normalMonths.length, 5, '기본 패스트트랙은 5개월');
    assert.strictEqual(normalMonths[0].year, 2026);
    assert.strictEqual(normalMonths[0].month, 8);
    assert.strictEqual(normalMonths[4].year, 2026);
    assert.strictEqual(normalMonths[4].month, 12);

    const fullMonths = getMonthsToFetch(new Date('2026-09-15'), true);
    assert(fullMonths.length >= 36, '--full 옵션 시 최소 3년 이상 수집');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. 유튜브 URL 11자리 Video ID 추출기 무결성
  // ─────────────────────────────────────────────────────────────
  runner.test('extractYouTubeVideoId: 다양한 유튜브 URL 형식에서 11자리 Video ID 추출', () => {
    assert.strictEqual(extractYouTubeVideoId('https://www.youtube.com/watch?v=AbCdEfGhIjK'), 'AbCdEfGhIjK');
    assert.strictEqual(extractYouTubeVideoId('https://youtu.be/AbCdEfGhIjK?si=123'), 'AbCdEfGhIjK');
    assert.strictEqual(extractYouTubeVideoId('https://www.youtube.com/live/AbCdEfGhIjK'), 'AbCdEfGhIjK');
    assert.strictEqual(extractYouTubeVideoId('https://example.com/other'), null);
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('schedule-pipeline.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
