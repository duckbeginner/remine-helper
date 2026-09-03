// scripts/data-hub/validate.js
// data.json 스키마 및 무결성 검증 테스트 러너

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../docs/api/v1/data.json');

function runValidation() {
  console.log("==================================================");
  console.log("🧪 [Data Hub Test] data.json 무결성 검증 시작");
  console.log("==================================================\n");

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ 실패: data.json 파일이 존재하지 않습니다 (${DATA_FILE})`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("❌ 실패: 유효하지 않은 JSON 포맷입니다:", e.message);
    process.exit(1);
  }

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

  console.log("1️⃣ 메타데이터 검증");
  assert(data.version === "1.0.0", "버전 번호 일치 (1.0.0)");
  assert(Boolean(data.updatedAt) && !isNaN(new Date(data.updatedAt).getTime()), "updatedAt ISO 날짜 유효성");
  assert(typeof data.updatedAtTimestamp === 'number', "updatedAtTimestamp 숫자형 타임스탬프");

  console.log("\n2️⃣ YouTube 데이터 검증");
  assert(typeof data.youtube?.isLive === 'boolean', "isLive 불리언 필드 존재");
  assert(Array.isArray(data.youtube?.officialVideos) && data.youtube.officialVideos.length > 0, `공식 채널 영상 존재 (${data.youtube?.officialVideos?.length}건)`);
  assert(Array.isArray(data.youtube?.playlistVideos), `재생목록 영상 배열 형식 (${data.youtube?.playlistVideos?.length}건)`);
  assert(Array.isArray(data.youtube?.woniVideos) && data.youtube.woniVideos.length > 0, `원이 채널 영상 존재 (${data.youtube?.woniVideos?.length}건)`);

  const sampleVideo = data.youtube?.officialVideos?.[0];
  assert(Boolean(sampleVideo?.id && sampleVideo?.title && sampleVideo?.thumbnail), "영상 객체 필수 필드(id, title, thumbnail) 완비");

  console.log("\n3️⃣ Schedule 데이터 검증");
  assert(typeof data.schedules?.totalCount === 'number' && data.schedules.totalCount > 100, `스케줄 100건 이상 집계 (${data.schedules?.totalCount}건)`);
  assert(Array.isArray(data.schedules?.items) && data.schedules.items.length === data.schedules.totalCount, "스케줄 items 배열 길이 일치");

  const sampleSchedule = data.schedules?.items?.[0];
  assert(Boolean(sampleSchedule?.title && sampleSchedule?.startTime), "스케줄 객체 필수 필드(title, startTime) 완비");

  console.log("\n4️⃣ SNS 데이터 검증");
  assert(Array.isArray(data.sns?.instagram) && data.sns.instagram.length > 0, `Instagram 피드 존재 (${data.sns?.instagram?.length}건)`);
  assert(Array.isArray(data.sns?.tiktok) && data.sns.tiktok.length > 0, `TikTok 피드 존재 (${data.sns?.tiktok?.length}건)`);
  assert(Array.isArray(data.sns?.x) && data.sns.x.length > 0, `X 피드 존재 (${data.sns?.x?.length}건)`);

  console.log("\n==================================================");
  console.log(`📊 검증 결과: 통과 ${passed}개, 실패 ${failed}개`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 모든 검증 테스트를 완벽하게 통과했습니다!\n");
  }
}

runValidation();
