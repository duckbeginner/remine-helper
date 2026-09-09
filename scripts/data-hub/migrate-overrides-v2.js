// scripts/data-hub/migrate-overrides-v2.js
// Gist schedule-overrides.json을 v2.0 불변 ID 및 상호 연결 구조로 마이그레이션

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateOverridesV1toV2, generateScheduleId } from './collectors/schedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, '../../.cache');
const OVERRIDES_FILE = path.join(CACHE_DIR, 'schedule-overrides.json');
const GIST_ID = process.env.GIST_ID || "44b49b328233ef6157499debe03f165c";
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

async function runMigration() {
  console.log("==================================================");
  console.log("🚀 [Schedule Overrides] v2.0 스키마 마이그레이션 시작");
  console.log("==================================================");

  // 1. 최신 Gist 오버라이드 다운로드
  let rawOverrides = null;
  const gistUrl = `https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedule-overrides.json?t=${Date.now()}`;
  try {
    const res = await fetch(gistUrl);
    if (res.ok) {
      rawOverrides = await res.json();
      console.log("✓ 원격 Gist에서 schedule-overrides.json 로드 성공");
    }
  } catch (e) {
    console.warn("⚠️ Gist 로드 실패, 로컬 캐시 확인:", e.message);
  }

  if (!rawOverrides && fs.existsSync(OVERRIDES_FILE)) {
    rawOverrides = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
    console.log("✓ 로컬 캐시에서 schedule-overrides.json 로드 성공");
  }

  if (!rawOverrides) {
    console.error("❌ 오버라이드 데이터를 찾을 수 없습니다.");
    process.exit(1);
  }

  // 2. 현재 Blip / Mnet 원시 일정 샘플 가져오기 (매핑용)
  // docs/api/v1/schedules.json 활용
  let sampleRawItems = [];
  const schedPath = path.resolve(__dirname, '../../docs/api/v1/schedules.json');
  if (fs.existsSync(schedPath)) {
    try {
      const schedJson = JSON.parse(fs.readFileSync(schedPath, 'utf8'));
      sampleRawItems = schedJson.items || [];
    } catch (e) { }
  }

  // 3. v1 ➡️ v2 무손실 변환
  const v2 = migrateOverridesV1toV2(rawOverrides, sampleRawItems);

  // 4. 명지대 축제와 연수 능허대 축제 등 핵심 일정의 연관 ID(linkedScheduleIds) 상호 연결
  // 명지대 축제: custom MAJESTY와 blip 원본(<명지대학교 자연캠퍼스 축제>) 상호 연결
  const blipMyongji = sampleRawItems.find(r => r.title && r.title.includes("명지대학교 자연캠퍼스 축제"));
  const blipMyongjiId = blipMyongji ? blipMyongji.id : "blip_myongji_auto";

  Object.values(v2.customSchedules).forEach(c => {
    if (c.title && c.title.includes("명지대학교 축제 : MAJESTY FESTIVAL")) {
      c.linkedScheduleIds = Array.from(new Set([...(c.linkedScheduleIds || []), blipMyongjiId]));
      // 블립 원본에도 상호 등록 및 삭제(isDeleted: true) 명시
      v2.sourceOverrides[blipMyongjiId] = {
        id: blipMyongjiId,
        isDeleted: true,
        linkedScheduleIds: [c.id]
      };
      v2.legacyAliases["2026-09-22_<명지대학교 자연캠퍼스 축제>"] = blipMyongjiId;
      v2.legacyAliases["<명지대학교 자연캠퍼스 축제>"] = blipMyongjiId;
      console.log(`🔗 [상호 연결 완료] 명지대 축제: ${c.id} <-> ${blipMyongjiId}`);
    }
  });

  // 5. 로컬 캐시에 저장
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(v2, null, 2), 'utf8');
  console.log("✓ 로컬 .cache/schedule-overrides.json v2.0 저장 완료");

  // 6. Gist에 업로드 (토큰이 있는 경우)
  if (GH_TOKEN) {
    console.log("📤 GitHub Gist에 schedule-overrides.json v2.0 업데이트 중...");
    try {
      const patchRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${GH_TOKEN}`,
          "User-Agent": "RESCENE-Data-Hub",
          "Accept": "application/vnd.github+json"
        },
        body: JSON.stringify({
          files: {
            "schedule-overrides.json": {
              content: JSON.stringify(v2, null, 2)
            }
          }
        })
      });

      if (patchRes.ok) {
        console.log("🎉 Gist schedule-overrides.json v2.0 원격 덮어쓰기 성공!");
      } else {
        const errText = await patchRes.text();
        console.warn("⚠️ Gist 업로드 응답 실패:", errText);
      }
    } catch (e) {
      console.warn("⚠️ Gist 업로드 에러:", e.message);
    }
  } else {
    console.log("ℹ️ GH_TOKEN이 설정되지 않아 로컬 캐시만 갱신되었습니다. (수동 배포 시 GH_TOKEN 사용)");
  }

  console.log(`📊 마이그레이션 요약: customSchedules ${Object.keys(v2.customSchedules).length}건, sourceOverrides ${Object.keys(v2.sourceOverrides).length}건, legacyAliases ${Object.keys(v2.legacyAliases).length}건`);
}

runMigration().catch(err => {
  console.error("마이그레이션 실패:", err);
  process.exit(1);
});
