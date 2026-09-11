// scripts/data-hub/tools/squash-overrides.js
// Gist 오버라이드 압축/영구 병합(Squash) CLI 도구

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');

/**
 * 기본 일정 목록과 Gist 오버라이드를 결합하여 압축된 단일 마스터 목록을 산출하는 순수 함수
 * @param {Array} baseItems 기존 일정 배열
 * @param {Object} overrides Gist 오버라이드 객체 { sourceOverrides, customSchedules, deleted, modified, created }
 * @returns {Object} { items, stats }
 */
export function squashOverrides(baseItems = [], overrides = {}) {
  const itemMap = new Map();

  // 1. 기본 아이템 등록
  (baseItems || []).forEach(item => {
    if (item && item.id) {
      itemMap.set(item.id, { ...item });
    }
  });

  // 2. 수동 등록 아이템(customSchedules / created) 병합
  const customList = overrides.customSchedules ? Object.values(overrides.customSchedules) : (overrides.created || []);
  customList.forEach(cItem => {
    if (cItem && cItem.id) {
      itemMap.set(cItem.id, { ...cItem, _isCustom: true });
    }
  });

  // 3. 소스 오버라이드(수정 및 삭제) 적용
  const srcOverrides = overrides.sourceOverrides || {};
  const deletedSet = new Set(overrides.deleted || []);
  const modifiedMap = overrides.modified || {};

  let modifiedCount = 0;
  let deletedCount = 0;

  // 3-1. sourceOverrides 순회
  Object.entries(srcOverrides).forEach(([id, patch]) => {
    if (!itemMap.has(id)) return;
    if (patch._isDeleted) {
      itemMap.delete(id);
      deletedCount++;
    } else {
      const existing = itemMap.get(id);
      itemMap.set(id, { ...existing, ...patch, _isModified: true });
      modifiedCount++;
    }
  });

  // 3-2. legacy modified 적용
  Object.entries(modifiedMap).forEach(([id, patch]) => {
    if (itemMap.has(id)) {
      const existing = itemMap.get(id);
      itemMap.set(id, { ...existing, ...patch, _isModified: true });
      modifiedCount++;
    }
  });

  // 3-3. legacy deleted 적용
  deletedSet.forEach(id => {
    if (itemMap.has(id)) {
      itemMap.delete(id);
      deletedCount++;
    }
  });

  const mergedItems = Array.from(itemMap.values());
  // 시작 시간순 정렬
  mergedItems.sort((a, b) => {
    const tA = a.startTime ? new Date(a.startTime).getTime() : 0;
    const tB = b.startTime ? new Date(b.startTime).getTime() : 0;
    return tA - tB;
  });

  return {
    items: mergedItems,
    stats: {
      total: mergedItems.length,
      modified: modifiedCount,
      deleted: deletedCount,
      custom: customList.length
    }
  };
}

async function main() {
  console.log("==================================================");
  console.log("🗜️ [Data Hub] Gist 오버라이드 영구 병합/압축(Squash) 도구");
  console.log("==================================================");

  const schedulesFile = path.join(ROOT_DIR, 'docs/api/v1/schedules.json');
  if (!fs.existsSync(schedulesFile)) {
    console.error("❌ schedules.json 마스터 파일이 존재하지 않습니다.");
    process.exit(1);
  }

  const masterData = JSON.parse(fs.readFileSync(schedulesFile, 'utf8'));
  console.log(`✓ 기존 마스터 일정: ${masterData.items?.length || 0}건 로드 완료`);

  // Gist에서 최신 오버라이드 다운로드
  const GIST_URL = 'https://gist.githubusercontent.com/duckbeginner/44b49b328233ef6157499debe03f165c/raw/remine-overrides.json';
  let gistData = {};
  try {
    const res = await fetch(GIST_URL);
    if (res.ok) {
      gistData = await res.json();
      console.log("✓ 원격 Gist 오버라이드 로드 성공");
    }
  } catch (e) {
    console.warn("⚠️ 원격 Gist 로드 실패 (로컬 데이터만 유지):", e.message);
  }

  const { items, stats } = squashOverrides(masterData.items, gistData);
  console.log(`✓ 병합 완료: 총 ${items.length}건 (수정 ${stats.modified}건, 삭제 ${stats.deleted}건, 수동 ${stats.custom}건)`);

  masterData.items = items;
  masterData.totalCount = items.length;
  masterData.updatedAt = new Date().toISOString();
  masterData.updatedAtTimestamp = Date.now();

  fs.writeFileSync(schedulesFile, JSON.stringify(masterData), 'utf8');
  console.log("💾 docs/api/v1/schedules.json 에 영구 압축 병합 완료!\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error("Squash 실행 오류:", err);
    process.exit(1);
  });
}
