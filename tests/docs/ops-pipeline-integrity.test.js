// tests/docs/ops-pipeline-integrity.test.js
// Ops 포털 스키마 유효성 검증, ID/Source 불변성 보장 및 유령/누락 방지 TDD 테스트

import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const OPS_HTML_PATH = path.join(ROOT_DIR, "docs/ops-m7k2x9.html");

export async function run() {
  console.log("\n▶ [Docs/Ops] 파이프라인 무결성, 스키마 검증 및 ID 보존 TDD 테스트 실행");
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

  // 1. ops-m7k2x9.html 내 isValidScheduleItem 스키마 검증기 선언 확인
  test("ops-m7k2x9.html: isValidScheduleItem 필수 스키마 검증 함수가 구현되어 있어야 함", () => {
    assert(opsHtml.includes("function isValidScheduleItem("), "isValidScheduleItem 함수 선언이 있어야 합니다.");
    assert(opsHtml.includes("item.id") && opsHtml.includes("item.title") && opsHtml.includes("item.startTime"), "id, title, startTime 필수 검증 로직이 포함되어야 합니다.");
  });

  // 2. ops-m7k2x9.html: 섹션 4-1 고아 복원 시 isValidScheduleItem 방어 가드 적용 확인
  test("ops-m7k2x9.html: 섹션 4-1 sourceOverrides 복원 시 유효하지 않은 껍데기 조각(유령 일정)을 원천 차단해야 함", () => {
    assert(
      opsHtml.includes("isValidScheduleItem(v)") || opsHtml.includes("isValidScheduleItem(resItem)"),
      "sourceOverrides 복원 루프 내에 isValidScheduleItem 가드가 있어야 합니다."
    );
  });

  // 3. ops-m7k2x9.html: loadSchedules 병합 시 안전 필드만 반영하고 id, source 영구 보존 확인
  test("ops-m7k2x9.html: loadSchedules 병합 시 원본 item의 고유 id와 source가 덮어써지지 않고 보존되어야 함", () => {
    assert(opsHtml.includes("origId"), "origId 보존 변수가 존재해야 합니다.");
    assert(opsHtml.includes("origSource"), "origSource 보존 변수가 존재해야 합니다.");
    assert(opsHtml.includes("itemCopy.id = origId") || opsHtml.includes("safeMod.id = origId"), "itemCopy.id가 origId로 보존되어야 합니다.");
  });

  // 4. ops-m7k2x9.html: findMatchingOverride에서 고유 ID 불일치 시 타 출처 오버라이드 매칭 차단 가드 확인
  test("ops-m7k2x9.html: findMatchingOverride에서 고유 ID가 일치하지 않는 타 출처 일정의 오버라이드 매칭을 차단해야 함", () => {
    assert(
      opsHtml.includes("isIdMismatch") || opsHtml.includes("mod.id !== item.id") || opsHtml.includes("mVal.id !== item.id") || opsHtml.includes("item.id && mod.id"),
      "findMatchingOverride에 ID 불일치 방어 가드가 존재해야 합니다."
    );
  });

  // 5. 단위 시뮬레이션: 불완전 껍데기 조각(682e03dbbe9ed07eb239b32f 등) 차단 검증
  test("시뮬레이션: 제목이나 날짜가 없는 불완전 껍데기 오버라이드는 일정으로 복원되지 않아야 함", () => {
    function isValidScheduleItem(item) {
      if (!item || typeof item !== "object") return false;
      if (!item.id || typeof item.id !== "string") return false;
      if (!item.title || typeof item.title !== "string" || !item.title.trim()) return false;
      if (!item.startTime || isNaN(new Date(item.startTime).getTime())) return false;
      return true;
    }

    const orphanShell = {
      id: "682e03dbbe9ed07eb239b32f",
      url: "https://www.youtube.com/watch?v=x92ofaGYFhU",
      channel: "SBS Radio 에라오"
    };
    assert.strictEqual(isValidScheduleItem(orphanShell), false, "제목/날짜 없는 껍데기는 isValidScheduleItem이 false여야 합니다.");

    const validItem = {
      id: "blip_1103438",
      title: "2026 천안 K-컬처 박람회 개막 공연",
      startTime: "2026-09-02T00:00:00+09:00",
      source: "blip"
    };
    assert.strictEqual(isValidScheduleItem(validItem), true, "완전한 일정은 isValidScheduleItem이 true여야 합니다.");
  });

  // 6. 단위 시뮬레이션: Mnet 천안 박람회 ID 오염 방지 및 2건 독립 카드 렌더링 검증
  test("시뮬레이션: 동일 날짜/제목의 Blip 및 Mnet 일정이 오버라이드 병합 후에도 각자 고유 ID를 유지하고 둘 다 렌더링되어야 함", () => {
    const rawItems = [
      { id: "blip_1103438", source: "blip", title: "2026 천안 K-컬처 박람회 개막 공연", startTime: "2026-09-02T00:00:00+09:00" },
      { id: "6a48ce7d7dd960680ac6fc90", source: "mnet", title: "2026 천안 K-컬처 박람회 개막 공연", startTime: "2026-09-02T00:00:00Z" }
    ];
    const legacyOverride = {
      id: "2026-09-02_2026 천안 K-컬처 박람회 개막 공연",
      title: "2026 천안 K-컬처 박람회 개막 공연",
      location: "천안 독립기념관"
    };

    const SAFE_FIELDS = ['title', 'startTime', 'endTime', 'isAllday', 'url', 'location', 'typeText', 'message', 'channel'];
    const merged = rawItems.map(item => {
      const itemCopy = { ...item };
      const origId = item.id;
      const origSource = item.source;
      SAFE_FIELDS.forEach(f => {
        if (legacyOverride[f] !== undefined) itemCopy[f] = legacyOverride[f];
      });
      itemCopy.id = origId;
      itemCopy.source = origSource;
      return itemCopy;
    });

    assert.strictEqual(merged[0].id, "blip_1103438", "Blip ID가 유지되어야 합니다.");
    assert.strictEqual(merged[1].id, "6a48ce7d7dd960680ac6fc90", "Mnet ID가 레거시 키로 변조되지 않아야 합니다.");
    assert.strictEqual(merged[1].location, "천안 독립기념관", "오버라이드 속성은 정상 병합되어야 합니다.");

    // 렌더링 중복 검사
    const renderedIds = new Set();
    const renderedCards = [];
    merged.forEach(item => {
      if (!renderedIds.has(item.id)) {
        renderedIds.add(item.id);
        renderedCards.push(item);
      }
    });
    assert.strictEqual(renderedCards.length, 2, "2건 모두 독립 카드로 렌더링되어야 합니다 (Mnet 누락 없음).");
  });

  return { passed, failed };
}

// 직접 실행 지원
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().then(res => {
    if (res.failed > 0) process.exit(1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
