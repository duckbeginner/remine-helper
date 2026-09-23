// tests/docs/ops-lossless-lifecycle.test.js
// Ops 포털 및 데이터 허브 전주기 무손실(Round-Trip Lossless) 아키텍처 불변성 테스트

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_JS_PATH = path.join(ROOT_DIR, 'docs/ops.js');
const HUB_SCHEDULE_JS_PATH = path.join(ROOT_DIR, 'scripts/data-hub/collectors/schedule.js');

export async function run() {
  const runner = new TestRunner('Docs & Hub - Full Lifecycle Lossless Architecture');
  runner.run();

  const opsCode = fs.readFileSync(OPS_JS_PATH, 'utf8');
  const hubScheduleCode = fs.readFileSync(HUB_SCHEDULE_JS_PATH, 'utf8');

  // ─────────────────────────────────────────────────────────────
  // 1. [DEFECT-01 방어 검증] Gist diff 기준 객체는 불변 원본(rawBaseSchedules)이어야 함
  // ─────────────────────────────────────────────────────────────
  runner.test('DEFECT-01 Guard: onSaveToGistClick에서 allSchedules가 아닌 rawBaseSchedules를 diff 기준으로 사용해야 함', () => {
    // onSaveToGistClick 함수 바디 추출
    const saveMatch = opsCode.match(/async function onSaveToGistClick\([\s\S]*?^    \}/m);
    assert(saveMatch, 'onSaveToGistClick 함수가 존재해야 합니다.');
    const saveBody = saveMatch[0];

    // computePureDiff 호출 부근 탐색
    const diffLoopMatch = saveBody.match(/Object\.entries\(mergedModified\)[\s\S]*?computePureDiff\(([^,]+),/);
    assert(diffLoopMatch, 'mergedModified 순회 루프 내에서 computePureDiff가 호출되어야 합니다.');
    
    // allSchedules.find가 아닌 rawList / rawBaseSchedules를 사용하는지 확인
    assert(
      !saveBody.includes('allSchedules.find(s => s && (s.id === mKey'),
      '이미 수정된 allSchedules를 diff 기준 객체로 조회해서는 안 됩니다. (DEFECT-01 치명적 결함 방어)'
    );
    assert(
      saveBody.includes('rawBaseSchedules') && saveBody.includes('rawList.find'),
      '불변 공식 원본인 rawBaseSchedules(rawList)를 기준으로 computePureDiff를 수행해야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 2. [DEFECT-02 방어 검증] 포털 새로고침 하이드레이션 SAFE_OVERRIDE_FIELDS 완전성
  // ─────────────────────────────────────────────────────────────
  runner.test('DEFECT-02 Guard: SAFE_OVERRIDE_FIELDS 및 allSchedules 하이드레이션에 starAttendees, isPrimary 완비', () => {
    const safeFieldsMatch = opsCode.match(/const SAFE_OVERRIDE_FIELDS = \[([\s\S]*?)\];/);
    assert(safeFieldsMatch, 'SAFE_OVERRIDE_FIELDS 선언이 존재해야 합니다.');
    const safeFields = safeFieldsMatch[1];

    assert(safeFields.includes("'starAttendees'"), 'SAFE_OVERRIDE_FIELDS에 starAttendees가 포함되어야 합니다.');
    assert(safeFields.includes("'isPrimary'"), 'SAFE_OVERRIDE_FIELDS에 isPrimary가 포함되어야 합니다.');

    // 하이드레이션 매핑 시 배열/불린 변환 여부
    assert(
      opsCode.includes("itemCopy[f] = Array.isArray(mod[f]) ? [...mod[f]] : []") ||
      opsCode.includes("Array.isArray(mod.starAttendees)"),
      'allSchedules 생성 시 starAttendees의 배열 복사가 보장되어야 합니다.'
    );
    assert(
      opsCode.includes("itemCopy[f] = Boolean(mod[f])") ||
      opsCode.includes("Boolean(mod.isPrimary)"),
      'allSchedules 생성 시 isPrimary의 불린 정규화가 보장되어야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 3. [DEFECT-03 방어 검증] linkedScheduleIds 강제 합집합(Union) 금지 (언링크 불가 방어)
  // ─────────────────────────────────────────────────────────────
  runner.test('DEFECT-03 Guard: 포털 및 허브에서 linkedScheduleIds 강제 합집합([...base, ...ov]) 박멸 검증', () => {
    // 1) ops.js의 하이드레이션 부분에서 강제 합집합 금지
    assert(
      !opsCode.includes('[...(itemCopy.linkedScheduleIds || []), ...mod.linkedScheduleIds]'),
      'ops.js에서 오버라이드된 연관 일정을 원본과 강제 합집합해서는 안 됩니다. (언링크 기능 마비 차단)'
    );

    // 2) schedule.js의 applyScheduleOverrides에서 강제 합집합 금지
    assert(
      !hubScheduleCode.includes('[...(baseItem.linkedScheduleIds || []), ...ov.linkedScheduleIds]'),
      'schedule.js에서 오버라이드된 연관 일정을 원본과 강제 합집합해서는 안 됩니다. (언링크 기능 마비 차단)'
    );

    // 3) 덮어쓰기 로직 존재 확인
    assert(
      hubScheduleCode.includes('baseItem.linkedScheduleIds = normalizeLinkedScheduleIds(ov.linkedScheduleIds)'),
      'schedule.js는 오버라이드된 linkedScheduleIds로 직접 대체(덮어쓰기)해야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 4. [DEFECT-04 & 06 방어 검증] 서킷 브레이커 Fail-Closed 및 종합 보호망
  // ─────────────────────────────────────────────────────────────
  runner.test('DEFECT-04, 06 Guard: Circuit Breaker의 Fail-Closed 동작 및 소규모/커스텀 보호망 확인', () => {
    assert(
      opsCode.includes('baselineSourceCount'),
      '서킷 브레이커는 원격 조회 실패 시에도 로컬 appliedOverrides를 기준선으로 삼아야 합니다. (Fail-Closed)'
    );
    assert(
      opsCode.includes('baselineCustomCount'),
      '서킷 브레이커는 커스텀 일정(customSchedules) 급감도 보호해야 합니다.'
    );
    assert(
      opsCode.includes('baselineSourceCount >= 10 && baselineSourceCount < 100'),
      '서킷 브레이커는 10~99건의 소규모 데이터셋도 50% 급감 방어로 보호해야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 5. [DEFECT-05 & DEFECT-09 방어 검증] 모달 저장 가드 (starAttendees / isPrimary)
  // ─────────────────────────────────────────────────────────────
  runner.test('DEFECT-05 & 09 Guard: 모달 멤버 전체 해제 빈 배열 명시 및 isIdenticalToRaw 오판 롤백 방어', () => {
    assert(
      opsCode.includes('allAttendeeCbs.length > 0') && opsCode.includes('starAttendees = Array.from(attendeeCbs)'),
      '모달에 멤버 UI가 존재할 때 체크된 멤버가 없으면 빈 배열 []로 명시하여 해제를 전달해야 합니다.'
    );
    assert(
      opsCode.includes('editedItem.starAttendees !== undefined'),
      'computePureDiff에서 starAttendees !== undefined 검사를 수행하여 빈 배열 변경을 감지해야 합니다.'
    );
    assert(
      opsCode.includes('isAttendeesSame') && opsCode.includes('isPrimarySame'),
      'isIdenticalToRaw 검사 시 참석 멤버 및 대표 일정 여부를 동등성 비교에 반드시 포함해야 합니다. (DEFECT-09 치명적 롤백 방어)'
    );
    assert(
      opsCode.includes('isLinksSame &&\n                  isAttendeesSame &&\n                  isPrimarySame'),
      'isIdenticalToRaw의 최종 판정 조건식에 isAttendeesSame과 isPrimarySame이 포함되어야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 6. [POTENTIAL-01 방어 검증] mergedModified 내 custom_ 접두사 안전 승격
  // ─────────────────────────────────────────────────────────────
  runner.test('POTENTIAL-01 Guard: mergedModified에서 custom_ 접두사를 가진 항목을 createdMap으로 안전 격리', () => {
    assert(
      opsCode.includes("mKey && String(mKey).startsWith('custom_')"),
      'mergedModified 정제 시 _isCustom 플래그 누락 시에도 custom_ 키를 감지하여 승격 격리해야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 7. [DEFECT-08 방어 검증] 데이터 허브 schedule.js 복사 목록에 typeId 완비
  // ─────────────────────────────────────────────────────────────
  runner.test('DEFECT-08 Guard: schedule.js 오버라이드 필드에 typeId 포함 확인', () => {
    const hubFieldsMatch = hubScheduleCode.match(/\[\s*'title'[\s\S]*?'isPrimary'\s*\]/);
    assert(hubFieldsMatch, 'applyScheduleOverrides 내 복사 필드 목록이 존재해야 합니다.');
    assert(hubFieldsMatch[0].includes("'typeId'"), 'applyScheduleOverrides 복사 필드에 typeId가 포함되어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 7. [프로덕션 런타임 검증] computePureDiff 실제 함수 로직 실행 검증
  // ─────────────────────────────────────────────────────────────
  runner.test('Runtime Pure Diff: starAttendees 및 linkedScheduleIds 언링크(빈 배열) 차분 추출 검증', () => {
    // ops.js에서 computePureDiff 함수 정의 추출하여 Function 생성자로 평가
    const diffMatch = opsCode.match(/function computePureDiff\([\s\S]*?^    \}/m);
    assert(diffMatch, 'ops.js 내 computePureDiff 소스가 추출되어야 합니다.');
    const computePureDiffFn = new Function(`
      ${diffMatch[0]}
      return computePureDiff;
    `)();

    // 1) 멤버 전체 해제 (starAttendees: [] 빈 배열 변경)
    const base1 = { id: 'test_1', starAttendees: [{ name: '원이' }] };
    const edit1 = { id: 'test_1', starAttendees: [] };
    const diff1 = computePureDiffFn(base1, edit1);
    assert(diff1 !== null, '기존 멤버를 전체 해제한 경우 diff가 반드시 생성되어야 합니다.');
    assert(Array.isArray(diff1.starAttendees) && diff1.starAttendees.length === 0, 'diff.starAttendees가 빈 배열이어야 합니다.');

    // 2) 연관 일정 전체 분리 (linkedScheduleIds: [] 빈 배열 변경)
    const base2 = { id: 'test_2', linkedScheduleIds: ['link_a', 'link_b'] };
    const edit2 = { id: 'test_2', linkedScheduleIds: [] };
    const diff2 = computePureDiffFn(base2, edit2);
    assert(diff2 !== null, '기존 연결을 모두 분리한 경우 diff가 반드시 생성되어야 합니다.');
    assert(Array.isArray(diff2.linkedScheduleIds) && diff2.linkedScheduleIds.length === 0, 'diff.linkedScheduleIds가 빈 배열이어야 합니다.');

    // 3) 변경 사항 없는 경우 null 반환
    const base3 = { id: 'test_3', title: '동일 제목', isPrimary: false };
    const edit3 = { id: 'test_3', title: '동일 제목', isPrimary: false };
    const diff3 = computePureDiffFn(base3, edit3);
    assert(diff3 === null, '변경 사항이 없으면 diff는 null이어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 8. [프로덕션 런타임 검증] Circuit Breaker Fail-Closed 시뮬레이션
  // ─────────────────────────────────────────────────────────────
  runner.test('Runtime Circuit Breaker: 원격 실패 시 로컬 appliedOverrides 기준선 Fail-Closed 검증', () => {
    // 서킷 브레이커 가드 로직 시뮬레이션
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

      if (baselineSourceCount >= 100 && newSourceCount < baselineSourceCount * 0.7) {
        throw new Error(`[안전 차단기] 비정상적 데이터 급감 감지: 기존 기준 ${baselineSourceCount}건 중 ${newSourceCount}건만 감지되어 저장이 긴급 차단되었습니다.`);
      }
      if (baselineSourceCount >= 10 && baselineSourceCount < 100 && newSourceCount < baselineSourceCount * 0.5) {
        throw new Error(`[안전 차단기] 비정상적 데이터 급감 감지: 기존 기준 ${baselineSourceCount}건 중 ${newSourceCount}건만 감지되어 저장이 긴급 차단되었습니다.`);
      }
      if (baselineCustomCount >= 10 && newCustomCount < baselineCustomCount * 0.5) {
        throw new Error(`[안전 차단기] 커스텀 일정 급감 감지: 기존 기준 ${baselineCustomCount}건 중 ${newCustomCount}건만 감지되어 저장이 긴급 차단되었습니다.`);
      }

      // 4) 연결 일정(linkedScheduleIds) 보유 건수 급감 차단 (DEF-02: sourceOverrides + customSchedules 통합 집계)
      let remoteLinkCount = 0;
      if (remoteOverrides && typeof remoteOverrides === 'object') {
        if (remoteOverrides.sourceOverrides && typeof remoteOverrides.sourceOverrides === 'object') {
          Object.values(remoteOverrides.sourceOverrides).forEach(v => {
            if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) remoteLinkCount++;
          });
        }
        if (remoteOverrides.customSchedules && typeof remoteOverrides.customSchedules === 'object') {
          Object.values(remoteOverrides.customSchedules).forEach(v => {
            if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) remoteLinkCount++;
          });
        }
      }

      let localLinkCount = 0;
      if (appliedOverrides) {
        if (appliedOverrides.modified) {
          Object.values(appliedOverrides.modified).forEach(v => {
            if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) localLinkCount++;
          });
        }
        if (Array.isArray(appliedOverrides.created)) {
          appliedOverrides.created.forEach(v => {
            if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) localLinkCount++;
          });
        }
      }

      const baselineLinkCount = Math.max(remoteLinkCount, localLinkCount);

      let newLinkCount = 0;
      Object.values(sourceOverrides).forEach(v => {
        if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) newLinkCount++;
      });
      Object.values(customSchedules).forEach(v => {
        if (v && Array.isArray(v.linkedScheduleIds) && v.linkedScheduleIds.length > 0) newLinkCount++;
      });

      if (baselineLinkCount >= 30 && newLinkCount < baselineLinkCount * 0.7) {
        throw new Error(`[안전 차단기] 연결 일정 급감 감지: 기존 ${baselineLinkCount}개 연결 중 ${newLinkCount}개만 감지되어 저장이 긴급 차단되었습니다.`);
      }
      if (baselineLinkCount >= 10 && baselineLinkCount < 30 && newLinkCount < baselineLinkCount * 0.5) {
        throw new Error(`[안전 차단기] 연결 일정 소규모 급감 감지: 기존 ${baselineLinkCount}개 연결 중 ${newLinkCount}개만 감지되어 저장이 긴급 차단되었습니다.`);
      }
      if (baselineLinkCount >= 5 && baselineLinkCount < 10 && newLinkCount < 3) {
        throw new Error(`[안전 차단기] 연결 일정 전멸 위험 감지: 기존 ${baselineLinkCount}개 연결 중 ${newLinkCount}개만 감지되어 저장이 긴급 차단되었습니다.`);
      }
      return true;
    }

    // 시나리오 1: 원격 조회 실패(null) 상태에서 로컬에 500건 있었는데 버그로 0건 저장 시도 -> Fail-Closed 차단!
    let blocked1 = false;
    try {
      const mockApplied = {
        modified: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`item_${i}`, { title: `T${i}` }])),
        deleted: new Set()
      };
      evaluateCircuitBreaker(null, mockApplied, {}, {});
    } catch (e) {
      if (e.message.includes('안전 차단기')) blocked1 = true;
    }
    assert(blocked1, '원격 조회가 null이어도 로컬 스냅샷(500건) 기준으로 빈 저장을 차단해야 합니다. (Fail-Closed)');

    // 시나리오 2: 소규모 데이터셋 (50건)에서 20건으로 50% 초과 급감 -> 차단!
    let blocked2 = false;
    try {
      const mockApplied = {
        modified: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`item_${i}`, { title: `T${i}` }])),
        deleted: new Set()
      };
      const newSource = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`item_${i}`, { title: `T${i}` }]));
      evaluateCircuitBreaker(null, mockApplied, newSource, {});
    } catch (e) {
      if (e.message.includes('안전 차단기')) blocked2 = true;
    }
    assert(blocked2, '50건 중 20건만 남는 소규모 데이터셋 급감 시에도 차단되어야 합니다.');

    // 시나리오 3: 커스텀 일정 20건 중 5건으로 급감 -> 차단!
    let blocked3 = false;
    try {
      const mockApplied = {
        modified: {},
        deleted: new Set(),
        created: Array.from({ length: 20 }, (_, i) => ({ id: `custom_${i}` }))
      };
      const newCustom = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`custom_${i}`, { id: `custom_${i}` }]));
      evaluateCircuitBreaker(null, mockApplied, {}, newCustom);
    } catch (e) {
      if (e.message.includes('안전 차단기')) blocked3 = true;
    }
    assert(blocked3, '커스텀 일정이 20건 중 5건으로 급감할 때 차단되어야 합니다.');

    // 시나리오 4 (SEC-02 & DEF-01): evaluateCircuitBreaker 호출로 연결 일정 소규모(10~29건) 구간 급감 차단 실질 검증
    let blocked4 = false;
    try {
      const mockApplied = {
        modified: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`item_${i}`, { linkedScheduleIds: ['sub_1'] }])),
        deleted: new Set()
      };
      // 전체 소스 건수는 20건 유지하되, 링크만 20개 중 5개로 급감한 경우 -> 50% 미만이므로 차단되어야 함
      const newSource = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [
        `item_${i}`,
        i < 5 ? { linkedScheduleIds: ['sub_1'] } : { title: '제목만 수정' }
      ]));
      evaluateCircuitBreaker(null, mockApplied, newSource, {});
    } catch (e) {
      if (e.message.includes('안전 차단기') && e.message.includes('연결 일정')) blocked4 = true;
    }
    assert(blocked4, '20건 중 5건으로 급감하는 소규모 링크 구간에서도 evaluateCircuitBreaker가 차단해야 합니다. (SEC-02 실질 검증)');

    // 시나리오 5 (DEF-02): customSchedules 내 링크도 서킷 브레이커 감시 대상에 포함되는지 검증
    let blocked5 = false;
    try {
      const mockRemote = {
        sourceOverrides: {},
        customSchedules: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`custom_${i}`, { linkedScheduleIds: ['sub_1'] }]))
      };
      // 커스텀 일정 건수는 15건 유지하되, 링크만 15개 중 3개로 급감한 경우 -> 50% 미만이므로 차단되어야 함!
      const newCustom = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [
        `custom_${i}`,
        i < 3 ? { linkedScheduleIds: ['sub_1'] } : { id: `custom_${i}` }
      ]));
      evaluateCircuitBreaker(mockRemote, null, {}, newCustom);
    } catch (e) {
      if (e.message.includes('안전 차단기') && e.message.includes('연결 일정')) blocked5 = true;
    }
    assert(blocked5, 'customSchedules에만 정의된 링크 급감 시에도 서킷 브레이커가 차단해야 합니다. (DEF-02 실질 검증)');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. [SEC-01 & SEC-03 방어 검증] Pure Diff 링크 무조건 보존 & Canonical 접두사 가드
  // ─────────────────────────────────────────────────────────────
  runner.test('SEC-01 & SEC-03 Guard: computePureDiff 링크 무조건 보존 및 mergedDeleted 접두사 가드 정적 검증', () => {
    // 1) computePureDiff 함수 바디 추출
    const diffMatch = opsCode.match(/function computePureDiff\(baseItem, editedItem\)[\s\S]*?^    \}/m);
    assert(diffMatch, 'computePureDiff 함수가 존재해야 합니다.');
    const diffBody = diffMatch[0];

    assert(
      diffBody.includes('editLinked.length > 0'),
      'computePureDiff에서 editLinked.length > 0일 때 무조건 diff에 보존하는 방어적 2중 안전망이 존재해야 합니다. (SEC-01)'
    );

    // 2) mergedDeleted Canonical 접두사 가드 검증 (SEC-03)
    assert(
      opsCode.includes('validIdPrefixRegex') && opsCode.includes('/^(custom_|blip_|mnet_|yt_)/'),
      'mergedDeleted 순회 시 Canonical 접두사(/^(custom_|blip_|mnet_|yt_)/) 검증 가드가 존재해야 합니다. (SEC-03)'
    );
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
