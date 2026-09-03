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
const DATA_FILE = path.join(OUTPUT_DIR, 'data.json');

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
  } else if (type === 'schedules') {
    core = data.items;
  } else {
    core = {
      youtube: data.youtube,
      sns: data.sns,
      items: data.schedules?.items
    };
  }
  return crypto.createHash('sha256').update(JSON.stringify(core)).digest('hex');
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

  if (!fs.existsSync(CORE_FILE) || !fs.existsSync(SCHEDULES_FILE)) {
    console.error("❌ 실패: 빌드된 json 파일들이 존재하지 않습니다.");
    process.exit(1);
  }

  const coreObj = JSON.parse(fs.readFileSync(CORE_FILE, 'utf8'));
  const schedObj = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
  const dataObj = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : null;

  const currentHashes = {
    core: calculateHash(coreObj, 'core'),
    schedules: calculateHash(schedObj, 'schedules'),
    data: dataObj ? calculateHash(dataObj, 'data') : ''
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

  // data.json 변경 검사
  if (dataObj) {
    const dataMin = JSON.stringify(dataObj);
    const dataSizeKb = (Buffer.byteLength(dataMin) / 1024).toFixed(2);
    if (prevHashes.data !== currentHashes.data) {
      filesPayload["data.json"] = { content: dataMin };
      console.log(`📦 [data.json] 변경 감지 -> 업로드 대상 포함 (${dataSizeKb} KB)`);
    } else {
      console.log(`⚡ [data.json] 변경 없음 (No Change, ${dataSizeKb} KB)`);
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

updateGist();
