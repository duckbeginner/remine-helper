// scripts/data-hub/fetch-all.js
// 중앙 데이터 허브 메인 빌드 엔진 - 전체 데이터를 병렬 수집하여 docs/api/v1/data.json 생성

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { collectYouTubeData } from './collectors/youtube.js';
import { collectScheduleData } from './collectors/schedule.js';
import { collectSnsData } from './collectors/sns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs/api/v1');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'data.json');

async function main() {
  console.log("==================================================");
  console.log("🚀 [RESCENE Data Hub] 중앙 데이터 수집 엔진 시작");
  console.log(`⏰ 실행 시각: ${new Date().toISOString()}`);
  console.log("==================================================\n");

  const startTime = Date.now();

  try {
    // 1. YouTube & SNS 수집
    const [youtube, sns] = await Promise.all([
      collectYouTubeData(),
      collectSnsData()
    ]);

    const allYtVideos = [
      ...(youtube.officialVideos || []),
      ...(youtube.playlistVideos || []),
      ...(youtube.woniVideos || [])
    ];

    // 2. Schedule 수집 & YouTube oEmbed 사전 보강
    const schedule = await collectScheduleData(allYtVideos);

    // 2. 통합 데이터 구조체 생성
    const now = new Date();
    const finalData = {
      version: "1.0.0",
      updatedAt: now.toISOString(),
      updatedAtTimestamp: now.getTime(),
      youtube: {
        isLive: youtube.isLive,
        liveInfo: youtube.liveInfo,
        officialVideos: youtube.officialVideos,
        playlistVideos: youtube.playlistVideos,
        woniVideos: youtube.woniVideos
      },
      schedules: {
        totalCount: schedule.totalCount,
        items: schedule.items
      },
      sns: {
        instagram: sns.instagram,
        tiktok: sns.tiktok,
        x: sns.x
      }
    };

    // 3. 대상 디렉토리 생성 및 data.json 파일 쓰기
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const jsonString = JSON.stringify(finalData, null, 2);
    fs.writeFileSync(OUTPUT_FILE, jsonString, 'utf8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const sizeKb = (Buffer.byteLength(jsonString, 'utf8') / 1024).toFixed(2);

    console.log("\n==================================================");
    console.log("🎉 [RESCENE Data Hub] 수집 완료 및 data.json 생성 성공!");
    console.log(`📁 저장 경로: ${OUTPUT_FILE}`);
    console.log(`📦 파일 크기: ${sizeKb} KB`);
    console.log(`⏱️ 총 소요 시간: ${duration}초`);
    console.log("==================================================");

    return finalData;
  } catch (error) {
    console.error("\n❌ [RESCENE Data Hub] 수집 중 치명적 오류 발생:", error);
    process.exit(1);
  }
}

main();
