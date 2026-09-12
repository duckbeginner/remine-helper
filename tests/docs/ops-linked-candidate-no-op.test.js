// tests/docs/ops-linked-candidate-no-op.test.js
// Ops 도구 연관 일정 연결 시 미선택된 무관한 인접 후보 일정이 수정 대기열에 오염 등록되지 않는지 검증하는 TDD 단위 테스트

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const OPS_HTML_PATH = path.join(ROOT_DIR, 'docs/ops-m7k2x9.html');

export async function run() {
  console.log('\n▶ [Docs - Ops Tool Linked Candidates No-Op Isolation] TDD 테스트 실행');
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

  // 1. ops-m7k2x9.html의 모달 저장 핸들러 내 linked-cand-cb 처리에서 상태 변경 여부(linkStateChanged / 상태 전이) 조건문 검증
  test('ops-m7k2x9.html: 연관 일정 후보 순회 시 연결 상태가 실제로 변경된 경우에만 pendingOverrides.modified에 등록하는지 검증', () => {
    const formSubmitIdx = opsHtml.indexOf("document.getElementById('scheduleEditForm').addEventListener('submit'");
    assert(formSubmitIdx > 0, 'scheduleEditForm submit 이벤트 리스너가 존재해야 합니다.');

    const formSubmitSection = opsHtml.slice(formSubmitIdx, formSubmitIdx + 8000);
    const candCbsBlock = formSubmitSection.slice(formSubmitSection.indexOf('.linked-cand-cb'));

    // 미선택된 후보가 무조건 pendingOverrides.modified에 들어가는 기존 취약 패턴 방지
    // 실제로 연결 상태가 변경되었는지 확인하는 조건문이 존재해야 함
    const hasChangeCheck = candCbsBlock.includes('linkStateChanged') ||
                          candCbsBlock.includes('isLinkChanged') ||
                          candCbsBlock.includes('wasLinked !== isChecked') ||
                          candCbsBlock.includes('isCurrentlyLinked !== isChecked') ||
                          candCbsBlock.includes('hasLinkStateChanged');

    assert(hasChangeCheck, '연관 일정 후보 순회 시 실제 연결 상태 변경 여부를 검사하는 조건문이 있어야 합니다.');
  });

  // 2. 단위 로직 시뮬레이션: A 일정 수정 시 후보 B(미연결/미선택)와 C(신규 연결) 처리 검증
  test('연관 일정 양방향 연결 로직 시뮬레이션: 미선택 후보 B는 수정 대기열에 포함되지 않아야 함', () => {
    const currentId = 'item_A';
    const schedules = [
      { id: 'item_A', title: '한국방송대상 축하공연', linkedScheduleIds: [] },
      { id: 'item_B', title: '사나의 냉터뷰', linkedScheduleIds: [] }, // 미선택 후보
      { id: 'item_C', title: '53회 한국방송대상 축하공연', linkedScheduleIds: [] } // 신규 선택 후보
    ];

    const pendingModified = {};

    // 시뮬레이션: candCbs 중 C만 체크됨 (isChecked: true), B는 체크 안 됨 (isChecked: false)
    const mockCheckboxes = [
      { targetId: 'item_B', isChecked: false },
      { targetId: 'item_C', isChecked: true }
    ];

    mockCheckboxes.forEach(({ targetId, isChecked }) => {
      const targetItem = schedules.find(s => s.id === targetId);
      if (!targetItem) return;

      const origLinked = Array.isArray(targetItem.linkedScheduleIds) ? [...targetItem.linkedScheduleIds] : [];
      const wasLinked = origLinked.includes(currentId);
      const linkStateChanged = wasLinked !== isChecked;

      if (!linkStateChanged) {
        // 상태 변경이 없으면 절대 수정 대기열에 넣지 않음!
        return;
      }

      let tLinked = [...origLinked];
      if (isChecked) {
        if (!tLinked.includes(currentId)) tLinked.push(currentId);
      } else {
        tLinked = tLinked.filter(id => id !== currentId);
      }
      targetItem.linkedScheduleIds = tLinked;
      targetItem._isModified = true;
      pendingModified[targetId] = { ...targetItem };
    });

    assert.strictEqual(pendingModified['item_B'], undefined, '미선택 후보 B(사나의 냉터뷰)는 pendingModified에 들어가지 않아야 합니다.');
    assert(pendingModified['item_C'] !== undefined, '신규 선택된 후보 C는 pendingModified에 정상 등록되어야 합니다.');
    assert(pendingModified['item_C'].linkedScheduleIds.includes('item_A'), '후보 C는 item_A와 양방향 연결되어야 합니다.');
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  });
}
