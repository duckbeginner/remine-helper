// tests/data-hub/schedule-pipeline.test.js
// 스케줄 데이터 파이프라인 개편 (starAttendees 보존, extField 하위 호환, 1:1 무손실 수집, YouTube 자동 합성) 검증

import { TestRunner, assert } from '../test-helper.js';
import {
  mergeSchedulesV2,
  slimScheduleItem,
  getMonthsToFetch,
  extractYouTubeVideoId
} from '../../scripts/data-hub/collectors/schedule.js';

export async function run() {
  const runner = new TestRunner('Data Hub - Schedule Pipeline & starAttendees Integrity');
  runner.run();

  // 1. slimScheduleItem: starAttendees 복원 및 보존 검증
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
    assert(slimmed.starAttendees.length === 3, '참석 멤버 3명이 모두 보존되어야 함');
    assert(slimmed.starAttendees[0].name === '원', '첫 번째 멤버 이름 일치');
    assert(slimmed.starAttendees[1].name === '리브', '두 번째 멤버 이름 일치');
    assert(slimmed.starAttendees[2].name === '미나미', '세 번째 멤버 이름 일치');
  });

  // 2. slimScheduleItem: extField 유예 보조 생성 (구버전 v1.0.3 클라이언트 완벽 호환)
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
    assert(slimmed.extField.key === '채널' && slimmed.extField.value === 'Mnet', 'extField는 { key: "채널", value: "Mnet" } 형태여야 함');
    assert(slimmed.channel === 'Mnet', '최상위 channel 필드도 유지되어야 함');
    assert(slimmed.location === 'CJ ENM 센터', '최상위 location 필드도 유지되어야 함');
  });

  // 3. mergeSchedulesV2: 동일 YouTube Video ID를 가진 일정의 자동 클러스터링 및 메타데이터/starAttendees 합성
  runner.test('mergeSchedulesV2: 동일 YouTube Video ID를 갖는 Mnet과 Blip 일정이 1건으로 자동 합성되고 starAttendees가 병합되어야 함', () => {
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
        starAttendees: [
          { name: '원' },
          { name: '메이' },
          { name: '제나' }
        ]
      }
    ];

    const merged = mergeSchedulesV2(rawItems, {});
    assert(merged.length === 1, `2건이 1건으로 합성되어야 하나 ${merged.length}건임`);
    
    const item = merged[0];
    assert(item.url.includes('dQw4w9WgXcQ'), 'YouTube Video ID 보존');
    assert(Array.isArray(item.starAttendees), '합성 후 starAttendees 배열이 존재해야 함');
    assert(item.starAttendees.length === 3, 'Blip의 참석 멤버 3명이 합성 결과에 보존되어야 함');
    assert(item.linkedScheduleIds.includes('mnet-yt-01'), 'linkedScheduleIds에 mnet ID 포함');
    assert(item.linkedScheduleIds.includes('blip-yt-02'), 'linkedScheduleIds에 blip ID 포함');
  });

  // 4. getMonthsToFetch: 패스트트랙 크롤링 범위 계산 검증
  runner.test('getMonthsToFetch: 기본 실행 시 과거 1개월 ~ 미래 3개월(총 5개월)만 수집 대상으로 선정되어야 함', () => {
    const normalMonths = getMonthsToFetch(new Date('2026-09-15'), false);
    assert(normalMonths.length === 5, `기본 패스트트랙은 5개월이어야 하나 ${normalMonths.length}개월임`);
    assert(normalMonths[0].year === 2026 && normalMonths[0].month === 8, '시작월은 8월(-1개월)');
    assert(normalMonths[4].year === 2026 && normalMonths[4].month === 12, '종료월은 12월(+3개월)');

    const fullMonths = getMonthsToFetch(new Date('2026-09-15'), true);
    assert(fullMonths.length >= 36, '--full 옵션 시 최소 3년(36개월) 이상 수집');
  });

  // 5. extractYouTubeVideoId: 정규식 파서 무결성
  runner.test('extractYouTubeVideoId: 다양한 유튜브 URL 형식에서 11자리 Video ID 추출', () => {
    assert(extractYouTubeVideoId('https://www.youtube.com/watch?v=AbCdEfGhIjK') === 'AbCdEfGhIjK', 'watch?v= 형식');
    assert(extractYouTubeVideoId('https://youtu.be/AbCdEfGhIjK?si=123') === 'AbCdEfGhIjK', 'youtu.be 단축 형식');
    assert(extractYouTubeVideoId('https://www.youtube.com/live/AbCdEfGhIjK') === 'AbCdEfGhIjK', 'live 스트림 형식');
    assert(extractYouTubeVideoId('https://example.com/other') === null, '유튜브가 아닌 일반 URL은 null');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('schedule-pipeline.test.js')) {
  run();
}
