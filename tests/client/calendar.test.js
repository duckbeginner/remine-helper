// tests/client/calendar.test.js
// 캘린더 엔진 핵심 로직 단위 테스트 (날짜 파싱, 타이틀 정규화, 구조 분해, 중복 판별)

import { TestRunner, assert } from '../test-helper.js';
import {
  parseSafeDate,
  cleanScheduleText,
  deduplicateScheduleList,
  getScheduleTypeInfo,
  getMemberAttendeeBadgesHTML,
  createScheduleItemHTML
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

  runner.test('parseSafeDate: ISO 문자열 및 빈 값 결측치 방어 (정책 1)', () => {
    const dIso = parseSafeDate('2026-09-10T14:30:00+09:00');
    assert(!isNaN(dIso.getTime()));

    const dEmpty = parseSafeDate('');
    assert.strictEqual(dEmpty, null, '빈 값 인입 시 정책 1에 따라 null 반환');
  });

  // 2. cleanScheduleText
  runner.test('cleanScheduleText: 특수문자, 이모지, 중복 공백 제거', () => {
    const raw = '🎉 [방송] 리센느(RESCENE) - 인기가요! 🎬';
    const cleaned = cleanScheduleText(raw);
    assert.strictEqual(cleaned, '방송 리센느 rescene 인기가요');
  });

  // 3. deduplicateScheduleList: 순수 패스스루 검증
  runner.test('deduplicateScheduleList: v2.0 스케줄 패스스루 및 배열 무결성 검증', () => {
    const list = [
      { id: 'item_1', title: '스케줄 A' },
      { id: 'item_2', title: '스케줄 B' }
    ];
    const result = deduplicateScheduleList(list);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(deduplicateScheduleList([]), []);
  });

  // 4. getScheduleTypeInfo: 순수 뷰어 보존 원칙 검증 (하드코딩 배제, 일반화된 속성 매트릭스)
  runner.test('getScheduleTypeInfo [Pure Viewer]: 본문/URL 키워드와 무관하게 서버의 typeText 100% 보존', () => {
    // 다양한 공식 카테고리
    const testCategories = ['행사', '공연', '방송', '팬이벤트', '기념일', '릴리즈', '화보', '공지'];
    
    // 본문에 포함될 수 있는 유혹적인(오인 유발) 다양한 노이즈 키워드 패턴들
    const noisePatterns = [
      '@rescene_official 인스타 공지',
      '공식 유튜브 영상 공개: https://www.youtube.com/watch?v=mock123',
      '비하인드 vlog 및 쇼츠: https://www.youtube.com/shorts/mockShorts',
      '자체콘텐츠 ep.01 풀버전 릴스: https://www.instagram.com/reel/mockReel',
      '안녕하세요원이입니다잘부탁드립니다 채널 업로드'
    ];

    testCategories.forEach(cat => {
      noisePatterns.forEach(noise => {
        const mockItem = {
          id: `mock_${cat}_${Math.random().toString(36).slice(2, 7)}`,
          title: `모의 일정 (${cat})`,
          typeText: cat,
          message: noise,
          url: 'https://youtu.be/mockVid',
          location: '모의 장소'
        };

        const result = getScheduleTypeInfo(mockItem);
        // 클라이언트는 본문 노이즈에 휘둘리지 않고 서버가 준 typeText를 100% 보존해야 함!
        assert.strictEqual(
          result.typeText,
          cat,
          `본문에 "${noise}"가 포함되어 있어도 원본 카테고리 [${cat}]이 [${result.typeText}]로 변조되지 않고 온전히 보존되어야 합니다.`
        );
        assert(result.bg, '배경색 스타일이 지정되어야 합니다.');
        assert(result.color, '글자색 스타일이 지정되어야 합니다.');
      });
    });
  });

  // 5. getScheduleTypeInfo: typeText 미지정 시 안전한 최소 fallback (channel -> 방송, location -> 행사)
  runner.test('getScheduleTypeInfo [Fallback]: typeText 부재 시 channel/location 기반 기본 분류', () => {
    // channel 필드로 방송 분류
    const broadcastItem = { title: '모의 방송 프로그램', channel: '방송국 채널' };
    assert.strictEqual(getScheduleTypeInfo(broadcastItem).typeText, '방송');

    // location 필드로 행사 분류
    const eventItem = { title: '모의 현장 공연', location: '야외 공연장' };
    assert.strictEqual(getScheduleTypeInfo(eventItem).typeText, '행사');

    // 둘 다 없을 시 기본 '일정'
    const defaultItem = { title: '일반 미분류 일정' };
    assert.strictEqual(getScheduleTypeInfo(defaultItem).typeText, '일정');
  });

  // 8. 참석 멤버(starAttendees) 미니 아바타 뱃지(14px) 렌더링 (TDD)
  runner.test('getMemberAttendeeBadgesHTML: starAttendees 배열이 주어졌을 때 14px 미니 아바타 뱃지 생성', () => {
    const attendees = [
      { id: '67a5924253c0ed13ba18b38a', name: '리브' },
      { name: '원이' }
    ];
    const badgeHtml = getMemberAttendeeBadgesHTML(attendees);
    assert(badgeHtml.includes('icons/member_liv.jpeg'));
    assert(badgeHtml.includes('icons/member_woni.jpeg'));
    assert(badgeHtml.includes('title="리브"'));
    assert(badgeHtml.includes('title="원이"'));
    assert(badgeHtml.includes('14px'));
  });

  runner.test('createScheduleItemHTML: extField 없는 순수 객체 및 starAttendees 뱃지가 카드에 포함되는지 검증', () => {
    const item = {
      title: '뮤직뱅크 본방송',
      channel: 'KBS2',
      startTime: '2026-09-15T17:00:00+09:00',
      starAttendees: [{ name: '제나' }]
    };
    const html = createScheduleItemHTML(item, 0);
    // 최상위 channel 정보가 렌더링되었는지 확인
    assert(html.includes('KBS2'));
    // 제나 아바타 뱃지가 렌더링되었는지 확인
    assert(html.includes('icons/member_zena.jpeg'));
    assert(html.includes('title="제나"'));
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('calendar.test.js')) {
  run();
}
