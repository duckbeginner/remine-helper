// scripts/data-hub/upload-gist.js
// 생성된 data.json을 Minify 압축 후 GitHub Gist에 스마트 덮어쓰기 업데이트하는 업로더

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../docs/api/v1/data.json');
const CACHE_DIR = path.resolve(__dirname, '../../.cache');
const HASH_FILE = path.join(CACHE_DIR, 'data-hash.txt');

const GIST_ID = process.env.GIST_ID || "44b49b328233ef6157499debe03f165c";
const GIST_TOKEN = process.env.GIST_TOKEN || process.env.GH_TOKEN;

// 핵심 데이터 해시 계산 (매번 바뀌는 updatedAt 타임스탬프 제외)
function calculateContentHash(data) {
  const coreData = {
    youtube: data.youtube,
    sns: data.sns,
    schedules: data.schedules?.items
  };
  return crypto.createHash('sha256').update(JSON.stringify(coreData)).digest('hex');
}

async function updateGist() {
  console.log("==================================================");
  console.log("📤 [Gist Uploader] GitHub Gist 스마트 압축 업데이트 시작");
  console.log(`🆔 Gist ID: ${GIST_ID}`);
  console.log("==================================================\n");

  if (!GIST_TOKEN) {
    console.error("❌ 실패: GIST_TOKEN 환경변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ 실패: data.json 파일이 존재하지 않습니다 (${DATA_FILE})`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(DATA_FILE, 'utf8');
  const dataObj = JSON.parse(rawContent);

  // 1. Minified 압축 문자열 생성 (들여쓰기 공백 제거로 200KB 절감)
  const minifiedContent = JSON.stringify(dataObj);
  const minifiedSizeKb = (Buffer.byteLength(minifiedContent) / 1024).toFixed(2);
  console.log(`📦 Minified 데이터 크기: ${minifiedSizeKb} KB`);

  // 2. 스마트 변경 감지 (이전 해시와 동일하면 Gist 업로드 스킵)
  const currentHash = calculateContentHash(dataObj);
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  if (fs.existsSync(HASH_FILE)) {
    const prevHash = fs.readFileSync(HASH_FILE, 'utf8').trim();
    if (prevHash === currentHash) {
      console.log("⚡ [Gist Uploader] 5분 전과 데이터 100% 동일함 (No Change) -> 불필요한 Gist 업로드 스킵!");
      process.exit(0);
    }
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
        description: `RESCENE Remine Helper Central Data Hub (Updated: ${new Date().toISOString()})`,
        files: {
          "data.json": {
            content: minifiedContent
          }
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub Gist API 오류 HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    fs.writeFileSync(HASH_FILE, currentHash, 'utf8');

    console.log("🎉 [Gist Uploader] Gist 덮어쓰기 업데이트 성공!");
    console.log(`🔗 Gist Raw URL: https://gist.githubusercontent.com/duckbeginner/${GIST_ID}/raw/data.json`);
    console.log(`⏰ 업데이트 시각: ${json.updated_at}`);
  } catch (error) {
    console.error("❌ [Gist Uploader] 업데이트 실패:", error.message);
    process.exit(1);
  }
}

updateGist();
