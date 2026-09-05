// scripts/data-hub/validate.js
// 2계층 데이터 허브 무결성 검증 테스트 러너 (core.json, schedules.json, data.json)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/api/v1');

const CORE_FILE = path.join(OUTPUT_DIR, 'core.json');
const SCHEDULES_FILE = path.join(OUTPUT_DIR, 'schedules.json');
const DATA_FILE = path.join(OUTPUT_DIR, 'data.json');

function runValidation() {
  console.log("==================================================");
  console.log("🧪 [Data Hub Test] 2계층 데이터 무결성 검증 시작");
  console.log("==================================================\n");

  if (!fs.existsSync(CORE_FILE) || !fs.existsSync(SCHEDULES_FILE)) {
    console.error("❌ 실패: 필수 데이터 파일(core.json, schedules.json)이 존재하지 않습니다.");
    process.exit(1);
  }

  const core = JSON.parse(fs.readFileSync(CORE_FILE, 'utf8'));
  const schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ 통과: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ 실패: ${message}`);
      failed++;
    }
  }

  console.log("1️⃣ [core.json] 초경량 헤드 검증");
  assert(core.version === "1.0.0", "버전 번호 일치 (1.0.0)");
  assert(typeof core.youtube?.isLive === 'boolean', "isLive 불리언 필드 존재");
  assert(Array.isArray(core.youtube?.officialVideos) && core.youtube.officialVideos.length > 0, `공식 채널 영상 완비 (${core.youtube?.officialVideos?.length}건)`);
  const allShorts = [
    ...(core.youtube?.officialVideos || []),
    ...(core.youtube?.playlistVideos || []),
    ...(core.youtube?.woniVideos || [])
  ].filter(v => v.isShorts || v.url?.includes('/shorts/'));
  assert(allShorts.length > 0, `Shorts 영상 판별 완비 (${allShorts.length}건)`);
  assert(Array.isArray(core.sns?.x) && core.sns.x.length > 0, `X 피드 완비 (${core.sns?.x?.length}건)`);
  assert(Array.isArray(core.schedules?.activeItems), `활성 스케줄 배열 존재 (${core.schedules?.activeItems?.length}건)`);
  assert(typeof core.schedules?.totalMasterCount === 'number' && core.schedules.totalMasterCount > 100, `마스터 스케줄 총계 표기 (${core.schedules?.totalMasterCount}건)`);
  assert(Boolean(core.schedules?.masterUpdatedAt), "마스터 스케줄 갱신 타임스탬프 유효");

  console.log("\n2️⃣ [schedules.json] 마스터 아카이브 검증");
  assert(schedules.version === "1.0.0", "버전 번호 일치 (1.0.0)");
  assert(typeof schedules.totalCount === 'number' && schedules.totalCount > 100, `전체 마스터 아카이브 100건 이상 집계 (${schedules.totalCount}건)`);
  assert(Array.isArray(schedules.items) && schedules.items.length === schedules.totalCount, "아카이브 items 배열 길이 일치");
  
  const sampleSchedule = schedules.items?.[0];
  assert(Boolean(sampleSchedule?.title && sampleSchedule?.startTime), "스케줄 필수 필드(title, startTime) 완비");

  console.log("\n3️⃣ 파일 크기 2계층 다이어트 규격 검증");
  const coreKb = Buffer.byteLength(JSON.stringify(core)) / 1024;
  const schedKb = Buffer.byteLength(JSON.stringify(schedules)) / 1024;
  assert(coreKb <= 120, `core.json 120KB 이하 초경량 유지 (${coreKb.toFixed(2)} KB)`);
  assert(schedKb <= 600, `schedules.json 마스터 아카이브 규격 내 유지 (${schedKb.toFixed(2)} KB)`);

  console.log("\n==================================================");
  console.log(`📊 검증 결과: 통과 ${passed}개, 실패 ${failed}개`);
  console.log("==================================================");

  if (failed > 0) {
    console.error(`🚨 검증 실패: ${failed}개의 테스트가 실패했습니다.`);
    process.exit(1);
  } else {
    console.log("🎉 모든 2계층 검증 테스트를 완벽하게 통과했습니다!\n");
  }
}

runValidation();
