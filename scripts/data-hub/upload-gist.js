// scripts/data-hub/upload-gist.js
// 생성된 core.json, schedules.json, data.json을 Minified 압축하여 GitHub Gist에 스마트 덮어쓰기 업데이트하는 업로더

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/api/v1');

const CORE_FILE = path.join(OUTPUT_DIR, 'core.json');
const SCHEDULES_FILE = path.join(OUTPUT_DIR, 'schedules.json');
const MASTER_SCHEDULES_FILE = path.join(OUTPUT_DIR, 'master-schedules.json');

const CACHE_DIR = path.resolve(__dirname, '../../.cache');
const HASH_FILE = path.join(CACHE_DIR, 'gist-hashes.json');

const GIST_ID = process.env.GIST_ID || "44b49b328233ef6157499debe03f165c";
const GIST_TOKEN = process.env.GIST_TOKEN || process.env.GH_TOKEN;

// 핵심 데이터 해시 계산 (updatedAt 타임스탬프 제외)
function calculateHash(data, type) {
  let core;
  if (type === 'core') {
    core = {
      youtube: data.youtube,
      sns: data.sns,
      activeItems: data.schedules?.activeItems
    };
  } else {
    core = data.items;
  }
  return crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex');
}

// High-Water Mark 검증 순수 함수 (Fail-Closed & 독립 가드)
export function verifyHighWaterMark({
  masterObj,
  schedObj,
  remoteMasterResult,
  remoteSchedResult
}) {
  const newMasterCount = Array.isArray(masterObj?.items) ? masterObj.items.length : 0;
  const newSchedCount = Array.isArray(schedObj?.items) ? schedObj.items.length : 0;

  // 1. 절대 하한선 검증
  if (newMasterCount < 500) {
    throw new Error(`[High-Water Mark Guard] 신규 마스터 건수(${newMasterCount}건)가 절대 하한선(500건) 미만입니다.`);
  }
  if (newSchedCount < 400) {
    throw new Error(`[High-Water Mark Guard] 신규 배포본 건수(${newSchedCount}건)가 절대 하한선(400건) 미만입니다.`);
  }

  // 2. master-schedules.json 가드 (Fail-Closed & 원격 오염 방어)
  const remoteMasterCount = Array.isArray(remoteMasterResult?.data?.items) ? remoteMasterResult.data.items.length : 0;
  if (remoteMasterResult?.ok && remoteMasterCount >= 500) {
    if (newMasterCount < remoteMasterCount * 0.8) {
      const dropRatio = (((remoteMasterCount - newMasterCount) / remoteMasterCount) * 100).toFixed(1);
      throw new Error(`[High-Water Mark Guard] 마스터 일정 건수 비정상 급감 감지! 원격: ${remoteMasterCount}건 -> 신규: ${newMasterCount}건 (감소율: ${dropRatio}%)`);
    }
  } else {
    // Fail-Closed: 원격 마스터 상태 확인 실패 또는 원격 건수 비정상(500건 미만) 시 신규 마스터가 1000건 미만이면 차단
    if (newMasterCount < 1000) {
      const reason = remoteMasterResult?.ok ? `원격 마스터 건수 비정상(${remoteMasterCount}건 < 500건)` : (remoteMasterResult?.error || 'Unknown Error');
      throw new Error(`[High-Water Mark Guard Fail-Closed] 원격 마스터 상태 신뢰 불가 (${reason}) 상황에서 신규 마스터 건수(${newMasterCount}건)가 안전 기준(1000건) 미만입니다.`);
    }
  }

  // 3. schedules.json 가드 (독립 검증 & Fail-Closed)
  const remoteSchedCount = Array.isArray(remoteSchedResult?.data?.items) ? remoteSchedResult.data.items.length : 0;
  if (remoteSchedResult?.ok && remoteSchedCount >= 400) {
    if (newSchedCount < remoteSchedCount * 0.8) {
      const dropRatio = (((remoteSchedCount - newSchedCount) / remoteSchedCount) * 100).toFixed(1);
      throw new Error(`[High-Water Mark Guard] 배포용 schedules.json 건수 비정상 급감 감지! 원격: ${remoteSchedCount}건 -> 신규: ${newSchedCount}건 (감소율: ${dropRatio}%)`);
    }
  } else {
    // Fail-Closed: 원격 배포본 상태 확인 실패 또는 원격 건수 비정상(400건 미만) 시 신규 배포본이 500건 미만이면 차단
    if (newSchedCount < 500) {
      const reason = remoteSchedResult?.ok ? `원격 배포본 건수 비정상(${remoteSchedCount}건 < 400건)` : (remoteSchedResult?.error || 'Unknown Error');
      throw new Error(`[High-Water Mark Guard Fail-Closed] 원격 배포본 상태 신뢰 불가 (${reason}) 상황에서 신규 배포본 건수(${newSchedCount}건)가 안전 기준(500건) 미만입니다.`);
    }
  }

  return true;
}

async function fetchRemoteJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RemineHelper-DataHub/1.0' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function updateGist() {
  console.log("==================================================");
  console.log("📤 [Gist Uploader] 2계층 GitHub Gist 스마트 압축 업데이트 시작");
  console.log(`🆔 Gist ID: ${GIST_ID}`);
  console.log("==================================================\n");

  if (!GIST_TOKEN) {
    console.error("❌ 실패: GIST_TOKEN 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  if (!fs.existsSync(CORE_FILE) || !fs.existsSync(SCHEDULES_FILE) || !fs.existsSync(MASTER_SCHEDULES_FILE)) {
    console.error("❌ 실패: 필수 json 파일(core, schedules, master-schedules)이 존재하지 않습니다.");
    process.exit(1);
  }

  const coreObj = JSON.parse(fs.readFileSync(CORE_FILE, 'utf8'));
  const schedObj = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
  const masterObj = JSON.parse(fs.readFileSync(MASTER_SCHEDULES_FILE, 'utf8'));

  // High-Water Mark 검증: Gist 기존 데이터 대비 비정상 급감(역행) 방지 가드 (Fail-Closed)
  const nowTime = Date.now();
  const [remoteMasterResult, remoteSchedResult] = await Promise.all([
    fetchRemoteJson(`https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/master-schedules.json?t=${nowTime}`),
    fetchRemoteJson(`https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedules.json?t=${nowTime}`)
  ]);

  try {
    verifyHighWaterMark({
      masterObj,
      schedObj,
      remoteMasterResult,
      remoteSchedResult
    });
  } catch (err) {
    console.error(`❌ ${err.message} 데이터 유실 방지를 위해 Gist 덮어쓰기를 강제 차단합니다.`);
    process.exit(1);
  }

  const currentHashes = {
    core: calculateHash(coreObj, 'core'),
    schedules: calculateHash(schedObj, 'schedules'),
    masterSchedules: masterObj ? calculateHash(masterObj, 'masterSchedules') : null
  };

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  let prevHashes = {};
  if (fs.existsSync(HASH_FILE)) {
    try {
      prevHashes = JSON.parse(fs.readFileSync(HASH_FILE, 'utf8'));
    } catch (e) { }
  }

  const filesPayload = {};

  // core.json 변경 검사
  const coreMin = JSON.stringify(coreObj);
  const coreSizeKb = (Buffer.byteLength(coreMin) / 1024).toFixed(2);
  if (prevHashes.core !== currentHashes.core) {
    filesPayload["core.json"] = { content: coreMin };
    console.log(`📦 [core.json] 변경 감지 -> 업로드 대상 포함 (${coreSizeKb} KB)`);
  } else {
    console.log(`⚡ [core.json] 변경 없음 (No Change, ${coreSizeKb} KB)`);
  }

  // schedules.json 변경 검사
  const schedMin = JSON.stringify(schedObj);
  const schedSizeKb = (Buffer.byteLength(schedMin) / 1024).toFixed(2);
  if (prevHashes.schedules !== currentHashes.schedules) {
    filesPayload["schedules.json"] = { content: schedMin };
    console.log(`📦 [schedules.json] 변경 감지 -> 업로드 대상 포함 (${schedSizeKb} KB)`);
  } else {
    console.log(`⚡ [schedules.json] 변경 없음 (No Change, ${schedSizeKb} KB)`);
  }

  // master-schedules.json 변경 검사
  if (masterObj) {
    const masterMin = JSON.stringify(masterObj);
    const masterSizeKb = (Buffer.byteLength(masterMin) / 1024).toFixed(2);
    if (prevHashes.masterSchedules !== currentHashes.masterSchedules) {
      filesPayload["master-schedules.json"] = { content: masterMin };
      console.log(`📦 [master-schedules.json] 변경 감지 -> 업로드 대상 포함 (${masterSizeKb} KB)`);
    } else {
      console.log(`⚡ [master-schedules.json] 변경 없음 (No Change, ${masterSizeKb} KB)`);
    }
  }

  // 변경된 파일이 하나도 없으면 스킵
  if (Object.keys(filesPayload).length === 0) {
    console.log("\n⚡ [Gist Uploader] 모든 데이터가 5분 전과 100% 동일함 -> 불필요한 Gist PATCH 스킵!");
    process.exit(0);
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        "Authorization": `Bearer ${GIST_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RESCENE-Data-Hub-Gist-Uploader"
      },
      body: JSON.stringify({
        description: `RESCENE Remine Helper 2-Tier Data Hub (Updated: ${new Date().toISOString()})`,
        files: filesPayload
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub Gist API 오류 HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    fs.writeFileSync(HASH_FILE, JSON.stringify(currentHashes), 'utf8');

    console.log("\n🎉 [Gist Uploader] 2계층 Gist 덮어쓰기 업데이트 성공!");
    console.log(`🔗 core.json Raw URL      : https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/core.json`);
    console.log(`🔗 schedules.json Raw URL : https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/schedules.json`);
    console.log(`⏰ 업데이트 시각: ${json.updated_at}`);
  } catch (error) {
    console.error("❌ [Gist Uploader] 업데이트 실패:", error.message);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('upload-gist.js')) {
  updateGist();
}
