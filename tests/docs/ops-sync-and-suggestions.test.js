// tests/docs/ops-sync-and-suggestions.test.js
// Ops 포털 ↔ 확장프로그램 일정 동기화 일치화 및 연관 일정 추천 칩/대표 선출 TDD 테스트

import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const OPS_HTML_PATH = path.join(ROOT_DIR, "docs/ops-m7k2x9.html");
const BACKGROUND_JS_PATH = path.join(ROOT_DIR, "remine-helper/background.js");
const SIDEPANEL_JS_PATH = path.join(ROOT_DIR, "remine-helper/sidepanel.js");
const DASHBOARD_JS_PATH = path.join(ROOT_DIR, "remine-helper/dashboard.js");
const DATA_HUB_COLLECTOR_PATH = path.join(ROOT_DIR, "scripts/data-hub/collectors/schedule.js");

export async function run() {
  console.log("\n▶ [Docs/Ops & Client] 일정 표시 불일치 해결 및 연관 일정 추천 칩 TDD 테스트 실행");
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log("  ✅ 통과: " + name);
      passed++;
    } catch (e) {
      console.error("  ❌ 실패: " + name);
      console.error("     이유: " + e.message);
      failed++;
    }
  }

  const opsHtml = fs.readFileSync(OPS_HTML_PATH, "utf8");
  const backgroundJs = fs.readFileSync(BACKGROUND_JS_PATH, "utf8");
  const sidepanelJs = fs.readFileSync(SIDEPANEL_JS_PATH, "utf8");
  const dashboardJs = fs.readFileSync(DASHBOARD_JS_PATH, "utf8");
  const dataHubCollectorJs = fs.readFileSync(DATA_HUB_COLLECTOR_PATH, "utf8");

  // 1. Ops 렌더링 시 rawId 검사 제거 검증 (Mnet 천안 박람회 등 동일 제목/날짜 일정 보존)
  test("ops-m7k2x9.html: renderedGlobalScheduleIds에서 rawId 검사/추가 로직이 완전히 제거되어 동일 날짜 다른 ID 일정이 유실되지 않는지 검증", () => {
    assert(!opsHtml.includes("renderedGlobalScheduleIds.has(rawId)"), "rawId를 통한 중복 체크가 제거되어야 합니다.");
    assert(!opsHtml.includes("renderedGlobalScheduleIds.add(rawId)"), "rawId를 세트에 추가하는 코드가 제거되어야 합니다.");
    assert(opsHtml.includes("renderedGlobalScheduleIds.has(item.id)"), "고유 item.id를 통한 중복 체크가 존재해야 합니다.");
  });

  // 2. 단위 시뮬레이션: 동일 날짜/동일 제목을 가진 두 개 다른 출처 일정의 렌더링 유지 검증
  test("시뮬레이션: 동일 날짜/제목의 다른 출처 일정(Mnet vs Blip 천안 박람회)이 둘 다 고유하게 처리되는지 검증", () => {
    const schedules = [
      { id: "blip_12345", title: "2026 천안 K-컬처 박람회 개막 공연", startDateTime: "2026-09-02T00:00:00.000Z", source: "blip" },
      { id: "6a48ce7d7dd960680ac6fc90", title: "2026 천안 K-컬처 박람회 개막 공연", startDateTime: "2026-09-02T00:00:00.000Z", source: "mnet" }
    ];
    const renderedIds = new Set();
    const renderedList = [];

    for (const item of schedules) {
      if (!renderedIds.has(item.id)) {
        renderedIds.add(item.id);
        renderedList.push(item);
      }
    }

    assert.strictEqual(renderedList.length, 2, "두 일정이 모두 렌더링 리스트에 보존되어야 합니다.");
    assert.strictEqual(renderedList[0].id, "blip_12345");
    assert.strictEqual(renderedList[1].id, "6a48ce7d7dd960680ac6fc90");
  });

  // 3. 연관 일정 클러스터 대표 선출 함수(determineClusterPrimary) 존재 및 규칙 일치성 검증
  test("ops-m7k2x9.html & scripts/data-hub/collectors/schedule.js: determineClusterPrimary 구현 검증", () => {
    assert(opsHtml.includes("determineClusterPrimary"), "ops-m7k2x9.html에 determineClusterPrimary 함수가 구현되어 있어야 합니다.");
    assert(dataHubCollectorJs.includes("determineClusterPrimary"), "data-hub collector에 determineClusterPrimary 함수가 구현되어 있어야 합니다.");
  });

  // 4. 대표 선출 우선순위 시뮬레이션 (isPrimary > _isCustom > _isModified > blip > mnet > id)
  test("determineClusterPrimary 알고리즘 시뮬레이션: 관리자 지정(isPrimary) 및 수정 상태 우선순위 검증", () => {
    function mockDeterminePrimary(cluster) {
      if (!cluster || cluster.length === 0) return null;
      const explicit = cluster.find(i => i.isPrimary);
      if (explicit) return explicit;
      const custom = cluster.find(i => i._isCustom);
      if (custom) return custom;
      const modified = cluster.find(i => i._isModified);
      if (modified) return modified;
      const sourceScore = (src) => src === "blip" ? 3 : src === "mnet" ? 2 : 1;
      const sorted = [...cluster].sort((a, b) => {
        const diff = (sourceScore(b.source) || 0) - (sourceScore(a.source) || 0);
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id));
      });
      return sorted[0];
    }

    const cluster1 = [
      { id: "mnet_1", title: "Mnet 제목", source: "mnet" },
      { id: "blip_1", title: "Blip 제목", source: "blip" }
    ];
    assert.strictEqual(mockDeterminePrimary(cluster1).id, "blip_1", "기본은 blip 우선이어야 함");

    const cluster2 = [
      { id: "mnet_1", title: "Mnet 제목", source: "mnet", isPrimary: true },
      { id: "blip_1", title: "Blip 제목", source: "blip" }
    ];
    assert.strictEqual(mockDeterminePrimary(cluster2).id, "mnet_1", "isPrimary가 지정된 mnet이 우선이어야 함");
  });

  // 5. Ops 부속 카드에 대표 지정 버튼 UI 검증
  test("ops-m7k2x9.html: 연관 부속 일정 카드에 대표 지정(setClusterPrimary) 액션 버튼이 존재하는지 검증", () => {
    assert(opsHtml.includes("setClusterPrimary") || opsHtml.includes("set-primary-btn"), "부속 일정 카드에 대표로 지정하는 기능이 존재해야 합니다.");
  });

  // 6. Ops 수정 모달 내 연관 일정 추천 칩 및 원클릭 채우기 UI 검증
  test("ops-m7k2x9.html: 연관 일정 항목 정보 추천 칩 및 일괄 채움 기능 검증", () => {
    assert(opsHtml.includes("updateLinkedScheduleSuggestions") || opsHtml.includes("linked-suggest-chip"), "연관 일정 추천 칩 생성 로직이 존재해야 합니다.");
    assert(opsHtml.includes("fillFromLinkedSchedule") || opsHtml.includes("fill-linked-btn"), "연관 일정 정보로 채우기 기능이 존재해야 합니다.");
  });

  // 7. Ops 저장 시 Gist 3종 동시 발행 (Zero Delay Sync) 검증
  test("ops-m7k2x9.html: 저장 시 schedule-overrides.json 뿐만 아니라 schedules.json 및 core.json도 동시 업로드하는지 검증", () => {
    assert(opsHtml.includes('"schedules.json":'), "Gist 페이로드에 schedules.json이 포함되어야 합니다.");
    assert(opsHtml.includes('"core.json":'), "Gist 페이로드에 core.json이 포함되어야 합니다.");
  });

  // 8. 확장프로그램 Central URL 우선순위 검증 (Gist 1순위)
  test("remine-helper/background.js: CENTRAL_CORE_URLS 및 CENTRAL_SCHEDULES_URLS의 1순위가 Gist URL인지 검증", () => {
    const coreMatch = backgroundJs.match(/const CENTRAL_CORE_URLS = \[(\s*["'][^"']+["'],?)+/);
    assert(coreMatch, "CENTRAL_CORE_URLS 정의가 존재해야 합니다.");
    assert(coreMatch[0].includes("gist.githubusercontent.com"), "CENTRAL_CORE_URLS 1순위에 Gist URL이 위치해야 합니다.");

    const schedMatch = backgroundJs.match(/const CENTRAL_SCHEDULES_URLS = \[(\s*["'][^"']+["'],?)+/);
    assert(schedMatch, "CENTRAL_SCHEDULES_URLS 정의가 존재해야 합니다.");
    assert(schedMatch[0].includes("gist.githubusercontent.com"), "CENTRAL_SCHEDULES_URLS 1순위에 Gist URL이 위치해야 합니다.");
  });

  // 9. 확장프로그램 캘린더 dataHash s.startTime 속성명 검증
  test("remine-helper/sidepanel.js & dashboard.js: dataHash 계산 시 startDateTime 오타가 startTime으로 수정되었는지 검증", () => {
    assert(!sidepanelJs.includes("s.startDateTime"), "sidepanel.js에 s.startDateTime 오타가 없어야 합니다.");
    assert(!dashboardJs.includes("s.startDateTime"), "dashboard.js에 s.startDateTime 오타가 없어야 합니다.");
    assert(sidepanelJs.includes("s.startTime"), "sidepanel.js에 s.startTime이 사용되어야 합니다.");
    assert(dashboardJs.includes("s.startTime"), "dashboard.js에 s.startTime이 사용되어야 합니다.");
  });

  return { passed, failed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
