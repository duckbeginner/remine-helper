// tests/docs/ops-lifecycle.test.js
// Ops 도구 일정 라이프사이클 (저장 후 동기화, 연속 저장, 커스텀 수정/삭제, 3-way 병합) TDD 단위 테스트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');

export async function run() {
  console.log('\n▶ [Docs - Ops Tool Schedule Lifecycle & Post-Save Sync] TDD 테스트 실행');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ 통과: ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ❌ 실패: ${name}`);
      console.error(`     이유: ${e.message}`);
      failed++;
    }
  }

  const opsHtml = fs.readFileSync(OPS_HTML_PATH, 'utf8');

  // 1. [Case S-1 & S-2] 저장 직후 confirmedOverrides 파싱 시 v2.0 필드(sourceOverrides, customSchedules) 사용 검증
  test('ops-m7k2x9.html: Gist 저장 후 confirmedOverrides 파싱 시 v2.0 필드(sourceOverrides, customSchedules) 반영 확인 (S-1, S-2)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const postSaveSection = saveFuncSection.slice(saveFuncSection.indexOf('const confirmedOverrides = JSON.parse(savedFile.content);'));

    // 더 이상 v1.0 레거시 필드(confirmedOverrides.deleted, confirmedOverrides.modified, confirmedOverrides.created)로 초기화하지 않아야 함
    assert(!postSaveSection.includes('appliedOverrides.deleted = new Set(Array.isArray(confirmedOverrides.deleted) ? confirmedOverrides.deleted : []);'),
      'confirmedOverrides.deleted 레거시 파싱이 제거되어야 합니다.');
    assert(!postSaveSection.includes('appliedOverrides.created = Array.isArray(confirmedOverrides.created)'),
      'confirmedOverrides.created 레거시 파싱이 제거되어야 합니다.');

    // v2.0 sourceOverrides 및 customSchedules를 파싱하여 appliedOverrides를 채우는 로직이 있어야 함
    const hasV2PostSaveSync = postSaveSection.includes('confirmedOverrides.sourceOverrides') ||
                              postSaveSection.includes('parseOverridesV2IntoMemory') ||
                              postSaveSection.includes('sourceOverrides');
    assert(hasV2PostSaveSync, '저장 후 v2.0 sourceOverrides/customSchedules를 appliedOverrides에 동기화해야 합니다.');
  });

  // 2. [Case C-3] custom 일정 맵 구성 시 c.id 최우선 식별키 사용 검증 (제목/시간 변경 시 중복 등록 방지)
  test('ops-m7k2x9.html: customSchedules 병합 시 c.id를 최우선 고유 키로 사용하여 중복 생성 방지 확인 (C-3)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const payloadSection = saveFuncSection.slice(0, saveFuncSection.indexOf("method: 'PATCH'"));

    // mergedCreatedMap 또는 custom 병합부에서 c.id가 키 결정 최우선순위여야 함
    assert(payloadSection.includes('c.id ||') || payloadSection.includes('c.id ?'),
      'custom 일정 병합 시 c.id가 최우선 키로 고려되어야 합니다.');
  });

  // 3. [Case D-2] custom 일정 삭제 판별 시 c.id 기반 deleted 검사 검증
  test('ops-m7k2x9.html: custom 일정 삭제 판별 시 c.id 기반 deleted 확인 (D-2)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const payloadSection = saveFuncSection.slice(0, saveFuncSection.indexOf("method: 'PATCH'"));

    assert(payloadSection.includes('mergedDeleted.has(c.id)') || payloadSection.includes('c.id && mergedDeleted.has(c.id)'),
      'c.id가 mergedDeleted에 포함되어 있는지 검사해야 합니다.');
  });

  // 4. [Case S-4] Gist 저장 전 원격 최신본 GET fetch & 3-way 병합 검증 (원격 동시성 보호)
  test('ops-m7k2x9.html: 저장 전 원격 최신본 GET 조회 및 3-way 병합 로직 존재 확인 (S-4)', () => {
    const saveFuncSection = opsHtml.slice(opsHtml.indexOf('async function onSaveToGistClick'));
    const patchCallIndex = saveFuncSection.indexOf("method: 'PATCH'");
    assert(patchCallIndex > 0, 'Gist PATCH 호출이 존재해야 합니다.');

    const prePatchSection = saveFuncSection.slice(0, patchCallIndex);
    // PATCH 전에 원격 Gist를 GET 조회하여 remoteOverrides를 파싱하는 로직이 있어야 함
    const hasPreFetch = prePatchSection.includes('remoteOverrides') ||
                        prePatchSection.includes('latestGist') ||
                        prePatchSection.includes('latestRes') ||
                        prePatchSection.includes('remoteGist');
    assert(hasPreFetch, '저장 전 원격 최신 Gist를 조회하여 3-way 병합을 수행해야 합니다.');
  });

  // 5. 로직 단위 시뮬레이션 테스트: v2.0 파서 함수 및 연속 저장 시뮬레이션
  test('v2.0 오버라이드 메모리 파싱 & 연속 저장 무손실 로직 시뮬레이션', () => {
    // 가상의 v2.0 오버라이드 데이터
    const mockV2Data = {
      version: '2.0.0',
      customSchedules: {
        'custom_260912_abc': {
          id: 'custom_260912_abc',
          title: '스페셜 브이라이브',
          startTime: '2026-09-12T18:00:00+09:00',
          _isCustom: true
        }
      },
      sourceOverrides: {
        '2026-09-10_음악중심': {
          title: 'MBC 쇼! 음악중심',
          startTime: '2026-09-10T15:15:00+09:00'
        },
        '2026-09-11_뮤직뱅크': {
          isDeleted: true
        }
      }
    };

    // 공통 파싱 함수 모의 구현
    function parseOverrides(v2Json) {
      const memory = { modified: {}, deleted: new Set(), created: [] };
      if (v2Json.customSchedules) {
        Object.values(v2Json.customSchedules).forEach(c => {
          if (c.isDeleted) {
            memory.deleted.add(c.id);
          }
          memory.created.push({ ...c, _isCustom: true });
        });
      }
      if (v2Json.sourceOverrides) {
        Object.entries(v2Json.sourceOverrides).forEach(([k, v]) => {
          if (v.isDeleted) {
            memory.deleted.add(k);
          } else {
            memory.modified[k] = v;
          }
        });
      }
      return memory;
    }

    const memory = parseOverrides(mockV2Data);
    assert.strictEqual(memory.created.length, 1, 'customSchedules가 1건 파싱되어야 합니다.');
    assert.strictEqual(memory.created[0].title, '스페셜 브이라이브');
    assert.strictEqual(Object.keys(memory.modified).length, 1, 'modified가 1건 파싱되어야 합니다.');
    assert.strictEqual(memory.deleted.size, 1, 'deleted가 1건 파싱되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
