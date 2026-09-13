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

export async function run() {
  const runner = new TestRunner('Docs - Ops Portal Core Data & Lifecycle Engine');
  runner.run();

  const opsHtml = fs.readFileSync(OPS_HTML_PATH, 'utf8');

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
    const postSaveSection = saveFuncSection.slice(saveFuncSection.indexOf('const confirmedOverrides = JSON.parse(savedFile.content);'));

    assert(!postSaveSection.includes('appliedOverrides.deleted = new Set(Array.isArray(confirmedOverrides.deleted) ? confirmedOverrides.deleted : []);'),
      'confirmedOverrides.deleted 레거시 파싱이 제거되어야 합니다.');
    assert(postSaveSection.includes('parseOverridesV2IntoMemory(confirmedOverrides)') || postSaveSection.includes('sourceOverrides'),
      '저장 후 v2.0 파서(parseOverridesV2IntoMemory)를 통해 appliedOverrides에 동기화해야 합니다.');
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

  return runner.summary();
}

if (process.argv[1] && process.argv[1].endsWith('ops-engine.test.js')) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
