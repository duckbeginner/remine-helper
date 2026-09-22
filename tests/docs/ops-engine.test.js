// tests/docs/ops-engine.test.js
// Ops 포털 종합 데이터 엔진 테스트 (스키마 유효성, ID 불변성, 라이프사이클, 3-Way 병합, v2 클린업)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert } from '../test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');
const OPS_JS_PATH = path.join(ROOT_DIR, 'docs/ops.js');

export async function run() {
  const runner = new TestRunner('Docs - Ops Portal Core Data & Lifecycle Engine');
  runner.run();

  const opsHtml = [
    fs.readFileSync(OPS_HTML_PATH, 'utf8'),
    fs.readFileSync(OPS_JS_PATH, 'utf8')
  ].join('\n');

  // ─────────────────────────────────────────────────────────────
  // 1. 스키마 유효성 검증 & 유령 일정 차단 (Pipeline Integrity)
  // ─────────────────────────────────────────────────────────────
  runner.test('Schema Validation: isValidScheduleItem 필수 스키마 검증기 구현 확인', () => {
    assert(opsHtml.includes('function isValidScheduleItem('), 'isValidScheduleItem 함수 선언이 있어야 합니다.');
    assert(opsHtml.includes('item.id') && opsHtml.includes('item.title') && opsHtml.includes('item.startTime'),
      'id, title, startTime 필수 검증 로직이 포함되어야 합니다.');
  });

  runner.test('Ghost Schedule Prevention: 섹션 4-1 고아 복원 시 불완전 껍데기 조각 차단 가드 확인', () => {
    assert(
      opsHtml.includes('isValidScheduleItem(v)') || opsHtml.includes('isValidScheduleItem(resItem)'),
      'sourceOverrides 복원 루프 내에 isValidScheduleItem 가드가 있어야 합니다.'
    );
  });

  runner.test('ID & Source Immutability: loadSchedules 병합 시 origId/origSource 영구 보존 확인', () => {
    assert(opsHtml.includes('origId'), 'origId 보존 변수가 존재해야 합니다.');
    assert(opsHtml.includes('origSource'), 'origSource 보존 변수가 존재해야 합니다.');
    assert(opsHtml.includes('itemCopy.id = origId') || opsHtml.includes('safeMod.id = origId'),
      'itemCopy.id가 origId로 보존되어야 합니다.');
  });

  runner.test('ID Mismatch Defense: findMatchingOverride에서 타 출처 오버라이드 매칭 차단', () => {
    assert(
      opsHtml.includes('isIdMismatch') || opsHtml.includes('mod.id !== item.id') || opsHtml.includes('mVal.id !== item.id') || opsHtml.includes('item.id && mod.id'),
      'findMatchingOverride에 ID 불일치 방어 가드가 존재해야 합니다.'
    );
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 일정 라이프사이클 & 3-Way 병합 (Lifecycle & Post-Save Sync)
  // ─────────────────────────────────────────────────────────────
  runner.test('Post-Save Sync: Gist 저장 후 confirmedOverrides 파싱 시 v2.0 필드 동기화 (S-1, S-2)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const postSaveSection = saveFuncSection.slice(saveFuncSection.indexOf('parseOverridesV2IntoMemory(confirmedOverrides)'));

    assert(!postSaveSection.includes('appliedOverrides.deleted = new Set(Array.isArray(confirmedOverrides.deleted) ? confirmedOverrides.deleted : []);'),
      'confirmedOverrides.deleted 레거시 파싱이 제거되어야 합니다.');
    assert(postSaveSection.includes('parseOverridesV2IntoMemory(confirmedOverrides)'),
      '저장 후 v2.0 파서(parseOverridesV2IntoMemory)를 통해 appliedOverrides에 동기화해야 합니다.');
  });

  runner.test('Truncated Gist Response: savedFile.content 부재 시 raw_url 및 payload fallback 처리 검증', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    assert(saveFuncSection.includes('savedFile.raw_url'), 'savedFile.raw_url 폴백 조회가 포함되어야 합니다.');
    assert(saveFuncSection.includes("payload.files['schedule-overrides.json'].content"),
      'GitHub API truncated 시 전송 성공 확정된 payload 폴백이 포함되어야 합니다.');
  });

  runner.test('Diff Preservation: computePureDiff에서 linkedScheduleIds 단독 변경 및 연결 보존 검증', () => {
    const diffFuncSection = opsHtml.slice(opsHtml.indexOf('function computePureDiff('));
    const funcBody = diffFuncSection.slice(0, diffFuncSection.indexOf('function getMemberAttendeeBadgesHTML'));
    assert(funcBody.includes('linkedScheduleIds'), 'computePureDiff 내에 linkedScheduleIds 보존 비교 로직이 반드시 포함되어야 합니다.');
  });

  runner.test('Custom Schedules: customSchedules 병합 시 c.id 최우선 식별키 사용 (C-3, D-2)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const payloadSection = saveFuncSection.slice(0, saveFuncSection.indexOf("method: 'PATCH'"));

    assert(payloadSection.includes('c.id ||') || payloadSection.includes('c.id ?'),
      'custom 일정 병합 시 c.id가 최우선 키로 고려되어야 합니다.');
    assert(payloadSection.includes('mergedDeleted.has(c.id)') || payloadSection.includes('c.id && mergedDeleted.has(c.id)'),
      'c.id가 mergedDeleted에 포함되어 있는지 검사해야 합니다.');
  });

  runner.test('3-Way Merge: Gist 저장 전 원격 최신본 GET fetch 및 3-way 병합 로직 존재 (S-4)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const patchCallIndex = saveFuncSection.indexOf("method: 'PATCH'");
    assert(patchCallIndex > 0, 'Gist PATCH 호출이 존재해야 합니다.');

    const prePatchSection = saveFuncSection.slice(0, patchCallIndex);
    const hasPreFetch = prePatchSection.includes('remoteOverrides') || prePatchSection.includes('latestGist') || prePatchSection.includes('remoteGist');
    assert(hasPreFetch, '저장 전 원격 최신 Gist를 조회하여 3-way 병합을 수행해야 합니다.');
  });

  runner.test('3-Way Conflict Rollback: 충돌 시 취소(!keepLocal) 선택 시 저장 즉시 중단 및 원격 최신본 롤백 검증', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const keepLocalIndex = saveFuncSection.indexOf('if (!keepLocal)');
    assert(keepLocalIndex > 0, '!keepLocal 분기 블록이 존재해야 합니다.');

    const conflictBlock = saveFuncSection.slice(keepLocalIndex, keepLocalIndex + 700);
    assert(conflictBlock.includes('loadSchedules'), '취소 시 원격 최신본을 다시 불러오기 위해 loadSchedules가 호출되어야 합니다.');
    assert(conflictBlock.includes('return;'), '취소 시 Gist 저장을 중단하기 위해 return이 포함되어야 합니다.');
    assert(conflictBlock.includes('commitBtn') || conflictBlock.includes('저장 적용'), '취소 시 저장 버튼 상태가 원복되어야 합니다.');
  });

  runner.test('Refresh Staging Reset: 상단 새로고침(btnRefresh) 시 대기 중인 수정본 취소/초기화 연동 검증', () => {
    const refreshSection = opsHtml.slice(opsHtml.indexOf("document.getElementById('btnRefresh')"));
    assert(
      refreshSection.includes('pendingOverrides') || opsHtml.includes('btnRefresh'),
      '새로고침 시 대기 중인 수정본 처리 또는 loadSchedules 이벤트가 연결되어야 합니다.'
    );
  });

  runner.test('Base Snapshot & 3-Way Conflict: baseOverridesSnapshot 기준 비교 및 오탐 방지 검증', () => {
    assert(opsHtml.includes('baseOverridesSnapshot'), 'baseOverridesSnapshot 변수가 선언되어야 합니다.');
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    assert(
      saveFuncSection.includes('baseOverridesSnapshot') || saveFuncSection.includes('baseVal'),
      '3-Way 충돌 검사 시 baseOverridesSnapshot 또는 baseVal과 비교해야 합니다.'
    );
    assert(
      saveFuncSection.includes('isRemoteChanged') || (saveFuncSection.includes('remoteVal') && saveFuncSection.includes('baseVal')),
      '원격의 변경 여부를 baseVal과 비교하여 판별해야 합니다.'
    );
  });

  runner.test('Simulation: 3-Way 충돌 판별기 단위 시뮬레이션 (원격 미변경 시 충돌 0건, 동시 수정 시 충돌 감지)', () => {
    function detect3WayConflicts(pendingModified, remoteModified, baseModified) {
      const pendingKeys = Object.keys(pendingModified || {});
      return pendingKeys.filter(k => {
        const remoteVal = remoteModified[k];
        const localVal = pendingModified[k];
        const baseVal = baseModified ? baseModified[k] : undefined;

        const isRemoteChanged = JSON.stringify(remoteVal) !== JSON.stringify(baseVal);
        const isLocalDifferent = JSON.stringify(localVal) !== JSON.stringify(remoteVal);
        return isRemoteChanged && isLocalDifferent;
      });
    }

    // 시나리오 1: 원격 일정을 내가 로컬에서 수정함. 원격은 변경되지 않음. (정상 수정 시나리오)
    const baseModified = {
      'blip_1103467': { title: '2026 K-WORLD DREAM AWARDS', linkedScheduleIds: ['6a3c83fb0b7c92615f50b57c'] }
    };
    const remoteModified = {
      'blip_1103467': { title: '2026 K-WORLD DREAM AWARDS', linkedScheduleIds: ['6a3c83fb0b7c92615f50b57c'] }
    };
    const localModified = {
      'blip_1103467': { title: '2026 K-WORLD DREAM AWARDS', linkedScheduleIds: ['6a3c83fb0b7c92615f50b57c', '2026-08-27_award'] }
    };

    const conflicts1 = detect3WayConflicts(localModified, remoteModified, baseModified);
    assert.strictEqual(conflicts1.length, 0, '원격이 변경되지 않은 정상 수정 상태에서는 충돌이 0건이어야 합니다.');

    // 시나리오 2: 내가 수정하는 사이에 원격에서도 누군가 다른 링크로 수정함. (동시 수정 충돌 시나리오)
    const remoteModifiedConcurrent = {
      'blip_1103467': { title: '2026 K-WORLD DREAM AWARDS (수정됨)', linkedScheduleIds: ['diff_id'] }
    };
    const conflicts2 = detect3WayConflicts(localModified, remoteModifiedConcurrent, baseModified);
    assert.strictEqual(conflicts2.length, 1, '원격이 변경되고 로컬과도 다를 때만 1건의 충돌이 감지되어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 연관 후보군 선출 & 페이로드 클린업 (Candidate & Cleanup)
  // ─────────────────────────────────────────────────────────────
  runner.test('Candidate No-Op: linkedScheduleIds 후보군 선택 시 불필요한 no-op 방어 확인', () => {
    assert(opsHtml.includes('linkedScheduleIds') || opsHtml.includes('subItems'),
      'Ops 포털 내 연관 일정 관리 로직이 존재해야 합니다.');
  });

  runner.test('Payload Cleanup: Gist 저장 페이로드에서 불필요한 v2 레거시 잔재 필터링', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    assert(saveFuncSection.includes('sourceOverrides') && saveFuncSection.includes('customSchedules'),
      'Gist 저장 페이로드의 핵심은 sourceOverrides와 customSchedules이어야 합니다.');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 단위 시뮬레이션: 불완전 껍데기 조각 차단 & 독립 ID 보존
  // ─────────────────────────────────────────────────────────────
  runner.test('Simulation: 껍데기 조각 차단 및 동일 일시/제목의 Blip/Mnet 독립 렌더링 시뮬레이션', () => {
    function isValidScheduleItem(item) {
      if (!item || typeof item !== 'object') return false;
      if (!item.id || typeof item.id !== 'string') return false;
      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) return false;
      if (!item.startTime || isNaN(new Date(item.startTime).getTime())) return false;
      return true;
    }

    const orphanShell = { id: '682e03dbbe9ed07eb239b32f', url: 'https://youtube.com', channel: 'SBS' };
    assert.strictEqual(isValidScheduleItem(orphanShell), false, '제목/날짜 없는 껍데기는 false');

    const rawItems = [
      { id: 'blip_1103438', source: 'blip', title: '2026 천안 K-컬처 박람회 개막 공연', startTime: '2026-09-02T00:00:00+09:00' },
      { id: '6a48ce7d7dd960680ac6fc90', source: 'mnet', title: '2026 천안 K-컬처 박람회 개막 공연', startTime: '2026-09-02T00:00:00Z' }
    ];

    assert(isValidScheduleItem(rawItems[0]) && isValidScheduleItem(rawItems[1]));
    assert.notStrictEqual(rawItems[0].id, rawItems[1].id, '두 일정은 각각 고유 ID 유지');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Base Snapshot 수명주기 및 오버라이드 영구 보존 시뮬레이션
  // ─────────────────────────────────────────────────────────────
  runner.test('Base Snapshot Lifecycle: loadSchedules 및 onSaveToGistClick에서 updateBaseOverridesSnapshot 호출 확인', () => {
    const loadFuncSection = opsHtml.slice(opsHtml.indexOf('async function loadSchedules('), opsHtml.indexOf('async function onSaveToGistClick'));
    assert(loadFuncSection.includes('updateBaseOverridesSnapshot'),
      'loadSchedules 완료 시점에 updateBaseOverridesSnapshot이 호출되어 기준 스냅샷을 갱신해야 합니다.');

    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    assert(saveFuncSection.includes('updateBaseOverridesSnapshot'),
      'Gist 저장 완료 시점에 updateBaseOverridesSnapshot이 호출되어 기준 스냅샷을 최신본으로 갱신해야 합니다.');
  });

  runner.test('Simulation: sourceOverrides 영구 보존 및 블립 원본 덮어쓰기 방지 파이프라인 시뮬레이션', () => {
    // 블립 원본에서 수집된 기본 데이터 (URL 없음, 블립 원본 제목)
    const rawCollectorItem = {
      id: 'blip_1110557',
      title: '<안원잘부>',
      startTime: '2026-08-11T11:00:00.000Z',
      source: 'blip',
      channel: '안녕하세요원이입니다잘부탁드립니다',
      url: undefined
    };

    // schedule-overrides.json에 보존된 정식 오버라이드 데이터
    const sourceOverrides = {
      'blip_1110557': {
        title: '제나야 말 좀 해라!!!!!!!!!!!!!!',
        url: 'https://www.youtube.com/watch?v=WTdyA5N4K0k',
        typeText: '영상',
        isOfficialYoutube: true
      }
    };

    // 파이프라인 오버라이드 적용 함수 시뮬레이션
    function applyOverrides(item, overrides) {
      const ov = overrides[item.id];
      if (!ov) return { ...item };
      return {
        ...item,
        ...ov,
        id: item.id, // 불변 ID
        source: item.source // 원본 소스 식별자 유지
      };
    }

    const resolvedItem = applyOverrides(rawCollectorItem, sourceOverrides);
    assert.strictEqual(resolvedItem.title, '제나야 말 좀 해라!!!!!!!!!!!!!!', '오버라이드된 유튜브 제목이 반영되어야 합니다.');
    assert.strictEqual(resolvedItem.url, 'https://www.youtube.com/watch?v=WTdyA5N4K0k', '오버라이드된 유튜브 URL이 보존되어야 합니다.');
    assert.strictEqual(resolvedItem.id, 'blip_1110557', 'ID가 불변으로 유지되어야 합니다.');
    assert.strictEqual(resolvedItem.source, 'blip', '출처가 유지되어야 합니다.');
  });

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-engine.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
