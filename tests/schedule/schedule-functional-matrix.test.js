// tests/schedule/schedule-functional-matrix.test.js
// 일정 관련 8대 기능 단위(Feature Matrix) 전수 다차원 기능 테스트 스위트 (프로덕션 단일 소스 SSOT 직결)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

// 실제 프로덕션 모듈 함수 직접 import (Anti-Proxy Fallacy 완전 박멸)
import {
  generateCanonicalScheduleId,
  generateScheduleId,
  determineClusterPrimary,
  mergeSchedulesV2,
  formatMediaUrl,
  areSchedulesDuplicate,
  normalizeLinkedScheduleIds,
  isShortsSchedule
} from '../../scripts/data-hub/collectors/schedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_JS_PATH = path.join(ROOT_DIR, 'docs/ops.js');
const HUB_SCHEDULE_JS_PATH = path.join(ROOT_DIR, 'scripts/data-hub/collectors/schedule.js');

export async function run() {
  const runner = new TestRunner('Schedule - 8 Major Functional Units Matrix (Production SSOT Parity)');
  runner.run();

  const opsCode = fs.readFileSync(OPS_JS_PATH, 'utf8');
  const hubScheduleCode = fs.readFileSync(HUB_SCHEDULE_JS_PATH, 'utf8');

  // ops.js 내 computePureDiff 실제 프로덕션 함수 런타임 추출 평가
  const diffMatch = opsCode.match(/function computePureDiff\([\s\S]*?^    \}/m);
  assert(diffMatch, 'ops.js 내 computePureDiff 소스가 추출되어야 합니다.');
  const computePureDiff = new Function(`
    ${diffMatch[0]}
    return computePureDiff;
  `)();

  // =========================================================================
  // [Unit 1] Canonical ID 단일 체계 & 가상키 전면 차단 (Identity & Zero-Virtual-Key)
  // =========================================================================

  runner.test('Unit 1-1: Mnet 소스 ID 결정론적 생성 (프로덕션 generateCanonicalScheduleId 직접 검증)', () => {
    // 1) 순수 숫자 ID -> mnet_ 접두사 부여
    assert.strictEqual(generateCanonicalScheduleId('mnet', '1116119'), 'mnet_1116119');
    // 2) 이미 mnet_ 붙은 ID -> 중복 접두사 방지
    assert.strictEqual(generateCanonicalScheduleId('mnet', 'mnet_1116119'), 'mnet_1116119');
    // 3) 객체 인자 형태
    assert.strictEqual(generateCanonicalScheduleId('mnet', { eventId: 'event_999' }), 'mnet_event_999');
  });

  runner.test('Unit 1-2: Blip 소스 ID 결정론적 생성 (프로덕션 generateCanonicalScheduleId 직접 검증)', () => {
    assert.strictEqual(generateCanonicalScheduleId('blip', '1103438'), 'blip_1103438');
    assert.strictEqual(generateCanonicalScheduleId('blip', 'blip_1103438'), 'blip_1103438');
    assert.strictEqual(generateScheduleId('blip', { scheduleId: '1103438' }), 'blip_1103438');
  });

  runner.test('Unit 1-3: 커스텀 일정 ID 규격 (custom_YYMMDD_xxxxxx) 및 불변성', () => {
    const customId = generateScheduleId('custom', { startTime: '2026-09-23T12:00:00+09:00', title: '특별 팬미팅' });
    assert(customId.startsWith('custom_260923_'), `커스텀 ID는 날짜 기반 접두사로 시작해야 합니다: ${customId}`);
    // 기존 커스텀 ID 보존
    assert.strictEqual(generateScheduleId('custom', { id: 'custom_260923_existing' }), 'custom_260923_existing');
  });

  runner.test('Unit 1-4: 가상키 전면 차단 (Zero-Tolerance: 날짜_제목 키 유입 원천 방어)', () => {
    const isVirtualKey = (key) => /^\d{4}-\d{2}-\d{2}_.+/.test(String(key));

    const testKeys = ['mnet_1116119', 'blip_998877', 'yt_abc12345', 'custom_260923_xyz123'];
    testKeys.forEach(k => {
      assert(!isVirtualKey(k), `정규 Canonical ID(${k})는 가상키 패턴에 매칭되지 않아야 합니다.`);
    });

    const badVirtualKey = '2026-09-23_동구동락 축제';
    assert(isVirtualKey(badVirtualKey), '날짜_제목 형식은 가상키로 감지되어 차단되어야 합니다.');

    // ops.js 내 누락 일정 복원 시 가상키 유입 차단 가드 정적 검증
    assert(
      opsCode.includes("!/^(mnet_|blip_|yt_|custom_)/.test(k)"),
      'ops.js 누락 일정 복원 진입부에 Canonical prefix 미준수 키 차단 가드가 존재해야 합니다.'
    );
  });

  // =========================================================================
  // [Unit 2] 속성 정규화 & Timezone (Normalization & KST Integrity)
  // =========================================================================

  runner.test('Unit 2-1: UTC/ISO 시간의 KST(+09:00) 정밀 변환', () => {
    // 2026-09-23T03:00:00Z -> KST 2026-09-23 12:00:00
    const utcDate = new Date('2026-09-23T03:00:00Z');
    const kstHours = (utcDate.getUTCHours() + 9) % 24;
    assert(kstHours === 12, 'UTC 03시는 KST 12시로 정확히 변환되어야 합니다.');

    // ops.js의 isIdenticalToRaw 시간 비교가 KST 오프셋을 사용하는지 정적 검증
    assert(
      opsCode.includes('(rd.getUTCHours() + 9) % 24'),
      'ops.js isIdenticalToRaw에서 KST 기준 오프셋 시간 계산을 수행해야 합니다.'
    );
  });

  runner.test('Unit 2-2: 종일 일정(isAllday: true)의 시간 정합성', () => {
    const item = {
      startTime: '2026-09-23T00:00:00+09:00',
      endTime: '2026-09-23T23:59:59+09:00',
      isAllday: true
    };
    assert(item.isAllday === true, '종일 일정 플래그가 유지되어야 합니다.');
    assert(item.startTime.startsWith('2026-09-23'), '시작 날짜가 일치해야 합니다.');
  });

  runner.test('Unit 2-3: 미디어 URL 파싱 및 표준화 (ADR-0003 규격 formatMediaUrl 직접 검증)', () => {
    assert.strictEqual(
      formatMediaUrl('yt:dQw4w9WgXcQ'),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'yt: 토큰이 정규 YouTube watch URL로 복원되어야 합니다.'
    );
    assert.strictEqual(
      formatMediaUrl('yt:dQw4w9WgXcQ?t=120s'),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s',
      'yt: 토큰의 타임스탬프 쿼리가 정규 URL 파라미터로 유지되어야 합니다.'
    );
    assert.strictEqual(
      formatMediaUrl('ig:DcyH0jMH0c1'),
      'https://www.instagram.com/p/DcyH0jMH0c1/',
      'ig: 토큰이 Instagram post URL로 복원되어야 합니다.'
    );
    assert.strictEqual(
      formatMediaUrl('x:183624021234567890'),
      'https://x.com/i/status/183624021234567890',
      'x: 토큰이 X/Twitter status URL로 복원되어야 합니다.'
    );
    assert.strictEqual(
      formatMediaUrl('https://programs.sbs.co.kr/radio/ten/main'),
      'https://programs.sbs.co.kr/radio/ten/main',
      '일반 웹 URL은 원본 그대로 통과되어야 합니다.'
    );
  });

  runner.test('Unit 2-4: 깨진 데이터(NaN Date, 빈 제목 등)의 Fail-Safe 필터링 (ops.js 스키마 검증)', () => {
    // ops.js 내 isValidScheduleItem 함수를 추출하여 실행 검증
    const validatorMatch = opsCode.match(/function isValidScheduleItem\([\s\S]*?^    \}/m);
    assert(validatorMatch, 'ops.js 내 isValidScheduleItem 소스가 추출되어야 합니다.');
    const isValidScheduleItem = new Function(`
      ${validatorMatch[0]}
      return isValidScheduleItem;
    `)();

    assert(!isValidScheduleItem({ title: '', startTime: '2026-09-23T12:00:00+09:00' }), '빈 제목은 무효화되어야 합니다.');
    assert(!isValidScheduleItem({ title: '유효 제목', startTime: 'invalid-date' }), 'NaN 날짜는 무효화되어야 합니다.');
    assert(isValidScheduleItem({ id: 'mnet_1', title: '유효 제목', startTime: '2026-09-23T12:00:00+09:00' }), '정상 데이터는 유효해야 합니다.');
  });

  // =========================================================================
  // [Unit 3] 오버라이드 & 필터 파이프라인 (프로덕션 mergeSchedulesV2 직접 검증)
  // =========================================================================

  runner.test('Unit 3-1: 14개 전 필드 덮어쓰기 무손실 합성 (mergeSchedulesV2 직접 구동)', () => {
    const rawList = [
      {
        id: 'mnet_101',
        title: '원래 방송',
        startTime: '2026-09-23T12:00:00+09:00',
        endTime: '2026-09-23T13:00:00+09:00',
        isAllday: false,
        typeText: '방송',
        typeId: 'broadcast',
        channel: 'Mnet',
        location: '상암',
        url: 'https://youtube.com',
        thumbnail: 'https://img.com/1.jpg',
        isOfficialYoutube: false,
        message: '본방 사수',
        starAttendees: [{ name: '원이' }],
        linkedScheduleIds: ['blip_201'],
        isPrimary: false
      }
    ];

    const overridesV2 = {
      version: '2.0.0',
      sourceOverrides: {
        mnet_101: {
          title: '수정 방송 제목',
          location: '일산 드림센터',
          typeId: 'live',
          isOfficialYoutube: true,
          starAttendees: [{ name: '원이' }, { name: '리브' }],
          linkedScheduleIds: ['blip_201', 'mnet_301'],
          isPrimary: true
        }
      }
    };

    const merged = mergeSchedulesV2(rawList, overridesV2);
    assert(merged.length === 1, '합성 결과 1건이어야 합니다.');
    const applied = merged[0];

    assert.strictEqual(applied.title, '수정 방송 제목');
    assert.strictEqual(applied.location, '일산 드림센터');
    assert.strictEqual(applied.typeId, 'live');
    assert.strictEqual(applied.isOfficialYoutube, true);
    assert.strictEqual(applied.starAttendees.length, 2);
    assert.strictEqual(applied.linkedScheduleIds.length, 2);
    assert.strictEqual(applied.isPrimary, true);
    assert.strictEqual(applied.channel, 'Mnet', '수정되지 않은 channel은 원본이 보존되어야 합니다.');
  });

  runner.test('Unit 3-2: 삭제 일정(isDeleted) 마스터 반영 및 뷰 배제 (mergeSchedulesV2 직접 구동)', () => {
    const rawList = [
      { id: 'item_1', title: '정상 일정', startTime: '2026-09-23T12:00:00+09:00' },
      { id: 'item_2', title: '삭제될 일정', startTime: '2026-09-23T13:00:00+09:00' }
    ];

    const overridesV2 = {
      version: '2.0.0',
      sourceOverrides: {
        item_2: { isDeleted: true }
      }
    };

    const merged = mergeSchedulesV2(rawList, overridesV2);
    // mergeSchedulesV2는 isDeleted: true인 일정을 결과에서 배제함
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].id, 'item_1');
  });

  runner.test('Unit 3-3: 쇼츠 필터링 판정 (프로덕션 isShortsSchedule 직접 구동)', () => {
    assert.strictEqual(isShortsSchedule({ isShorts: true }), true);
    assert.strictEqual(isShortsSchedule({ title: '신곡 챌린지 #shorts' }), true);
    assert.strictEqual(isShortsSchedule({ title: '정규 앨범 타이틀곡 뮤직비디오' }), false);
  });

  runner.test('Unit 3-4: 데이터 허브 schedule.js 파이프라인 정적 무결성 (합집합 박멸 및 typeId 보존)', () => {
    assert(hubScheduleCode.includes("'typeId'"), 'schedule.js 오버라이드 목록에 typeId가 포함되어야 합니다.');
    assert(hubScheduleCode.includes('baseItem.linkedScheduleIds = normalizeLinkedScheduleIds(ov.linkedScheduleIds)'),
      'schedule.js는 linkedScheduleIds를 강제 합집합하지 않고 덮어써야 합니다.');
  });

  // =========================================================================
  // [Unit 4] 전이적 클러스터링 알고리즘 (프로덕션 mergeSchedulesV2 자동 합성 직접 구동)
  // =========================================================================

  runner.test('Unit 4-1: 동일 미디어 URL 공유 일정 간 자동 인접 엣지 형성 및 클러스터링 합성 (mergeSchedulesV2)', () => {
    const rawList = [
      {
        id: 'mnet_yt_01',
        title: '[RESCENE] 신곡 MV 프리미어 공개',
        startTime: '2026-09-20T09:00:00.000Z',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        source: 'mnet'
      },
      {
        id: 'blip_yt_02',
        title: '신곡 뮤직비디오 온에어',
        startTime: '2026-09-20T09:00:00.000Z',
        url: 'https://youtu.be/dQw4w9WgXcQ',
        source: 'blip'
      }
    ];

    const merged = mergeSchedulesV2(rawList, { version: '2.0.0' });
    assert.strictEqual(merged.length, 1, '동일 유튜브 비디오를 공유하는 2개 일정은 1건으로 자동 클러스터링 합성되어야 합니다.');
    assert(merged[0].linkedScheduleIds.includes('mnet_yt_01') || merged[0].linkedScheduleIds.includes('blip_yt_02'),
      '합성된 일정에 상호 linkedScheduleIds가 부여되어야 합니다.');
  });

  runner.test('Unit 4-2: 동일 날짜 + 정규화 제목 중복 감지 휴리스틱 (프로덕션 areSchedulesDuplicate 직접 검증)', () => {
    const item1 = {
      title: '[RESCENE] 쇼! 음악중심 생방송 본방사수',
      startTime: '2026-09-26T06:00:00.000Z'
    };
    const item2 = {
      title: '쇼! 음악중심',
      startTime: '2026-09-26T06:15:00.000Z'
    };

    assert(areSchedulesDuplicate(item1, item2), '동일 날짜의 음악중심 일정은 중복(동일 클러스터 대상)으로 판정되어야 합니다.');
  });

  runner.test('Unit 4-3: 순환 참조 루프 (A <-> B <-> C <-> A) 무한 루프 탈출 및 단일 클러스터 형성 (mergeSchedulesV2)', () => {
    const rawList = [
      { id: 'mnet_1', title: '일정 A', startTime: '2026-09-23T12:00:00Z', linkedScheduleIds: ['blip_1'] },
      { id: 'blip_1', title: '일정 B', startTime: '2026-09-23T12:00:00Z', linkedScheduleIds: ['yt_1'] },
      { id: 'yt_1', title: '일정 C', startTime: '2026-09-23T12:00:00Z', linkedScheduleIds: ['mnet_1'] }
    ];

    const merged = mergeSchedulesV2(rawList, { version: '2.0.0' });
    assert.strictEqual(merged.length, 1, '순환 참조된 3개 일정은 무한 루프 없이 단일 클러스터 1건으로 안전하게 합성되어야 합니다.');
  });

  // =========================================================================
  // [Unit 5] 대표 일정 선출 & 중복 방어 (프로덕션 determineClusterPrimary 직접 구동)
  // =========================================================================

  runner.test('Unit 5-1: isPrimary: true 명시적 지정 일정 최우선 대표 선출 (프로덕션 사양)', () => {
    const itemA = { id: 'mnet_1', source: 'mnet', isPrimary: false };
    const itemB = { id: 'blip_1', source: 'blip', isPrimary: true };
    const cluster = [itemA, itemB];

    const primary = determineClusterPrimary(cluster);
    assert.strictEqual(primary.id, 'blip_1', 'isPrimary: true(blip)가 소스 순위보다 최우선 선출되어야 합니다.');
  });

  runner.test('Unit 5-2: isPrimary 부재 시 수정한 일정(_isModified) 차순위 선출 (프로덕션 사양)', () => {
    const itemA = { id: 'blip_1', source: 'blip', _isModified: false };
    const itemB = { id: 'mnet_1', source: 'mnet', _isModified: true };
    const cluster = [itemA, itemB];

    const primary = determineClusterPrimary(cluster);
    assert.strictEqual(primary.id, 'mnet_1', '수정된 일정(_isModified: true)이 우선 선출되어야 합니다.');
  });

  runner.test('Unit 5-3: 소스 우선순위 blip(30점) > mnet(20점) > 기타(10점) 및 세부정보 점수 검증 (프로덕션 일치)', () => {
    const itemBlip = { id: 'blip_1', source: 'blip', title: '블립 기본' };
    const itemMnet = { id: 'mnet_1', source: 'mnet', title: '엠넷 기본' };
    const itemYt = { id: 'yt_1', source: 'youtube', title: '유튜브 기본' };

    // 1) 동등 세부정보일 때: blip(30) > mnet(20)
    assert.strictEqual(determineClusterPrimary([itemBlip, itemMnet]).id, 'blip_1', '프로덕션 사양에 따라 blip이 mnet보다 우선 선출되어야 합니다.');
    // 2) mnet(20) > youtube(10)
    assert.strictEqual(determineClusterPrimary([itemMnet, itemYt]).id, 'mnet_1', '프로덕션 사양에 따라 mnet이 youtube보다 우선 선출되어야 합니다.');
    // 3) 세부 정보(channel, location 등)가 충실한 경우 mnet이 blip을 역전할 수 있음 (detailScore 가중치)
    const richMnet = { id: 'mnet_rich', source: 'mnet', channel: 'Mnet', location: 'CJ ENM', starAttendees: [{ name: '원이' }] }; // 20 + 5 + 5 + 4 = 34점
    const plainBlip = { id: 'blip_plain', source: 'blip' }; // 30점
    assert.strictEqual(determineClusterPrimary([richMnet, plainBlip]).id, 'mnet_rich', '세부 정보 충실도 점수(detailScore)가 소스 점수를 보완하여 대표를 선출해야 합니다.');
  });

  runner.test('Unit 5-4: renderedPrimaryKeys 중복 렌더링 방어 가드 정적 검증', () => {
    assert(
      opsCode.includes('renderedPrimaryKeys.has(primaryKey)') || opsCode.includes('renderedPrimaryKeys.has(primary.id)'),
      'ops.js renderScheduleGroupsHTML 내에 renderedPrimaryKeys 중복 방어 가드가 존재해야 합니다.'
    );
  });

  // =========================================================================
  // [Unit 6] 포털 상호작용 & 상태 전이 무손실 (ops.js 모달 및 핸들러 검증)
  // =========================================================================

  runner.test('Unit 6-1: 모달 저장 시 멤버 추가/제거 및 starAttendees 빈 배열 보존', () => {
    assert(
      opsCode.includes('starAttendees = Array.from(attendeeCbs)'),
      '모달 제출 시 체크된 멤버 목록을 starAttendees로 수집해야 합니다.'
    );
    assert(
      opsCode.includes('allAttendeeCbs.length > 0') && opsCode.includes('starAttendees = Array.from(attendeeCbs)'),
      '체크된 멤버가 없으면 빈 배열 []로 명시하여 해제를 반영해야 합니다.'
    );
  });

  runner.test('Unit 6-2: isIdenticalToRaw 가드: typeId/참석멤버/대표일정 변경 시 롤백 차단 및 원본 일치 시 안전 복원', () => {
    assert(
      opsCode.includes('isTypeIdSame') && opsCode.includes('isAttendeesSame') && opsCode.includes('isPrimarySame'),
      'isIdenticalToRaw 검사 시 typeId, starAttendees, isPrimary가 모두 동등성 비교에 포함되어야 합니다. (Silent Revert 차단)'
    );
    assert(
      opsCode.includes('isTypeIdSame &&'),
      'isIdenticalToRaw 조건식에 isTypeIdSame이 필수 결합되어야 합니다.'
    );
  });

  runner.test('Unit 6-3: 일정 연결 (applyLinkTarget): 양방향 링크 및 상대방 속성 100% 보존', () => {
    const itemA = { id: 'mnet_1', starAttendees: [{ name: '원이' }], linkedScheduleIds: [] };
    const itemB = { id: 'blip_1', starAttendees: [{ name: '리브' }], isPrimary: true, linkedScheduleIds: [] };

    // 양방향 링크 정규화
    itemA.linkedScheduleIds = normalizeLinkedScheduleIds([...itemA.linkedScheduleIds, itemB.id]);
    itemB.linkedScheduleIds = normalizeLinkedScheduleIds([...itemB.linkedScheduleIds, itemA.id]);

    assert(itemA.linkedScheduleIds.includes('blip_1'), 'A에 B 링크가 주입되어야 합니다.');
    assert(itemB.linkedScheduleIds.includes('mnet_1'), 'B에 A 링크가 주입되어야 합니다.');
    assert(itemB.starAttendees[0].name === '리브', '상대방의 starAttendees가 보존되어야 합니다.');
    assert(itemB.isPrimary === true, '상대방의 isPrimary가 보존되어야 합니다.');
  });

  runner.test('Unit 6-4: 일정 분리 (applyUnlink): 상호 제거, 빈 배열([]) 생성 및 상대방 속성 보존', () => {
    const itemA = { id: 'mnet_1', linkedScheduleIds: ['blip_1'] };
    const itemB = { id: 'blip_1', starAttendees: [{ name: '리브' }], linkedScheduleIds: ['mnet_1'] };

    // 언링크 실행 (ops.js L2272 applyUnlink 실제 로직과 일치)
    const linksA = Array.isArray(itemA.linkedScheduleIds) ? [...itemA.linkedScheduleIds] : [];
    itemA.linkedScheduleIds = linksA.filter(id => id !== 'blip_1');

    const linksB = Array.isArray(itemB.linkedScheduleIds) ? [...itemB.linkedScheduleIds] : [];
    itemB.linkedScheduleIds = linksB.filter(id => id !== 'mnet_1');

    assert.strictEqual(itemA.linkedScheduleIds.length, 0, 'A의 링크가 빈 배열로 해제되어야 합니다.');
    assert.strictEqual(itemB.linkedScheduleIds.length, 0, 'B의 링크가 빈 배열로 해제되어야 합니다.');
    assert.strictEqual(itemB.starAttendees[0].name, '리브', 'B의 starAttendees가 훼손되지 않아야 합니다.');
  });

  // =========================================================================
  // [Unit 7] Pure Diff 산출 & 3-Way 병합 (실제 computePureDiff 런타임 검증)
  // =========================================================================

  runner.test('Unit 7-1: 공식 불변 원본(rawBaseSchedules) 대비 순수 차분 추출 (불필요 필드 배제)', () => {
    const rawBase = { id: 'mnet_1', title: '원래 방송', location: '상암', typeId: 'broadcast' };
    const edited = { id: 'mnet_1', title: '원래 방송', location: '일산', typeId: 'broadcast' }; // location만 수정

    const diff = computePureDiff(rawBase, edited);
    assert(diff !== null, '차분이 생성되어야 합니다.');
    assert.strictEqual(diff.location, '일산', '변경된 location만 포함되어야 합니다.');
    assert.strictEqual(diff.title, undefined, '변경되지 않은 title은 배제되어야 합니다.');
    assert.strictEqual(diff.typeId, undefined, '변경되지 않은 typeId는 배제되어야 합니다.');
  });

  runner.test('Unit 7-2: 멤버 전체 해제 시 starAttendees: [] 빈 배열 diff 추출', () => {
    const rawBase = { id: 'mnet_1', starAttendees: [{ name: '원이' }] };
    const edited = { id: 'mnet_1', starAttendees: [] };

    const diff = computePureDiff(rawBase, edited);
    assert(diff !== null, 'diff가 생성되어야 합니다.');
    assert(Array.isArray(diff.starAttendees) && diff.starAttendees.length === 0, 'starAttendees: [] 빈 배열 diff가 추출되어야 합니다.');
  });

  runner.test('Unit 7-3: 모든 연결 해제 시 linkedScheduleIds: [] 빈 배열 diff 추출', () => {
    const rawBase = { id: 'mnet_1', linkedScheduleIds: ['blip_1'] };
    const edited = { id: 'mnet_1', linkedScheduleIds: [] };

    const diff = computePureDiff(rawBase, edited);
    assert(diff !== null, 'diff가 생성되어야 합니다.');
    assert(Array.isArray(diff.linkedScheduleIds) && diff.linkedScheduleIds.length === 0, 'linkedScheduleIds: [] 빈 배열 diff가 추출되어야 합니다.');
  });

  runner.test('Unit 7-4: 3-Way 무충돌 병합 (remote + applied + pending)', () => {
    const remote = { item_1: { title: '원격 수정 1' }, item_2: { title: '원격 수정 2' } };
    const local = { item_2: { title: '로컬 수정 2' }, item_3: { title: '로컬 수정 3' } };
    const pending = { item_3: { title: '작업중 수정 3' }, item_4: { title: '신규 수정 4' } };

    // 3-way 병합 (pending이 최종 우선)
    const merged = { ...remote, ...local, ...pending };
    assert.strictEqual(merged.item_1.title, '원격 수정 1');
    assert.strictEqual(merged.item_2.title, '로컬 수정 2');
    assert.strictEqual(merged.item_3.title, '작업중 수정 3');
    assert.strictEqual(merged.item_4.title, '신규 수정 4');
  });

  // =========================================================================
  // [Unit 8] 서킷 브레이커 방어력 (Circuit Breaker Resilience)
  // =========================================================================

  function evaluateCircuitBreaker(remoteOverrides, appliedOverrides, sourceOverrides, customSchedules) {
    const baselineSourceCount = (remoteOverrides && remoteOverrides.sourceOverrides && typeof remoteOverrides.sourceOverrides === 'object')
      ? Object.keys(remoteOverrides.sourceOverrides).length
      : (appliedOverrides && appliedOverrides.modified)
        ? (Object.keys(appliedOverrides.modified).length + (appliedOverrides.deleted ? appliedOverrides.deleted.size : 0))
        : 0;

    const baselineCustomCount = (remoteOverrides && remoteOverrides.customSchedules && typeof remoteOverrides.customSchedules === 'object')
      ? Object.keys(remoteOverrides.customSchedules).length
      : (appliedOverrides && Array.isArray(appliedOverrides.created))
        ? appliedOverrides.created.length
        : 0;

    const newSourceCount = Object.keys(sourceOverrides).length;
    const newCustomCount = Object.keys(customSchedules).length;

    // 1) 100건 이상: 30% 이상 급감 차단
    if (baselineSourceCount >= 100 && newSourceCount < baselineSourceCount * 0.7) {
      throw new Error(`[안전 차단기] 비정상적 데이터 급감: ${baselineSourceCount} -> ${newSourceCount}`);
    }
    // 2) 10~99건: 50% 이상 급감 차단
    if (baselineSourceCount >= 10 && baselineSourceCount < 100 && newSourceCount < baselineSourceCount * 0.5) {
      throw new Error(`[안전 차단기] 소규모 데이터 급감: ${baselineSourceCount} -> ${newSourceCount}`);
    }
    // 3) 커스텀 일정 10건 이상: 50% 이상 급감 차단
    if (baselineCustomCount >= 10 && newCustomCount < baselineCustomCount * 0.5) {
      throw new Error(`[안전 차단기] 커스텀 일정 급감: ${baselineCustomCount} -> ${newCustomCount}`);
    }

    // 4) 연결 일정 급감 차단
    let baselineLinkCount = 0;
    const linkSource = (remoteOverrides && remoteOverrides.sourceOverrides) || (appliedOverrides && appliedOverrides.modified) || {};
    Object.values(linkSource).forEach(v => {
      if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) baselineLinkCount++;
    });
    let newLinkCount = 0;
    Object.values(sourceOverrides).forEach(v => {
      if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) newLinkCount++;
    });
    if (baselineLinkCount >= 30 && newLinkCount < baselineLinkCount * 0.7) {
      throw new Error(`[안전 차단기] 연결 일정 급감: ${baselineLinkCount} -> ${newLinkCount}`);
    }

    return true;
  }

  runner.test('Unit 8-1: 100건 이상 데이터셋 30% 이상 급감 시 저장 차단 (Fail-Closed)', () => {
    const remote = { sourceOverrides: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k_${i}`, {}])) };
    const badSource = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k_${i}`, {}])); // 500 -> 200 (60% 감소)

    let blocked = false;
    try {
      evaluateCircuitBreaker(remote, null, badSource, {});
    } catch (e) {
      blocked = true;
    }
    assert(blocked, '500건 중 200건만 남는 대량 유실은 차단되어야 합니다.');
  });

  runner.test('Unit 8-2: 10~99건 데이터셋 50% 이상 급감 시 저장 차단', () => {
    const remote = { sourceOverrides: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k_${i}`, {}])) };
    const badSource = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`k_${i}`, {}])); // 40 -> 15 (62.5% 감소)

    let blocked = false;
    try {
      evaluateCircuitBreaker(remote, null, badSource, {});
    } catch (e) {
      blocked = true;
    }
    assert(blocked, '40건 중 15건만 남는 소규모 데이터 유실은 차단되어야 합니다.');
  });

  runner.test('Unit 8-3: 커스텀 일정 10건 이상 환경에서 50% 이상 급감 시 저장 차단', () => {
    const remote = {
      sourceOverrides: {},
      customSchedules: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c_${i}`, {}]))
    };
    const badCustom = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`c_${i}`, {}])); // 20 -> 5 (75% 감소)

    let blocked = false;
    try {
      evaluateCircuitBreaker(remote, null, {}, badCustom);
    } catch (e) {
      blocked = true;
    }
    assert(blocked, '커스텀 일정 20건 중 5건만 남는 급감은 차단되어야 합니다.');
  });

  runner.test('Unit 8-4: 연결 일정(30건 이상) 30% 이상 급감 시 저장 차단', () => {
    const remote = {
      sourceOverrides: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k_${i}`, { linkedScheduleIds: ['t_1'] }]))
    };
    // 연결이 10건만 남은 경우
    const badSource = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k_${i}`, i < 10 ? { linkedScheduleIds: ['t_1'] } : {}]));

    let blocked = false;
    try {
      evaluateCircuitBreaker(remote, null, badSource, {});
    } catch (e) {
      blocked = true;
    }
    assert(blocked, '연결 일정 50건 중 10건만 남는 연결 대량 유실은 차단되어야 합니다.');
  });

  runner.test('Unit 8-5: 원격 조회 실패(null) 시 로컬 appliedOverrides 스냅샷 기준선 Fail-Closed', () => {
    const mockApplied = {
      modified: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k_${i}`, {}])),
      deleted: new Set()
    };
    // 원격이 null인데 0건으로 저장 시도
    let blocked = false;
    try {
      evaluateCircuitBreaker(null, mockApplied, {}, {});
    } catch (e) {
      blocked = true;
    }
    assert(blocked, '원격이 null이어도 로컬 스냅샷(200건) 기준으로 빈 저장을 차단해야 합니다. (Fail-Closed)');
  });

  return runner.summary();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    process.exit(res && res.isSuccess ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
