// scripts/data-hub/fetch-all.js
// 중앙 데이터 허브 메인 빌드 엔진 - 데이터를 병렬 수집하여 core.json, schedules.json, data.json 생성

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

const CORE_FILE = path.join(OUTPUT_DIR, 'core.json');
const SCHEDULES_FILE = path.join(OUTPUT_DIR, 'schedules.json');
const DATA_FILE = path.join(OUTPUT_DIR, 'data.json');

async function main() {
  console.log("==================================================");
  console.log("🚀 [RESCENE Data Hub] 2계층 데이터 수집 엔진 시작");
  console.log(`⏰ 실행 시각: ${new Date().toISOString()}`);
  console.log("==================================================\n");

  const startTime = Date.now();

  try {
    // 기존 core.json 로드 (유튜브 RSS 등 일시 장애 시 데이터 유실 방지 및 폴백 보존용)
    let previousCore = null;
    if (fs.existsSync(CORE_FILE)) {
      try {
        previousCore = JSON.parse(fs.readFileSync(CORE_FILE, 'utf8'));
      } catch (e) {}
    }

    // CI 등 fresh 러너 환경에서 로컬 core.json이 없는 경우, 원격 Gist 백업에서 사전 확보
    if (!previousCore || !previousCore.youtube?.officialVideos?.length) {
      try {
        console.log("ℹ️ [Data Hub] 로컬 core.json 부재 -> 원격 Gist 백업 로드 시도...");
        const remoteRes = await fetch('https://gist.githubusercontent.com/duckbeginner/44b49b328233ef6157499debe03f165c/raw/core.json', {
          headers: { 'User-Agent': 'RemineHelper-DataHub/1.0' }
        });
        if (remoteRes.ok) {
          previousCore = await remoteRes.json();
          console.log(`✓ [Data Hub] 원격 백업 로드 성공 (공식 영상 ${previousCore?.youtube?.officialVideos?.length || 0}건 확보)`);
        }
      } catch (e) {
        console.warn("⚠️ [Data Hub] 원격 백업 로드 실패 (무시하고 계속):", e.message);
      }
    }

    // 1. YouTube & SNS 수집 (기존 데이터 전달하여 일시 장애 시 자동 보존)
    const [youtube, sns] = await Promise.all([
      collectYouTubeData(previousCore?.youtube),
      collectSnsData()
    ]);

    const allYtVideos = [
      ...(youtube.officialVideos || []),
      ...(youtube.playlistVideos || []),
      ...(youtube.woniVideos || [])
    ];

    // 2. Schedule 수집 & YouTube oEmbed 사전 보강 (과거 전체 ~ 미래 전체)
    const schedule = await collectScheduleData(allYtVideos);

    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimestamp = now.getTime();

    // 3. 최근 14일 ~ 미래 끝까지의 활성 스케줄 필터링 (새 일정 및 변경 사항 즉시 반영용)
    const fourteenDaysAgo = nowTimestamp - (14 * 24 * 60 * 60 * 1000);
    const activeItems = (schedule.items || []).filter(item => {
      const t = item.startTime ? new Date(item.startTime).getTime() : 0;
      return t >= fourteenDaysAgo;
    });

    // 4. [계층 1] core.json (초경량 헤드: 약 20~25 KB)
    const coreData = {
      version: "1.0.0",
      updatedAt: nowIso,
      updatedAtTimestamp: nowTimestamp,
      youtube: {
        isLive: youtube.isLive,
        liveInfo: youtube.liveInfo,
        officialVideos: youtube.officialVideos,
        playlistVideos: youtube.playlistVideos,
        woniVideos: youtube.woniVideos
      },
      sns: {
        instagram: sns.instagram,
        tiktok: sns.tiktok,
        x: sns.x
      },
      schedules: {
        activeItems: activeItems,
        activeCount: activeItems.length,
        totalMasterCount: schedule.totalCount,
        masterUpdatedAt: nowIso
      }
    };

    // 5. [계층 2] schedules.json (과거 전체 ~ 미래 전체 마스터 아카이브: 약 180 KB)
    const schedulesData = {
      version: "1.0.0",
      updatedAt: nowIso,
      updatedAtTimestamp: nowTimestamp,
      totalCount: schedule.totalCount,
      items: schedule.items
    };

    // 6. [하위 호환] data.json (기존 통합본)
    const finalData = {
      ...coreData,
      schedules: {
        totalCount: schedule.totalCount,
        items: schedule.items
      }
    };

    // 7. 디렉토리 생성 및 파일 쓰기
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(CORE_FILE, JSON.stringify(coreData), 'utf8');
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedulesData), 'utf8');
    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData), 'utf8');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const coreSizeKb = (Buffer.byteLength(JSON.stringify(coreData), 'utf8') / 1024).toFixed(2);
    const schedSizeKb = (Buffer.byteLength(JSON.stringify(schedulesData), 'utf8') / 1024).toFixed(2);
    const totalSizeKb = (Buffer.byteLength(JSON.stringify(finalData), 'utf8') / 1024).toFixed(2);

    console.log("\n==================================================");
    console.log("🎉 [RESCENE Data Hub] 2계층 데이터 분할 생성 성공!");
    console.log(`📦 core.json 크기      : ${coreSizeKb} KB (활성 스케줄 ${activeItems.length}건 + 영상 + SNS)`);
    console.log(`📦 schedules.json 크기 : ${schedSizeKb} KB (전체 마스터 아카이브 ${schedule.totalCount}건)`);
    console.log(`📦 data.json 크기      : ${totalSizeKb} KB (기존 통합본)`);
    console.log(`⏱️ 총 소요 시간        : ${duration}초`);
    console.log("==================================================");

    return { coreData, schedulesData, finalData };
  } catch (error) {
    console.error("\n❌ [RESCENE Data Hub] 수집 중 치명적 오류 발생:", error);
    process.exit(1);
  }
}

main();
